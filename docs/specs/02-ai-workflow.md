# 02 — AI Workflow: Multi-Agent RAG System

> Thiết kế chi tiết hệ thống Multi-Agent cho tra cứu mã HS Code & biểu thuế XNK

---

## 1. Tại sao Multi-Agent?

Bài toán phân loại mã HS Code **không thể giải quyết bằng một agent duy nhất** vì:

| Thách thức | Giải pháp Multi-Agent |
|---|---|
| Input đa dạng (text, ảnh, file, HS code) | **Router Agent** phân loại & chuẩn hóa input |
| Cần tìm kiếm ngữ nghĩa trong 10.000+ mã HS | **HS Classifier Agent** chuyên RAG search |
| Kết quả mơ hồ khi mô tả quá ngắn | **Clarification Agent** tự động hỏi thêm |
| Cần tra cứu thuế, pháp luật liên quan | **Tax & Legal Agent** chuyên tra cứu biểu thuế + thông tư |
| Cần trích xuất dữ liệu từ chứng từ XNK | **Document Extraction Agent** xử lý OCR + parse |

---

## 2. Kiến trúc Multi-Agent (LangGraph)

```
                    ┌─────────────────┐
                    │   User Input     │
                    │  (text/file/HS)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  ROUTER AGENT   │
                    │  (Supervisor)    │
                    │                  │
                    │  Phân loại:      │
                    │  • text_search   │
                    │  • file_upload   │
                    │  • hs_lookup     │
                    └───┬────┬────┬───┘
                        │    │    │
           ┌────────────┘    │    └────────────┐
           │                 │                 │
   ┌───────▼──────┐  ┌──────▼───────┐  ┌─────▼──────────┐
   │  DOCUMENT    │  │ HS CLASSIFIER│  │  DIRECT DB     │
   │  EXTRACTION  │  │    AGENT     │  │  LOOKUP        │
   │  AGENT       │  │              │  │  (không cần    │
   │              │  │  RAG Pipeline│  │   agent)       │
   │  OCR → Parse │  │  Hybrid      │  └─────┬──────────┘
   │  → Normalize │  │  Search      │        │
   └──────┬───────┘  └──────┬───────┘        │
          │                  │                │
          └──────┬───────────┘                │
                 │                            │
        ┌────────▼────────┐                   │
        │  Số kết quả?    │                   │
        │                 │                   │
        │  > 3 mã HS      │                   │
        │  ≤ 3 mã HS      │                   │
        └──┬──────────┬───┘                   │
           │          │                       │
   ┌───────▼──────┐   │                       │
   │CLARIFICATION │   │                       │
   │   AGENT      │   │                       │
   │              │   │                       │
   │ Gợi ý câu   │   │                       │
   │ hỏi bổ sung  │   │                       │
   │ → User trả   │   │                       │
   │   lời        │   │                       │
   │ → Quay lại   │   │                       │
   │   Classifier │   │                       │
   └──────────────┘   │                       │
                      │                       │
              ┌───────▼───────────────────────▼──┐
              │       TAX & LEGAL AGENT          │
              │                                   │
              │  • Tra biểu thuế XNK              │
              │  • Tra thuế ưu đãi (FTA/C/O)     │
              │  • Tra thông tư, nghị định        │
              │  • Tra chú giải HS                │
              │  • Tra điều kiện XNK đặc biệt    │
              └───────────────┬───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  RESPONSE         │
                    │  FORMATTER        │
                    │                   │
                    │  Tổng hợp →       │
                    │  Structured JSON  │
                    │  → Client         │
                    └───────────────────┘
```

---

## 3. Chi tiết từng Agent

### 3.1 Router Agent (Supervisor)

**Vai trò:** Điểm vào duy nhất, phân loại intent và điều phối agent phù hợp.

**Input:** Raw user request (text, file, hoặc HS code)

**Logic:**
```python
class RouterAgent:
    """
    Phân loại request thành 1 trong 3 luồng:
    - text_search: User nhập mô tả hàng hóa bằng text
    - file_upload: User upload Invoice/Packing List/Image
    - hs_lookup:   User nhập trực tiếp mã HS (regex: ^\d{4,10}$)
    """

    def route(self, input: UserInput) -> AgentRoute:
        if input.has_file():
            return AgentRoute.FILE_UPLOAD
        if self.is_hs_code(input.text):
            return AgentRoute.HS_LOOKUP
        return AgentRoute.TEXT_SEARCH
```

**Output:** `{ route: "text_search" | "file_upload" | "hs_lookup", normalized_input: ... }`

---

### 3.2 Document Extraction Agent

**Vai trò:** Trích xuất thông tin hàng hóa từ chứng từ XNK.

**Input:** File upload (PDF, Image, Excel)

**Pipeline:**
```
File → Detect type → OCR/Parse → Extract fields → Normalize → Output
```

**Trích xuất các trường:**
| Trường | Nguồn | Ví dụ |
|---|---|---|
| `product_description` | Invoice line items | "Polyester woven fabric, dyed, width 150cm" |
| `quantity` | Invoice/Packing List | 5000 meters |
| `unit_price` | Invoice | USD 2.50/meter |
| `origin_country` | C/O hoặc Invoice | Vietnam |
| `loading_port` | B/L | Ho Chi Minh City |
| `discharge_port` | B/L | Busan, Korea |
| `hs_code_declared` | Invoice (nếu có) | 5407.52 |

**Công nghệ OCR:**
- PDF text-based → `pdfplumber` / `PyMuPDF`
- PDF scan / Image → `Tesseract OCR` + tiền xử lý ảnh (deskew, denoise)
- Fallback → `Google Cloud Vision API` cho độ chính xác cao

---

### 3.3 HS Classifier Agent (Core RAG)

**Vai trò:** Tìm mã HS Code phù hợp nhất từ mô tả hàng hóa. Đây là agent quan trọng nhất.

**RAG Pipeline:**

```
┌──────────────────────────────────────────────────────────────┐
│                    HS Classifier Agent                        │
│                                                              │
│  Input: product_description (normalized)                     │
│                                                              │
│  Step 1: QUERY UNDERSTANDING                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ LLM phân tích mô tả → trích xuất:                   │    │
│  │  • product_type (loại sản phẩm)                      │    │
│  │  • material (chất liệu)                              │    │
│  │  • function (công dụng)                               │    │
│  │  • characteristics (đặc điểm riêng)                   │    │
│  │  • keywords_vi (từ khóa tiếng Việt)                   │    │
│  │  • keywords_en (từ khóa tiếng Anh)                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Step 2: HYBRID SEARCH (song song)                          │
│  ┌──────────────────────┐  ┌─────────────────────────────┐  │
│  │  Semantic Search      │  │  Keyword Search             │  │
│  │  (Vector DB)          │  │  (Elasticsearch)            │  │
│  │                       │  │                              │  │
│  │  Embedding mô tả →   │  │  BM25 trên:                 │  │
│  │  Cosine similarity    │  │  • Mô tả biểu thuế         │  │
│  │  vs HS code chunks    │  │  • Chú giải HS             │  │
│  │                       │  │  • Tên thương mại           │  │
│  │  Top-K: 20            │  │  Top-K: 20                  │  │
│  └──────────┬───────────┘  └──────────────┬──────────────┘  │
│             │                              │                 │
│             └──────────┬───────────────────┘                 │
│                        │                                     │
│  Step 3: RERANKING     ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cross-encoder reranker (multilingual)               │    │
│  │  Input: query + candidate HS descriptions            │    │
│  │  Output: reranked candidates with scores             │    │
│  │  → Lọc theo threshold → Top-N kết quả               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Step 4: LLM REASONING                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LLM đối chiếu mô tả hàng với từng candidate:       │    │
│  │  • So sánh với chú giải HS (Section/Chapter notes)   │    │
│  │  • Áp dụng General Rules of Interpretation (GRI)     │    │
│  │  • Xếp hạng confidence score                         │    │
│  │  • Giải thích lý do phân loại                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Output: List[HSCandidate]                                  │
│    - hs_code: "5407.52"                                     │
│    - description: "Vải dệt thoi từ sợi..."                │
│    - confidence: 0.92                                       │
│    - reasoning: "Hàng hóa là vải polyester..."             │
└──────────────────────────────────────────────────────────────┘
```

**Embedding Model:**
- Primary: `intfloat/multilingual-e5-large` (hỗ trợ tiếng Việt + tiếng Anh)
- Chunk size: 512 tokens, overlap: 50 tokens
- Mỗi HS code được embed với: mô tả biểu thuế + chú giải HS + section/chapter notes

**Hybrid Search Strategy:**
```
final_score = α × semantic_score + (1 - α) × keyword_score
α = 0.6  (có thể tune)
```

---

### 3.4 Clarification Agent

**Vai trò:** Khi HS Classifier trả về > 3 kết quả (ambiguous), agent này tự động sinh câu hỏi gợi ý để khách hàng cung cấp thêm thông tin.

**Logic:**
```python
class ClarificationAgent:
    def should_clarify(self, candidates: List[HSCandidate]) -> bool:
        return len(candidates) > 3

    def generate_questions(self, candidates, original_query) -> List[Question]:
        """
        LLM phân tích sự khác biệt giữa các candidates
        → Sinh câu hỏi phân biệt

        Ví dụ:
        - "Sản phẩm có phải dùng trong y tế không?"
        - "Chất liệu chính là gì? (nhựa/kim loại/vải)"
        - "Sản phẩm dùng cho mục đích gì?"
        - "Kích thước/trọng lượng sản phẩm?"
        """
        prompt = f"""
        Người dùng tìm kiếm: "{original_query}"
        Có {len(candidates)} mã HS khác nhau phù hợp.
        Phân tích sự khác biệt giữa các mã HS sau và đưa ra
        2-3 câu hỏi giúp thu hẹp kết quả:

        {format_candidates(candidates)}
        """
        return self.llm.generate(prompt)
```

**Luồng Clarification:**
```
HS Classifier → > 3 results
  → Clarification Agent sinh câu hỏi
  → Client hiển thị câu hỏi dạng:
     ┌──────────────────────────────────┐
     │ 🔍 Cần thêm thông tin           │
     │                                   │
     │ Sản phẩm của bạn thuộc loại nào? │
     │ ○ Dùng trong y tế               │
     │ ○ Dùng trong công nghiệp        │
     │ ○ Dùng trong gia đình           │
     │                                   │
     │ Chất liệu chính?                │
     │ ○ Nhựa   ○ Kim loại   ○ Khác   │
     │                                   │
     │ [Tìm lại]                        │
     └──────────────────────────────────┘
  → User chọn/trả lời
  → Quay lại HS Classifier với query bổ sung
  → Kết quả thu hẹp (≤ 3 mã HS)
```

---

### 3.5 Tax & Legal Agent

**Vai trò:** Tra cứu tất cả thông tin thuế, pháp luật liên quan đến mã HS Code đã xác định.

**Dữ liệu tra cứu:**

| Loại dữ liệu | Nguồn | Mô tả |
|---|---|---|
| Thuế nhập khẩu MFN | Biểu thuế XNK (Excel) | Thuế suất thông thường |
| Thuế nhập khẩu ưu đãi | Biểu thuế XNK | Theo từng FTA (CPTPP, EVFTA, RCEP...) |
| Thuế VAT | Biểu thuế XNK | 0%, 5%, 8%, 10% |
| Thuế tiêu thụ đặc biệt | Biểu thuế XNK | Nếu áp dụng |
| Thuế chống bán phá giá | Thông tư riêng | Nếu áp dụng |
| Thuế tự vệ | Thông tư riêng | Nếu áp dụng |
| Chú giải HS | Chú giải HS 2022 (PDF) | Giải thích chi tiết cách phân loại |
| Thông tư / Nghị định | `data/Law/` | Quy định pháp luật liên quan |
| Điều kiện XNK | Thông tư | Giấy phép, kiểm tra chuyên ngành |
| Tiêu chuẩn kỹ thuật | QCVN, TCVN | Nếu áp dụng |

**RAG cho Legal:**
```
Query: HS code + loại hình XNK + xuất xứ
  → Vector search trên chunks thông tư/nghị định
  → LLM tổng hợp thông tin thuế + quy định
  → Structured output
```

**Output format:**
```json
{
  "hs_code": "5407.52.00",
  "description": "Vải dệt thoi, nhuộm, từ sợi filament polyester, ≥85%",
  "tax_info": {
    "import_mfn": "12%",
    "import_preferential": {
      "CPTPP": "0%",
      "EVFTA": "0%",
      "RCEP": "5%",
      "ATIGA": "0%"
    },
    "vat": "10%",
    "special_consumption": null,
    "anti_dumping": null
  },
  "legal_references": [
    {
      "type": "Nghị định",
      "number": "26/2023/NĐ-CP",
      "title": "Biểu thuế xuất khẩu, nhập khẩu ưu đãi...",
      "relevant_article": "Phụ lục II, Chương 54"
    }
  ],
  "hs_notes": {
    "section_note": "Section XI: Nguyên liệu dệt...",
    "chapter_note": "Chương 54: Sợi filament nhân tạo...",
    "subheading_note": "5407.52: Vải dệt thoi nhuộm..."
  },
  "special_conditions": {
    "import_license": false,
    "specialized_inspection": false,
    "quarantine": false
  }
}
```

---

## 4. LangGraph State Machine

```python
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    user_input: str
    input_type: str           # text_search | file_upload | hs_lookup
    extracted_text: str       # từ OCR/file parsing
    product_description: str  # mô tả đã chuẩn hóa
    hs_candidates: List[HSCandidate]
    clarification_questions: List[Question]
    user_clarification: str   # câu trả lời bổ sung
    selected_hs_code: str
    tax_legal_info: TaxLegalInfo
    final_response: dict
    iteration_count: int      # chống loop vô tận

# Xây dựng graph
workflow = StateGraph(AgentState)

# Thêm nodes
workflow.add_node("router", router_agent)
workflow.add_node("document_extraction", doc_extraction_agent)
workflow.add_node("hs_classifier", hs_classifier_agent)
workflow.add_node("clarification", clarification_agent)
workflow.add_node("tax_legal", tax_legal_agent)
workflow.add_node("format_response", response_formatter)

# Thêm edges
workflow.set_entry_point("router")

workflow.add_conditional_edges("router", route_decision, {
    "text_search": "hs_classifier",
    "file_upload": "document_extraction",
    "hs_lookup": "tax_legal",
})

workflow.add_edge("document_extraction", "hs_classifier")

workflow.add_conditional_edges("hs_classifier", check_candidates, {
    "need_clarification": "clarification",
    "ready": "tax_legal",
})

workflow.add_edge("clarification", "hs_classifier")  # loop back
workflow.add_edge("tax_legal", "format_response")
workflow.add_edge("format_response", END)

app = workflow.compile()
```

**State Machine Diagram:**
```
         ┌──────────┐
         │  START    │
         └────┬─────┘
              │
         ┌────▼─────┐
         │  Router   │
         └──┬──┬──┬──┘
            │  │  │
   ┌────────┘  │  └────────┐
   │           │           │
   ▼           ▼           ▼
┌──────┐  ┌────────┐  ┌────────┐
│ Doc  │  │  HS    │  │  Tax   │
│Extract│  │Classif.│  │& Legal │
└──┬───┘  └───┬────┘  └───┬────┘
   │          │            │
   └────►     │       ┌────┘
         ┌────▼────┐  │
         │ >3 mã?  │  │
         └──┬───┬──┘  │
            │   │     │
     Yes    │   │ No  │
   ┌────────┘   └─────┤
   ▼                   │
┌──────────┐          │
│Clarific. │          │
│  Agent   ├──────►   │
└──────────┘  (loop)  │
                      ▼
              ┌───────────┐
              │  Format   │
              │  Response │
              └─────┬─────┘
                    │
               ┌────▼────┐
               │   END   │
               └─────────┘
```

---

## 5. RAG Knowledge Base Design

### 5.1 Dữ liệu cần index

| Nguồn | File | Xử lý | Chunks |
|---|---|---|---|
| Biểu thuế XNK | `BIEU THUE XNK 2026.04.05.xlsx` | Parse Excel → rows → chunks | ~11,000 mã HS |
| Chú giải HS 2022 | `Chu giai HS 2022 Toan tap.pdf` | OCR/extract → section chunks | ~5,000 chunks |
| Thông tư, Nghị định | `data/Law/*` | PDF parse → article chunks | TBD |

### 5.2 Chunking Strategy

**Biểu thuế (structured):**
```
Mỗi dòng HS code = 1 chunk
Fields: hs_code, description_vi, description_en, unit, mfn_rate, vat_rate, ...
Metadata: chapter, heading, subheading, section
```

**Chú giải HS (semi-structured):**
```
Chunk theo: Section Note → Chapter Note → Heading Note → Subheading Note
Parent-child relationship giữa các level
Chunk size: 500-1000 tokens
Overlap: 100 tokens
```

**Thông tư/Nghị định (unstructured):**
```
Chunk theo: Điều → Khoản → Mục
Giữ metadata: số hiệu văn bản, ngày ban hành, hiệu lực
Chunk size: 500 tokens, overlap: 50 tokens
```

### 5.3 Embedding Pipeline

```
Raw Data → Clean/Normalize → Chunk → Embed → Store (Qdrant)
                                         │
                                         ├── Collection: hs_codes
                                         ├── Collection: hs_notes
                                         └── Collection: legal_docs
```

---

## 6. Prompt Engineering

### 6.1 HS Classifier System Prompt
```
Bạn là chuyên gia phân loại mã HS Code hải quan Việt Nam.

Nhiệm vụ: Phân loại hàng hóa vào đúng mã HS dựa trên:
1. Quy tắc tổng quát giải thích Danh mục hài hòa (GRI 1-6)
2. Chú giải phần, chương, nhóm của HS 2022
3. Biểu thuế xuất nhập khẩu hiện hành

Quy trình:
1. Xác định chất liệu/thành phần chính của hàng hóa
2. Xác định công dụng/chức năng chính
3. Áp dụng GRI để tìm nhóm (4 số) → phân nhóm (6 số) → mã (8-10 số)
4. Đối chiếu với chú giải HS
5. Đưa ra confidence score và giải thích lý do

Lưu ý:
- Ưu tiên GRI 1 (theo nội dung mô tả nhóm) trước các GRI khác
- Nếu hàng hóa có thể thuộc nhiều nhóm, áp dụng GRI 3
- Luôn giải thích bằng tiếng Việt, dễ hiểu
```

### 6.2 Clarification System Prompt
```
Bạn là trợ lý hải quan. Người dùng đã mô tả hàng hóa nhưng kết quả
tìm kiếm cho ra nhiều mã HS khác nhau.

Nhiệm vụ: Phân tích sự khác biệt giữa các mã HS ứng viên
và đưa ra 2-3 câu hỏi ngắn gọn giúp thu hẹp kết quả.

Câu hỏi nên hỏi về:
- Chất liệu cấu tạo chính
- Công dụng / mục đích sử dụng
- Hình dạng / kích thước / trọng lượng
- Đối tượng sử dụng (công nghiệp / gia đình / y tế)
- Cách thức hoạt động

Format câu hỏi: dạng multiple choice để dễ chọn.
```

---

## 7. Xử lý Edge Cases

| Tình huống | Xử lý |
|---|---|
| Mô tả quá ngắn (< 5 từ) | Clarification Agent hỏi ngay, không search |
| Mô tả bằng tiếng Anh | Dùng multilingual embedding, không cần translate |
| Mô tả lẫn lộn Anh-Việt | Xử lý bình thường (multilingual model) |
| Không tìm thấy kết quả | Gợi ý từ khóa liên quan + liên hệ hỗ trợ |
| File upload lỗi OCR | Fallback sang Google Vision API, nếu vẫn lỗi → báo user |
| Mã HS không tồn tại | Gợi ý mã gần nhất + cảnh báo |
| Loop clarification > 3 lần | Dừng, hiển thị top results + liên hệ hỗ trợ |

---

## 8. Model Selection

| Thành phần | Model | Lý do |
|---|---|---|
| Embedding | `intfloat/multilingual-e5-large` | Hỗ trợ tiếng Việt tốt, 1024 dims |
| Reranker | `BAAI/bge-reranker-v2-m3` | Cross-encoder multilingual |
| LLM (reasoning) | GPT-4o / Claude 3.5 Sonnet | Reasoning mạnh, hỗ trợ tiếng Việt |
| LLM (clarification) | GPT-4o-mini / Claude Haiku | Nhanh, rẻ, đủ cho sinh câu hỏi |
| OCR | Tesseract + Google Vision | Fallback chain |

---

## 9. Performance Optimization

- **Cache:** Redis cache cho HS code lookup (TTL: 24h)
- **Batch embedding:** Embed nhiều chunks cùng lúc khi ingest
- **Parallel search:** Semantic + Keyword search chạy song song
- **Streaming:** Trả kết quả streaming cho UX tốt hơn
- **Precomputed:** Index biểu thuế sẵn, chỉ re-index khi có update
