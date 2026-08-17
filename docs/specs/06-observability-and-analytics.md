# 06 — Observability & Analytics

> Giám sát hệ thống, theo dõi chất lượng AI, và phân tích hành vi người dùng

---

## 1. Observability Stack

```
┌─────────────────────────────────────────────────────────┐
│                    DASHBOARDS                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Grafana   │  │ Custom Admin │  │ LangSmith /       │ │
│  │ (Infra)   │  │ Dashboard    │  │ LangFuse (AI)     │ │
│  └─────┬────┘  └──────┬───────┘  └─────────┬─────────┘ │
└────────┼───────────────┼───────────────────┼────────────┘
         │               │                   │
┌────────▼───────────────▼───────────────────▼────────────┐
│                   DATA SOURCES                           │
│  ┌──────────┐  ┌───────────┐  ┌─────────────────────┐  │
│  │Prometheus│  │PostgreSQL │  │ LangSmith/LangFuse  │  │
│  │(metrics) │  │(logs,     │  │ (LLM traces)        │  │
│  │          │  │ analytics)│  │                      │  │
│  └──────────┘  └───────────┘  └─────────────────────┘  │
│  ┌──────────┐  ┌───────────┐                            │
│  │  Loki    │  │  Sentry   │                            │
│  │  (logs)  │  │  (errors) │                            │
│  └──────────┘  └───────────┘                            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure Metrics (Prometheus + Grafana)

### 2.1 Metrics thu thập

| Metric | Type | Mô tả |
|---|---|---|
| `http_requests_total` | Counter | Tổng số requests theo endpoint, method, status |
| `http_request_duration_seconds` | Histogram | Latency theo endpoint |
| `agent_execution_duration_seconds` | Histogram | Thời gian chạy từng agent |
| `rag_search_duration_seconds` | Histogram | Thời gian RAG search (semantic + keyword) |
| `llm_tokens_used_total` | Counter | Tokens sử dụng (input + output) theo model |
| `llm_request_duration_seconds` | Histogram | Latency gọi LLM API |
| `llm_errors_total` | Counter | Lỗi LLM API (rate limit, timeout...) |
| `vector_db_query_duration_seconds` | Histogram | Latency Qdrant queries |
| `es_query_duration_seconds` | Histogram | Latency Elasticsearch queries |
| `ocr_processing_duration_seconds` | Histogram | Thời gian OCR |
| `active_connections` | Gauge | Số kết nối WebSocket đang mở |
| `cache_hit_ratio` | Gauge | Tỷ lệ cache hit (Redis) |

### 2.2 FastAPI Instrumentation

```python
from prometheus_client import Counter, Histogram, Gauge
from prometheus_fastapi_instrumentator import Instrumentator

# Custom metrics
agent_duration = Histogram(
    "agent_execution_duration_seconds",
    "Time spent in each agent",
    ["agent_name"]  # router, hs_classifier, clarification, tax_legal
)

llm_tokens = Counter(
    "llm_tokens_used_total",
    "Total LLM tokens used",
    ["model", "token_type"]  # input, output
)

search_results_count = Histogram(
    "search_results_count",
    "Number of HS code results returned",
    buckets=[0, 1, 2, 3, 5, 10, 20]
)

clarification_triggered = Counter(
    "clarification_triggered_total",
    "Number of times clarification was needed"
)

# Auto-instrument FastAPI
Instrumentator().instrument(app).expose(app)
```

### 2.3 Grafana Dashboards

**Dashboard 1: API Overview**
- Request rate (req/s) theo endpoint
- P50 / P95 / P99 latency
- Error rate (%)
- Active users (WebSocket connections)

**Dashboard 2: AI Pipeline**
- Agent execution time breakdown
- LLM token usage (cost tracking)
- Clarification trigger rate
- Search result count distribution
- Cache hit ratio

**Dashboard 3: Data Health**
- Qdrant collection sizes
- Elasticsearch index sizes
- PostgreSQL table row counts
- Last data ingestion timestamp

---

## 3. AI/LLM Observability (LangSmith / LangFuse)

### 3.1 Tại sao cần AI observability riêng?

- **Debug agent chains:** Xem chính xác agent nào quyết định gì
- **Prompt tuning:** So sánh output khi thay đổi prompt
- **Cost tracking:** Chi phí LLM API theo thời gian
- **Quality monitoring:** Phát hiện khi RAG accuracy giảm

### 3.2 Tracing Structure

```
Trace: search_request_abc123
├── Span: router_agent (12ms)
│   ├── Input: "Vải polyester dệt thoi"
│   └── Output: { route: "text_search" }
│
├── Span: hs_classifier_agent (1200ms)
│   ├── Span: query_understanding (150ms)
│   │   ├── LLM Call: GPT-4o (120ms, 200 tokens)
│   │   └── Output: { product_type: "fabric", material: "polyester", ... }
│   │
│   ├── Span: semantic_search (80ms)
│   │   ├── Qdrant query (80ms)
│   │   └── Results: 20 candidates
│   │
│   ├── Span: keyword_search (60ms)
│   │   ├── Elasticsearch query (60ms)
│   │   └── Results: 15 candidates
│   │
│   ├── Span: reranking (200ms)
│   │   └── Cross-encoder: 25 → 5 candidates
│   │
│   └── Span: llm_reasoning (700ms)
│       ├── LLM Call: GPT-4o (680ms, 1500 tokens)
│       └── Output: 2 candidates with reasoning
│
└── Span: tax_legal_agent (300ms)
    ├── DB lookup: PostgreSQL (20ms)
    ├── Span: legal_rag_search (280ms)
    └── Output: { tax_info: ..., legal_refs: ... }
```

### 3.3 Integration Code

```python
from langsmith import traceable

@traceable(name="hs_classifier_agent")
async def hs_classifier_agent(state: AgentState) -> AgentState:
    # Query understanding
    query_analysis = await understand_query(state["product_description"])
    
    # Hybrid search
    semantic_results = await semantic_search(query_analysis)
    keyword_results = await keyword_search(query_analysis)
    
    # Rerank
    candidates = await rerank(semantic_results + keyword_results)
    
    # LLM reasoning
    final_results = await llm_reasoning(candidates, state["product_description"])
    
    state["hs_candidates"] = final_results
    return state
```

---

## 4. User Analytics

### 4.1 Events Tracking

| Event | Data | Mục đích |
|---|---|---|
| `search_initiated` | query, input_type, timestamp | Phân tích query patterns |
| `results_viewed` | hs_codes shown, count | Đo quality |
| `result_clicked` | hs_code clicked, position | Đo relevance |
| `clarification_shown` | questions, original_query | Đo ambiguity rate |
| `clarification_answered` | answers, time_to_answer | Đo UX friction |
| `file_uploaded` | file_type, file_size | Đo file upload usage |
| `error_occurred` | error_code, context | Debug |

### 4.2 Analytics Queries

```sql
-- Top 10 search queries (tuần này)
SELECT query_text, COUNT(*) as search_count
FROM search_history
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY query_text
ORDER BY search_count DESC
LIMIT 10;

-- Clarification rate (% searches cần hỏi thêm)
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_searches,
    SUM(CASE WHEN clarification_used THEN 1 ELSE 0 END) as clarified,
    ROUND(100.0 * SUM(CASE WHEN clarification_used THEN 1 ELSE 0 END) / COUNT(*), 1) as clarification_rate
FROM search_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Average search latency by input type
SELECT 
    input_type,
    AVG(search_time_ms) as avg_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY search_time_ms) as p95_ms
FROM search_history
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY input_type;

-- Top HS codes được tra cứu
SELECT 
    jsonb_array_elements_text(result_hs_codes) as hs_code,
    COUNT(*) as lookup_count
FROM search_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY hs_code
ORDER BY lookup_count DESC
LIMIT 20;
```

---

## 5. Alerting Rules

### 5.1 Critical Alerts (PagerDuty)

```yaml
groups:
  - name: critical
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 3m
        labels: { severity: critical }
        
      - alert: LLMAPIDown
        expr: rate(llm_errors_total[5m]) / rate(llm_requests_total[5m]) > 0.10
        for: 5m
        labels: { severity: critical }
        
      - alert: VectorDBUnhealthy
        expr: up{job="qdrant"} == 0
        for: 1m
        labels: { severity: critical }
        
      - alert: DatabaseDown
        expr: up{job="postgresql"} == 0
        for: 1m
        labels: { severity: critical }
```

### 5.2 Warning Alerts (Slack)

```yaml
  - name: warnings
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 5
        for: 5m
        labels: { severity: warning }
        
      - alert: HighClarificationRate
        expr: rate(clarification_triggered_total[1h]) / rate(search_requests_total[1h]) > 0.5
        for: 30m
        labels: { severity: warning }
        annotations:
          description: "> 50% searches cần clarification — kiểm tra RAG quality"
        
      - alert: HighLLMCost
        expr: increase(llm_tokens_used_total[1d]) > 1000000
        labels: { severity: warning }
        annotations:
          description: "> 1M tokens/ngày — kiểm tra cache hiệu quả"
```

---

## 6. RAG Quality Monitoring (Weekly)

```python
class RAGQualityMonitor:
    """Chạy weekly: kiểm tra accuracy trên golden test set"""
    
    def run_evaluation(self) -> EvalReport:
        results = []
        for case in self.golden_test_set:
            response = self.pipeline.run(case["query"])
            top3_codes = [r["hs_code"][:7] for r in response["results"][:3]]
            
            results.append({
                "query": case["query"],
                "expected": case["expected_hs"],
                "predicted": top3_codes,
                "correct": case["expected_hs"] in top3_codes,
                "latency_ms": response["metadata"]["search_time_ms"],
            })
        
        accuracy = sum(r["correct"] for r in results) / len(results)
        avg_latency = sum(r["latency_ms"] for r in results) / len(results)
        
        report = EvalReport(
            date=datetime.now(),
            accuracy=accuracy,
            avg_latency=avg_latency,
            total_cases=len(results),
            failed_cases=[r for r in results if not r["correct"]],
        )
        
        # Alert nếu accuracy giảm
        if accuracy < 0.75:
            self.send_alert(f"RAG accuracy dropped to {accuracy:.1%}")
        
        return report
```

---

## 7. Structured Logging

```python
import structlog

logger = structlog.get_logger()

# Log format
logger.info(
    "search_completed",
    request_id="req_abc123",
    input_type="text_search",
    query_length=25,
    agent_chain=["router", "hs_classifier", "tax_legal"],
    result_count=2,
    top_hs_code="5407.52.00",
    confidence=0.94,
    total_duration_ms=1250,
    llm_tokens_used=1700,
    cache_hit=False,
)
```

Log aggregation: **Loki** (cùng stack Grafana) hoặc **ELK** (Elasticsearch + Logstash + Kibana).
