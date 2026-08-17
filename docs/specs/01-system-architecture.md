# 01 — System Architecture

> LogiAI – Hệ thống tra cứu mã HS Code & biểu thuế XNK thông minh

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  Web App (React/Next.js)          │  │  Mobile (React Native) │ │
│  │  - Search bar (text)              │  │  (Phase 2)             │ │
│  │  - File upload (PDF/Image)        │  └────────────────────────┘ │
│  │  - HS Code lookup                 │                              │
│  │  - Result cards + detail panel    │                              │
│  └───────────────────────────────────┘                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│                      API GATEWAY (Kong / Nginx)                     │
│  Rate limiting · Auth (JWT) · Request routing · CORS                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                    BACKEND SERVICE LAYER                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Orchestrator Service (FastAPI)                   │   │
│  │  - Nhận request từ client                                    │   │
│  │  - Điều phối Multi-Agent pipeline                            │   │
│  │  - Tổng hợp kết quả trả về client                           │   │
│  └──────────┬──────────────────────────────────────┬────────────┘   │
│             │                                      │                │
│  ┌──────────▼──────────┐  ┌───────────────────────▼────────────┐   │
│  │  Document Ingestion │  │       Multi-Agent System           │   │
│  │  Service             │  │  (Chi tiết → 02-ai-workflow.md)   │   │
│  │  - PDF/Image OCR    │  │                                     │   │
│  │  - Excel parser     │  │  ┌─────────┐ ┌──────────────────┐ │   │
│  │  - Text extraction  │  │  │ Router  │ │ HS Classifier    │ │   │
│  │  - Chunking         │  │  │ Agent   │ │ Agent            │ │   │
│  └──────────┬──────────┘  │  └─────────┘ └──────────────────┘ │   │
│             │             │  ┌─────────┐ ┌──────────────────┐ │   │
│             │             │  │ Tax &   │ │ Clarification    │ │   │
│             │             │  │ Legal   │ │ Agent            │ │   │
│             │             │  │ Agent   │ └──────────────────┘ │   │
│             │             │  └─────────┘                       │   │
│             │             └────────────────────────────────────┘   │
│             │                                                      │
└─────────────┼──────────────────────────────────────────────────────┘
              │
┌─────────────▼──────────────────────────────────────────────────────┐
│                       DATA LAYER                                    │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  PostgreSQL       │  │  Vector DB       │  │  Redis          │  │
│  │  - HS codes       │  │  (Qdrant/Milvus) │  │  - Cache        │  │
│  │  - Biểu thuế      │  │  - Embeddings    │  │  - Session      │  │
│  │  - Thông tư/NĐ   │  │  - Semantic      │  │  - Rate limit   │  │
│  │  - Chú giải HS    │  │    search index  │  │                 │  │
│  │  - Audit log      │  │                  │  │                 │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │  Object Storage   │  │  Elasticsearch   │                        │
│  │  (MinIO/S3)       │  │  - Full-text     │                        │
│  │  - Raw PDF/Image  │  │    search        │                        │
│  │  - Uploaded docs  │  │  - HS code text  │                        │
│  └──────────────────┘  └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Các thành phần chính

### 2.1 Client Layer
| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| Web Application | Next.js 14+ (App Router) | SPA với SSR cho SEO, responsive UI |
| UI Components | Tailwind CSS + shadcn/ui | Design system nhất quán |
| State Management | Zustand / TanStack Query | Client state + server state caching |

### 2.2 API Gateway
| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| Gateway | Nginx / Kong | Reverse proxy, load balancing |
| Auth | JWT + OAuth2 | Xác thực người dùng |
| Rate Limiting | Redis-based | Chống spam, bảo vệ hệ thống |

### 2.3 Backend Services
| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| Orchestrator | FastAPI (Python 3.12+) | Điều phối request, quản lý agent pipeline |
| Document Ingestion | Celery workers | Xử lý async: OCR, parse Excel, chunking |
| Multi-Agent System | LangGraph / CrewAI | Hệ thống multi-agent (xem `02-ai-workflow.md`) |
| OCR Engine | Tesseract / Google Vision API | Trích xuất text từ ảnh/PDF scan |
| Excel Parser | openpyxl / pandas | Parse biểu thuế XNK từ file Excel |

### 2.4 Data Layer
| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| Relational DB | PostgreSQL 16 | Dữ liệu có cấu trúc: HS codes, thuế, pháp luật |
| Vector DB | Qdrant (hoặc Milvus) | Lưu embeddings cho semantic search |
| Cache | Redis 7 | Cache kết quả, session, rate limiting |
| Search Engine | Elasticsearch 8 | Full-text search tiếng Việt + tiếng Anh |
| Object Storage | MinIO (self-host) / S3 | Lưu file gốc (PDF, ảnh upload) |

---

## 3. Luồng dữ liệu chính

### 3.1 Luồng 1: Khách hàng nhập mô tả hàng hóa (text)
```
User nhập mô tả → API Gateway → Orchestrator
  → Router Agent (phân tích intent)
  → HS Classifier Agent (RAG: vector search + keyword search)
  → Nếu > 3 kết quả → Clarification Agent (gợi ý câu hỏi)
  → Nếu ≤ 3 kết quả → Tax & Legal Agent (tra thuế + thông tư)
  → Response tổng hợp → Client hiển thị
```

### 3.2 Luồng 2: Khách hàng upload file (Invoice/Packing List/Image)
```
User upload file → API Gateway → Orchestrator
  → Document Ingestion Service
    → OCR (nếu ảnh/PDF scan) → Text extraction
    → Parse structured data (invoice fields)
  → Router Agent (phân loại dữ liệu trích xuất)
  → HS Classifier Agent
  → Tax & Legal Agent
  → Response → Client
```

### 3.3 Luồng 3: Khách hàng nhập trực tiếp mã HS Code
```
User nhập HS code → API Gateway → Orchestrator
  → Direct DB lookup (PostgreSQL)
  → Tax & Legal Agent (bổ sung thông tin thuế, thông tư, nghị định)
  → Response → Client
```

---

## 4. Yêu cầu phi chức năng

| Yêu cầu | Mục tiêu |
|---|---|
| Latency (P95) | ≤ 3s cho text search, ≤ 10s cho file upload + OCR |
| Throughput | 100 concurrent users (Phase 1) |
| Availability | 99.5% uptime |
| Data freshness | Biểu thuế cập nhật trong vòng 24h khi có thay đổi |
| Security | Mã hóa at-rest + in-transit, RBAC |

---

## 5. Deployment Topology

```
┌──────────────────────────────────────────┐
│            Docker Compose (Dev)          │
│  ┌────────┐ ┌────────┐ ┌─────────────┐ │
│  │ FastAPI │ │Next.js │ │ PostgreSQL  │ │
│  │ :8000   │ │ :3000  │ │ :5432       │ │
│  └────────┘ └────────┘ └─────────────┘ │
│  ┌────────┐ ┌────────┐ ┌─────────────┐ │
│  │ Qdrant │ │ Redis  │ │ MinIO       │ │
│  │ :6333  │ │ :6379  │ │ :9000       │ │
│  └────────┘ └────────┘ └─────────────┘ │
│  ┌──────────────┐                       │
│  │ Elasticsearch│                       │
│  │ :9200        │                       │
│  └──────────────┘                       │
└──────────────────────────────────────────┘

Production: Kubernetes (EKS/GKE) hoặc Docker Swarm
```

---

## 6. Tech Stack tổng hợp

| Layer | Công nghệ |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python 3.12, FastAPI, Celery, LangGraph |
| AI/ML | OpenAI GPT-4o / Claude 3.5, Sentence Transformers (multilingual) |
| Database | PostgreSQL 16, Qdrant, Redis 7, Elasticsearch 8 |
| Infra | Docker, Docker Compose, Nginx, MinIO |
| CI/CD | GitHub Actions, Docker Registry |
| Monitoring | Prometheus, Grafana, Loki |
