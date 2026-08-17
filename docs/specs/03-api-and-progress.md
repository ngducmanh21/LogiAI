# 03 — API Design & Development Progress

> API endpoints, request/response schemas, và roadmap phát triển

---

## 1. API Overview

**Base URL:** `https://api.logiai.vn/v1`  
**Protocol:** REST + WebSocket (cho streaming results)  
**Auth:** Bearer JWT Token  
**Content-Type:** `application/json` (mặc định), `multipart/form-data` (upload)

---

## 2. API Endpoints

### 2.1 Search — Tra cứu mã HS Code

#### `POST /search/text`
Tra cứu mã HS từ mô tả hàng hóa (text).

**Request:**
```json
{
  "query": "Vải polyester dệt thoi, nhuộm, khổ rộng 150cm",
  "context": {
    "origin_country": "CN",
    "import_type": "kinh_doanh",
    "port_of_loading": "Shanghai",
    "port_of_discharge": "Ho Chi Minh"
  },
  "options": {
    "max_results": 5,
    "include_tax": true,
    "include_legal": true,
    "include_hs_notes": true
  }
}
```

**Response (≤ 3 kết quả — trả kết quả trực tiếp):**
```json
{
  "status": "success",
  "request_id": "req_abc123",
  "results": [
    {
      "hs_code": "5407.52.00",
      "description_vi": "Vải dệt thoi, nhuộm, từ sợi filament polyester, hàm lượng ≥85%",
      "description_en": "Woven fabrics, dyed, of polyester filament yarn, ≥85%",
      "confidence": 0.94,
      "reasoning": "Sản phẩm là vải dệt thoi polyester nhuộm, khổ 150cm. Áp dụng GRI 1, thuộc Chương 54 (Sợi filament nhân tạo), nhóm 5407 (Vải dệt thoi từ sợi filament tổng hợp).",
      "tax_info": {
        "import_mfn": "12%",
        "import_preferential": {
          "CPTPP": "0%",
          "EVFTA": "0%",
          "RCEP": "5%",
          "ATIGA": "0%",
          "ACFTA": "0%"
        },
        "vat": "10%",
        "special_consumption_tax": null,
        "anti_dumping": null,
        "safeguard": null
      },
      "legal_references": [
        {
          "type": "Nghị định",
          "number": "26/2023/NĐ-CP",
          "title": "Biểu thuế xuất khẩu, biểu thuế nhập khẩu ưu đãi",
          "relevant_section": "Phụ lục II - Chương 54"
        }
      ],
      "hs_notes": {
        "section": "XI - Nguyên liệu dệt và các sản phẩm dệt",
        "chapter": "54 - Sợi filament nhân tạo; dải và dạng tương tự...",
        "heading": "5407 - Vải dệt thoi từ sợi filament tổng hợp...",
        "subheading": "5407.52 - Đã nhuộm, hàm lượng polyester ≥85%"
      },
      "special_conditions": {
        "import_license_required": false,
        "specialized_inspection": false,
        "quarantine_required": false,
        "notes": null
      }
    }
  ],
  "metadata": {
    "search_time_ms": 1250,
    "agents_used": ["router", "hs_classifier", "tax_legal"],
    "data_version": "2026-04-05"
  }
}
```

**Response (> 3 kết quả — yêu cầu clarification):**
```json
{
  "status": "needs_clarification",
  "request_id": "req_def456",
  "partial_results": [
    { "hs_code": "3926.90.99", "description_vi": "Sản phẩm khác bằng plastic...", "confidence": 0.65 },
    { "hs_code": "8481.80.59", "description_vi": "Van, vòi... bằng plastic...", "confidence": 0.62 },
    { "hs_code": "3917.40.00", "description_vi": "Phụ kiện ống bằng plastic...", "confidence": 0.58 },
    { "hs_code": "8484.20.00", "description_vi": "Gioăng đệm...", "confidence": 0.55 }
  ],
  "clarification": {
    "message": "Mô tả hàng hóa chưa đủ chi tiết. Vui lòng bổ sung thêm thông tin:",
    "questions": [
      {
        "id": "q1",
        "question": "Sản phẩm dùng cho mục đích gì?",
        "type": "single_choice",
        "options": [
          "Phụ kiện đường ống nước",
          "Van/vòi điều khiển lưu lượng",
          "Gioăng đệm kín",
          "Khác"
        ]
      },
      {
        "id": "q2",
        "question": "Chất liệu chính của sản phẩm?",
        "type": "single_choice",
        "options": ["Nhựa PVC", "Nhựa PP/PE", "Cao su", "Khác"]
      },
      {
        "id": "q3",
        "question": "Kích thước sản phẩm?",
        "type": "free_text",
        "placeholder": "Ví dụ: đường kính 25mm, dài 10cm"
      }
    ]
  }
}
```

#### `POST /search/clarify`
Gửi câu trả lời bổ sung cho clarification.

**Request:**
```json
{
  "request_id": "req_def456",
  "answers": [
    { "question_id": "q1", "answer": "Phụ kiện đường ống nước" },
    { "question_id": "q2", "answer": "Nhựa PVC" },
    { "question_id": "q3", "answer": "đường kính 25mm" }
  ]
}
```

---

#### `POST /search/file`
Tra cứu mã HS từ file chứng từ (Invoice/Packing List/Image).

**Request:** `multipart/form-data`
```
file: <binary>  (PDF, JPG, PNG, XLSX — max 10MB)
context[origin_country]: "CN"
context[import_type]: "kinh_doanh"
```

**Response:** Giống `/search/text` nhưng có thêm:
```json
{
  "extracted_data": {
    "products": [
      {
        "line": 1,
        "description": "Polyester woven fabric, dyed, 150cm width",
        "quantity": "5000 meters",
        "unit_price": "USD 2.50/meter",
        "hs_code_declared": "5407.52"
      }
    ],
    "invoice_info": {
      "invoice_number": "INV-2026-001",
      "date": "2026-03-15",
      "seller": "ABC Trading Co., Ltd",
      "buyer": "XYZ Import Export JSC"
    }
  },
  "results": [ ... ]
}
```

---

#### `GET /search/hs/{hs_code}`
Tra cứu trực tiếp bằng mã HS Code.

**Response:**
```json
{
  "status": "success",
  "result": {
    "hs_code": "5407.52.00",
    "hierarchy": {
      "section": { "code": "XI", "name": "Nguyên liệu dệt và sản phẩm dệt" },
      "chapter": { "code": "54", "name": "Sợi filament nhân tạo..." },
      "heading": { "code": "5407", "name": "Vải dệt thoi từ sợi filament tổng hợp" },
      "subheading": { "code": "5407.52", "name": "Đã nhuộm, ≥85% polyester" },
      "tariff_line": { "code": "5407.52.00", "name": "..." }
    },
    "tax_info": { ... },
    "hs_notes": { ... },
    "legal_references": [ ... ],
    "special_conditions": { ... },
    "related_codes": [
      { "hs_code": "5407.51.00", "description": "Chưa tẩy trắng hoặc đã tẩy trắng" },
      { "hs_code": "5407.53.00", "description": "Từ các sợi có màu khác nhau" }
    ]
  }
}
```

---

### 2.2 Data Management

#### `GET /data/status`
Kiểm tra trạng thái dữ liệu (biểu thuế, chú giải HS).

#### `POST /data/ingest`
Trigger re-ingestion khi có cập nhật biểu thuế mới (Admin only).

---

### 2.3 Health & Monitoring

#### `GET /health`
Health check endpoint.

#### `GET /health/ready`
Readiness check (DB + Vector DB + Redis connected).

---

## 3. Error Handling

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "File format not supported. Accepted: PDF, JPG, PNG, XLSX",
    "details": { "received_type": "text/plain" }
  },
  "request_id": "req_xyz789"
}
```

| Error Code | HTTP Status | Mô tả |
|---|---|---|
| `INVALID_INPUT` | 400 | Input không hợp lệ |
| `INVALID_FILE_FORMAT` | 400 | File không được hỗ trợ |
| `FILE_TOO_LARGE` | 413 | File > 10MB |
| `HS_CODE_NOT_FOUND` | 404 | Mã HS không tồn tại |
| `OCR_FAILED` | 422 | Không đọc được nội dung file |
| `RATE_LIMITED` | 429 | Quá giới hạn request |
| `INTERNAL_ERROR` | 500 | Lỗi hệ thống |

---

## 4. WebSocket — Streaming Results

Endpoint: `wss://api.logiai.vn/v1/search/stream`

Cho phép streaming kết quả real-time khi agent pipeline đang chạy.

```json
// Client gửi
{ "type": "search", "query": "Vải polyester..." }

// Server stream events
{ "type": "status", "agent": "router", "message": "Đang phân tích yêu cầu..." }
{ "type": "status", "agent": "hs_classifier", "message": "Đang tìm kiếm mã HS..." }
{ "type": "partial_result", "data": { "hs_code": "5407.52", "confidence": 0.94 } }
{ "type": "status", "agent": "tax_legal", "message": "Đang tra cứu thuế..." }
{ "type": "final_result", "data": { ... } }
```

---

## 5. Development Roadmap

### Phase 1 — MVP (4-6 tuần)
| Tuần | Task | Status |
|---|---|---|
| W1-2 | Data pipeline: Parse biểu thuế Excel → PostgreSQL | ⬜ Not started |
| W1-2 | Data pipeline: Parse chú giải HS PDF → chunks → Qdrant | ⬜ Not started |
| W2-3 | Backend: FastAPI skeleton + Router Agent | ⬜ Not started |
| W3-4 | Backend: HS Classifier Agent (RAG pipeline) | ⬜ Not started |
| W3-4 | Backend: Clarification Agent | ⬜ Not started |
| W4-5 | Backend: Tax & Legal Agent | ⬜ Not started |
| W4-5 | Frontend: Search UI + Result cards | ⬜ Not started |
| W5-6 | Integration testing + tuning | ⬜ Not started |

### Phase 2 — Enhanced (4 tuần)
| Task | Status |
|---|---|
| File upload + OCR (Document Extraction Agent) | ⬜ Not started |
| WebSocket streaming | ⬜ Not started |
| Thuế ưu đãi FTA chi tiết | ⬜ Not started |
| User authentication + history | ⬜ Not started |
| Admin dashboard (data management) | ⬜ Not started |

### Phase 3 — Production (3 tuần)
| Task | Status |
|---|---|
| Kubernetes deployment | ⬜ Not started |
| Monitoring (Prometheus + Grafana) | ⬜ Not started |
| CI/CD pipeline | ⬜ Not started |
| Load testing + optimization | ⬜ Not started |
| Security audit | ⬜ Not started |

---

## 6. Database Schema (PostgreSQL)

```sql
-- Biểu thuế XNK
CREATE TABLE hs_codes (
    id SERIAL PRIMARY KEY,
    hs_code VARCHAR(12) NOT NULL UNIQUE,
    section_code VARCHAR(5),
    chapter_code VARCHAR(4),
    heading_code VARCHAR(6),
    description_vi TEXT NOT NULL,
    description_en TEXT,
    unit VARCHAR(50),
    mfn_rate DECIMAL(5,2),
    vat_rate DECIMAL(5,2),
    special_consumption_rate DECIMAL(5,2),
    effective_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Thuế ưu đãi FTA
CREATE TABLE preferential_rates (
    id SERIAL PRIMARY KEY,
    hs_code VARCHAR(12) REFERENCES hs_codes(hs_code),
    fta_code VARCHAR(20) NOT NULL,  -- CPTPP, EVFTA, RCEP, ATIGA...
    rate DECIMAL(5,2),
    effective_from DATE,
    effective_to DATE,
    legal_reference TEXT
);

-- Chú giải HS
CREATE TABLE hs_notes (
    id SERIAL PRIMARY KEY,
    note_type VARCHAR(20) NOT NULL,  -- section, chapter, heading, subheading
    reference_code VARCHAR(12) NOT NULL,
    content_vi TEXT NOT NULL,
    content_en TEXT,
    parent_id INTEGER REFERENCES hs_notes(id)
);

-- Văn bản pháp luật
CREATE TABLE legal_documents (
    id SERIAL PRIMARY KEY,
    doc_type VARCHAR(50) NOT NULL,     -- nghi_dinh, thong_tu, quyet_dinh
    doc_number VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    issued_date DATE,
    effective_date DATE,
    issuing_body VARCHAR(200),
    content_summary TEXT,
    file_path VARCHAR(500)
);

-- Liên kết HS code ↔ văn bản pháp luật
CREATE TABLE hs_legal_mapping (
    hs_code VARCHAR(12) REFERENCES hs_codes(hs_code),
    legal_doc_id INTEGER REFERENCES legal_documents(id),
    relevant_article TEXT,
    PRIMARY KEY (hs_code, legal_doc_id)
);

-- Lịch sử tra cứu (analytics)
CREATE TABLE search_history (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) UNIQUE,
    user_id INTEGER,
    query_text TEXT,
    input_type VARCHAR(20),
    result_hs_codes JSONB,
    clarification_used BOOLEAN DEFAULT FALSE,
    search_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```
