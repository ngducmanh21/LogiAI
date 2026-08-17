# LogiAI — Tra cứu mã HS & Biểu thuế XNK bằng AI

LogiAI là hệ thống multi-agent giúp doanh nghiệp xuất nhập khẩu **phân loại mã HS 8 số** từ mô tả hàng hóa (tiếng Việt tự nhiên), tra cứu **thuế suất MFN / VAT / ưu đãi FTA**, và **đối chiếu pháp lý XNK** tự động dựa trên các văn bản luật đã ingest.

- **Dữ liệu**: Biểu thuế XNK 2026 (~12.000 mã HS 8 số) + Chú giải HS 2022 + các văn bản pháp luật XNK.
- **AI**: Pipeline multi-agent (phân tích truy vấn → hybrid search → reasoning → xác minh pháp lý), streaming tiến trình agent theo thời gian thực.
- **Demo**: https://logi-ai-sigma.vercel.app

---

## Mục lục

- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt & chạy local](#cài-đặt--chạy-local)
- [Pipeline dữ liệu (offline)](#pipeline-dữ-liệu-offline)
- [API Backend](#api-backend)
- [Frontend](#frontend)
- [Luồng AI multi-agent](#luồng-ai-multi-agent)
- [Deploy (Vercel)](#deploy-vercel)
- [Biến môi trường](#biến-môi-trường)
- [Troubleshooting](#troubleshooting)

---

## Kiến trúc tổng quan

```
┌─────────────────────┐         ┌──────────────────────────────────────┐
│  Frontend (Next.js) │  NDJSON │  Backend (FastAPI)                   │
│  /chat /upload      │◄───────►│  Multi-agent pipeline:               │
│  /legal             │ stream  │  Analyzer → Search → Reasoner        │
└─────────────────────┘         │            → Legal Verifier          │
                                └───────┬──────────────────────────────┘
                                        │ đọc lúc khởi động
                                ┌───────▼──────────────────────────────┐
                                │  data/clean/  (JSONL đã làm sạch)    │
                                │  data/index/  (embeddings .npy)      │
                                └───────▲──────────────────────────────┘
                                        │ offline pipeline
                                ┌───────┴──────────────────────────────┐
                                │  scripts/clean_bieu_thue.py          │
                                │  scripts/clean_laws.py               │
                                │  scripts/build_index.py              │
                                └──────────────────────────────────────┘
```

- **Backend** load toàn bộ dữ liệu sạch + vector index vào RAM khi khởi động (singleton `Store`), không cần database ngoài.
- **Tìm kiếm hybrid**: BM25-style keyword + cosine similarity trên OpenAI embeddings, hợp nhất điểm.
- **Streaming**: các endpoint `/stream` trả NDJSON — từng sự kiện agent (`analyzer`, `search`, `reasoner`, `legal`) rồi đến kết quả cuối, để UI hiển thị tiến trình realtime.

Chi tiết thiết kế xem tại [`docs/specs/`](docs/specs/README.md) (7 specs: kiến trúc, AI workflow, API, bảo mật, pipeline pháp lý, observability, CI/CD).

## Cấu trúc thư mục

```
LogiAI/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + routes + NDJSON streaming
│   │   ├── agents.py        # Pipeline multi-agent (analyze/search/reason/legal)
│   │   ├── store.py         # In-memory store: HS chunks, legal chunks, embeddings
│   │   ├── llm.py           # OpenAI client (chat + embeddings)
│   │   ├── legal_ingest.py  # Ingest PDF/DOCX pháp luật do người dùng upload
│   │   └── config.py        # Đường dẫn, model, env
│   ├── requirements.txt
│   └── .env.example         # → copy thành backend/.env và điền OPENAI_API_KEY
├── frontend/                # Next.js 15 (App Router) + Tailwind
│   ├── app/
│   │   ├── page.tsx         # Landing page
│   │   ├── chat/            # Chat tra cứu HS (streaming agent flow)
│   │   ├── upload/          # Upload ảnh chứng từ → trích xuất mặt hàng → phân loại
│   │   └── legal/           # Duyệt & upload văn bản pháp luật, hỏi đáp pháp lý
│   └── components/
│       ├── hs/results.tsx   # Render kết quả HS, thuế, clarification, API_BASE
│       └── hs/agent-flow.tsx# Hiển thị tiến trình agent realtime
├── scripts/                 # Pipeline dữ liệu offline (chạy 1 lần / khi có data mới)
│   ├── clean_bieu_thue.py   # XLSX biểu thuế → data/clean/hs_codes.jsonl + hs_notes.jsonl
│   ├── clean_laws.py        # PDF/DOCX luật → data/clean/legal_chunks.jsonl
│   └── build_index.py       # Embed toàn bộ chunks → data/index/*.npy
├── data/
│   ├── BieuthueXNK/         # Dữ liệu gốc: XLSX biểu thuế + PDF chú giải HS
│   ├── Law/                 # Văn bản pháp luật gốc (+ uploads/ từ người dùng)
│   ├── clean/               # Output pipeline: JSONL sạch + quality_report.json
│   └── index/               # Vector embeddings (.npy + .meta.json)
├── docs/specs/              # 7 specs thiết kế hệ thống
└── vercel.json              # Cấu hình deploy 2 service + rewrites
```

## Yêu cầu hệ thống

| Thành phần | Phiên bản |
|---|---|
| Python | ≥ 3.11 |
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| OpenAI API key | bắt buộc cho AI reasoning & semantic search (không có key vẫn chạy được keyword search) |

## Cài đặt & chạy local

### 1. Clone & cấu hình env

```bash
git clone git@github.com:ngducmanh21/LogiAI.git
cd LogiAI
cp backend/.env.example backend/.env
# Mở backend/.env và điền OPENAI_API_KEY=sk-...
```

### 2. Backend

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Kiểm tra: `curl http://127.0.0.1:8000/v1/health` — mong đợi `hs_leaf_codes: 12000`, `vector_index: true`.

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev        # http://localhost:3000
```

Frontend dev tự trỏ API về `http://127.0.0.1:8000`. Có thể override bằng `NEXT_PUBLIC_LOGIAI_API_URL`.

## Pipeline dữ liệu (offline)

Repo đã kèm sẵn `data/clean/` và `data/index/` nên **không cần chạy lại** trừ khi có dữ liệu mới.

### Bước 1 — Làm sạch biểu thuế XLSX

```bash
python scripts/clean_bieu_thue.py
```

- Đọc `data/BieuthueXNK/BIEU THUE XNK 2026.04.05.xlsx` (sheet `BT2026`, header nhiều tầng).
- Chuẩn hóa 15.119 dòng HS (cấp 4/6/7/8 số), gắn mô tả phân cấp cha–con, thuế MFN/VAT/TTĐB/BVMT/XK + ~17 cột thuế ưu đãi FTA.
- Trích chú giải Phần/Chương thành `hs_notes.jsonl` (176 chunks, 97 chương).
- Xuất `data/clean/hs_codes.jsonl`, `hs_codes.csv`, `hs_notes.jsonl` và `quality_report.json` (tự kiểm tra tính toàn vẹn — build fail nếu `passed: false`).

### Bước 2 — Làm sạch văn bản pháp luật

```bash
python scripts/clean_laws.py
```

- Đọc PDF/DOCX trong `data/Law/`, tách theo Điều/Khoản thành `data/clean/legal_chunks.jsonl`.

### Bước 3 — Build vector index

```bash
python scripts/build_index.py   # cần OPENAI_API_KEY
```

- Embed toàn bộ HS chunks + legal chunks bằng `text-embedding-3-small` (1536 chiều).
- Xuất `data/index/hs_embeddings.npy`, `legal_embeddings.npy` + meta (model, dimensions, checksum) để backend xác thực khi load.

## API Backend

Base path production: `/api/backend` (qua Vercel rewrite). Local: `http://127.0.0.1:8000`.

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/v1/health` | Trạng thái store, index, LLM |
| POST | `/v1/search/text` | Phân loại HS từ mô tả (JSON response) |
| POST | `/v1/search/text/stream` | Như trên, **streaming NDJSON** (agent events + result) |
| POST | `/v1/search/clarify` | Trả lời câu hỏi làm rõ (kèm `request_id`) |
| POST | `/v1/search/clarify/stream` | Bản streaming |
| GET | `/v1/search/hs/{hs_code}` | Tra trực tiếp theo mã HS |
| POST | `/v1/search/file` | Upload ảnh chứng từ (JPEG/PNG/WebP/GIF ≤10MB) → OCR + phân loại từng mặt hàng |
| POST | `/v1/legal/ask` | Hỏi đáp pháp lý XNK (RAG trên legal chunks) |
| GET | `/v1/legal/documents` | Danh sách văn bản trong knowledge base |
| GET | `/v1/legal/documents/{doc_id}` | Toàn văn một văn bản (nhóm theo Điều) |
| POST | `/v1/legal/documents` | Upload PDF/DOCX (≤30MB) bổ sung vào knowledge base (tự embed) |

### Ví dụ

```bash
curl -X POST http://127.0.0.1:8000/v1/search/text \
  -H "Content-Type: application/json" \
  -d '{"query": "Vải dệt thoi 100% polyester đã nhuộm, định lượng 120g/m2"}'
```

Response `success` gồm: `results[]` (hs_code, mô tả VI/EN, đơn vị tính, confidence, reasoning, `tax_info` MFN/VAT/FTA, chú giải chương, căn cứ pháp lý) + `legal_verification` (status `ok/conditional/restricted/unknown`, trích dẫn điều luật). Nếu mô tả chưa đủ, trả `needs_clarification` với câu hỏi single-choice/free-text và `partial_results`.

### Định dạng stream (NDJSON)

```
{"type":"agent","agent":"analyzer","status":"running","detail":"Phân tích truy vấn…"}
{"type":"agent","agent":"search","status":"done","detail":"12 ứng viên"}
...
{"type":"result","data":{"status":"success","results":[...]}}
```

## Frontend

| Route | Chức năng |
|---|---|
| `/` | Landing page giới thiệu hệ thống |
| `/chat` | Chat tra cứu: nhập mô tả hoặc mã HS, xem agent flow realtime, trả lời clarification inline |
| `/upload` | Upload ảnh hóa đơn/packing list → trích xuất mặt hàng → phân loại từng mặt hàng |
| `/legal` | Duyệt toàn văn văn bản luật, upload văn bản mới, hỏi đáp pháp lý có trích dẫn |

Stack: **Next.js 15 (App Router, static export cho các trang), Tailwind CSS 4, lucide-react**. Responsive mobile-first.

## Luồng AI multi-agent

1. **Analyzer** — LLM phân tích truy vấn: loại hàng, chất liệu, công dụng; quyết định có cần hỏi làm rõ không.
2. **Search** — Hybrid retrieval trên 12.000 mã HS: keyword matching (chuẩn hóa thuật ngữ VI) + cosine similarity trên embeddings; lấy top-k ứng viên kèm ngữ cảnh cha–con và chú giải chương.
3. **Reasoner** — LLM đối chiếu ứng viên với 6 quy tắc GRI, chú giải Phần/Chương → chọn mã, sinh `reasoning` và `confidence`.
4. **Legal Verifier** (sub-agent) — RAG trên legal chunks: kiểm tra hàng có thuộc diện cấm/giấy phép/kiểm tra chuyên ngành, trả trích dẫn Điều/văn bản cụ thể.

Không có `OPENAI_API_KEY`, hệ thống fallback về keyword search thuần (không reasoning, không semantic).

## Deploy (Vercel)

`vercel.json` khai báo 2 service:

- **frontend** — Next.js tại `frontend/`
- **backend** — Python (FastAPI) tại `backend/`, entrypoint `app/main.py`

Rewrites: `/api/backend/*` → backend service, còn lại → frontend. FastAPI có middleware strip prefix `/api/backend` (xem `backend/app/main.py`).

Cần set env trên Vercel (scope backend): `OPENAI_API_KEY`, tùy chọn `OPENAI_MODEL`. Frontend production tự dùng `/api/backend` làm API base — không cần cấu hình thêm, trừ khi muốn trỏ backend khác qua `NEXT_PUBLIC_LOGIAI_API_URL`.

Push lên `main` → Vercel tự build & deploy.

## Biến môi trường

File `backend/.env` (copy từ `backend/.env.example`, **không commit**):

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `OPENAI_API_KEY` | *(trống)* | Bắt buộc cho AI reasoning + semantic search + build index |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model chat/reasoning |
| `OPENAI_TIMEOUT_SECONDS` | `45` | |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Đổi model ⇒ phải build lại index |
| `OPENAI_EMBEDDING_DIMENSIONS` | `1536` | |
| `OPENAI_EMBEDDING_BATCH_SIZE` | `64` | |
| `NEXT_PUBLIC_LOGIAI_API_URL` | *(auto)* | Frontend: override API base nếu cần |

## Troubleshooting

| Triệu chứng | Nguyên nhân / cách sửa |
|---|---|
| UI báo "Không kết nối được máy chủ LogiAI" | Backend chưa chạy (local: `uvicorn ... --port 8000`) hoặc deploy thiếu backend service |
| `/v1/health` trả `vector_index: false` | Thiếu `data/index/*.npy` — chạy `python scripts/build_index.py` |
| Kết quả không có reasoning/confidence thấp | Thiếu `OPENAI_API_KEY` → đang chạy keyword-only fallback |
| Upload ảnh trả 415 | Chỉ hỗ trợ JPEG/PNG/WebP/GIF; PDF/Excel chưa hỗ trợ ở endpoint này |
| `clean_bieu_thue.py` fail | Xem `data/clean/quality_report.json` mục `issues` |

---

## Disclaimer

Kết quả phân loại mã HS và thông tin thuế suất **chỉ mang tính tham khảo**, không thay thế quyết định xác định trước mã số của cơ quan hải quan. Luôn đối chiếu với văn bản pháp luật hiện hành trước khi khai báo chính thức.
