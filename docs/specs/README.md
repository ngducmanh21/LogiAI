# LogiAI — Specs & Documentation

> Hệ thống tra cứu mã HS Code & biểu thuế XNK thông minh sử dụng Multi-Agent RAG

---

## Tổng quan dự án

**LogiAI** là nền tảng web giúp doanh nghiệp xuất nhập khẩu tra cứu mã HS Code và thông tin thuế một cách nhanh chóng, chính xác bằng AI. Hệ thống sử dụng kiến trúc **Multi-Agent** kết hợp **RAG (Retrieval-Augmented Generation)** để phân loại hàng hóa và tra cứu biểu thuế.

### Tính năng chính

| # | Tính năng | Mô tả |
|---|---|---|
| 1 | **Tìm kiếm bằng mô tả** | Nhập mô tả hàng hóa → nhận mã HS Code + thuế + quy định |
| 2 | **Upload chứng từ** | Upload Invoice/Packing List/ảnh → OCR trích xuất → tra mã HS |
| 3 | **Tra cứu mã HS** | Nhập trực tiếp mã HS → xem đầy đủ thông tin thuế, chú giải, pháp luật |
| 4 | **Gợi ý thông minh** | Khi kết quả mơ hồ (> 3 mã), tự động hỏi bổ sung để thu hẹp kết quả |
| 5 | **Chi tiết biểu thuế** | Click vào mã HS → hiển thị toàn bộ thông tin thuế, FTA, thông tư, nghị định |

---

## Tài liệu specs

| File | Nội dung | Đối tượng |
|---|---|---|
| [01-system-architecture.md](./01-system-architecture.md) | Kiến trúc tổng thể, tech stack, deployment topology | Dev Lead, DevOps |
| [02-ai-workflow.md](./02-ai-workflow.md) | **Multi-Agent RAG** — thiết kế chi tiết 5 agents, LangGraph state machine, RAG pipeline, prompt engineering | AI Engineer |
| [03-api-and-progress.md](./03-api-and-progress.md) | API endpoints, request/response schemas, DB schema, development roadmap | Backend Dev, Frontend Dev |
| [04-data-security-and-testing.md](./04-data-security-and-testing.md) | Security architecture, auth, testing strategy (unit/integration/E2E/RAG quality) | QA, Security |
| [05-legal-data-pipeline.md](./05-legal-data-pipeline.md) | Data ingestion: parse biểu thuế Excel, chú giải HS PDF, văn bản pháp luật → DB + Vector DB | Data Engineer |
| [06-observability-and-analytics.md](./06-observability-and-analytics.md) | Monitoring, LLM tracing, user analytics, alerting rules | DevOps, Product |
| [07-ci-cd-and-deployment.md](./07-ci-cd-and-deployment.md) | CI/CD pipeline, Docker, Kubernetes, environment config | DevOps |

---

## Kiến trúc Multi-Agent (tóm tắt)

```
User Input → Router Agent → ┬→ Document Extraction Agent (file upload)
                             ├→ HS Classifier Agent (text search — Core RAG)
                             └→ Direct DB Lookup (HS code)
                                        │
                              ┌─────────▼──────────┐
                              │  > 3 kết quả?       │
                              │  Yes → Clarification │──→ (loop) HS Classifier
                              │  No  → Tax & Legal   │
                              └──────────────────────┘
                                        │
                              Response Formatter → Client
```

**5 Agents:**
1. **Router Agent** — Phân loại input (text/file/HS code)
2. **Document Extraction Agent** — OCR + parse chứng từ XNK
3. **HS Classifier Agent** — Hybrid RAG search (semantic + keyword + rerank + LLM reasoning)
4. **Clarification Agent** — Sinh câu hỏi gợi ý khi kết quả mơ hồ
5. **Tax & Legal Agent** — Tra thuế, thông tư, nghị định, chú giải HS

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python 3.12, FastAPI, Celery, LangGraph |
| AI/ML | GPT-4o / Claude 3.5, multilingual-e5-large, bge-reranker-v2-m3 |
| Database | PostgreSQL 16, Qdrant, Redis 7, Elasticsearch 8 |
| Infra | Docker, Kubernetes, Nginx, MinIO |
| Monitoring | Prometheus, Grafana, LangSmith/LangFuse, Sentry |

---

## Dữ liệu nguồn

```
data/
├── BieuthueXNK/
│   ├── BIEU THUE XNK 2026.04.05.xlsx    # Biểu thuế XNK (~11,000 mã HS)
│   └── Chu giai HS 2022 Toan tap.pdf     # Chú giải HS 2022 (~5,000 chunks)
└── Law/                                   # Thông tư, Nghị định liên quan
```

---

## Quick Start (Development)

```bash
# 1. Clone & setup
git clone <repo>
cd LogiAI
cp .env.example .env  # cấu hình API keys

# 2. Start infrastructure
docker compose up -d postgres redis qdrant elasticsearch minio

# 3. Ingest data
cd backend
pip install -r requirements.txt
python scripts/ingest_bieu_thue.py
python scripts/ingest_chu_giai.py

# 4. Start backend
uvicorn app.main:app --reload --port 8000

# 5. Start frontend
cd ../frontend
npm install
npm run dev
```

---

## Roadmap

- **Phase 1 (MVP):** Text search + HS lookup + Clarification + Tax info
- **Phase 2 (Enhanced):** File upload OCR + Streaming + FTA details + Auth
- **Phase 3 (Production):** Kubernetes + Monitoring + CI/CD + Security audit
