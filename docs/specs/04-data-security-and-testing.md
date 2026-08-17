# 04 — Data Security & Testing Strategy

> Bảo mật dữ liệu, xác thực, và chiến lược kiểm thử

---

## 1. Security Architecture

### 1.1 Threat Model

| Threat | Impact | Mitigation |
|---|---|---|
| Prompt injection qua mô tả hàng | Agent trả kết quả sai / leak data | Input sanitization + guardrails |
| File upload chứa malware | Server bị compromise | Virus scan + sandbox processing |
| Brute force API | Service unavailable | Rate limiting + WAF |
| Data leak (biểu thuế, chứng từ KH) | Mất uy tín, vi phạm pháp luật | Encryption at-rest + RBAC |
| Man-in-the-middle | Đánh cắp dữ liệu truyền tải | TLS 1.3 everywhere |
| SQL/NoSQL injection | Database compromise | Parameterized queries + ORM |

### 1.2 Authentication & Authorization

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client   │────▶│  API Gateway  │────▶│  Auth Service │
│           │     │  (JWT verify) │     │  (Issue JWT)  │
└──────────┘     └──────────────┘     └──────────────┘
```

**Auth flow:**
1. User đăng nhập → Auth Service cấp JWT (access + refresh token)
2. Mọi request kèm `Authorization: Bearer <access_token>`
3. API Gateway verify JWT trước khi forward
4. Role-based access control (RBAC):

| Role | Permissions |
|---|---|
| `guest` | Search (rate limited: 10 req/hour) |
| `user` | Search + File upload + History |
| `premium` | Unlimited search + Bulk lookup + Export |
| `admin` | All + Data management + User management |

### 1.3 Data Encryption

| Layer | Method |
|---|---|
| In-transit | TLS 1.3 (HTTPS) |
| At-rest (DB) | AES-256 (PostgreSQL TDE hoặc application-level) |
| At-rest (Files) | MinIO server-side encryption (SSE-S3) |
| Secrets | HashiCorp Vault / AWS Secrets Manager |
| API Keys | Bcrypt hashed, chỉ hiển thị khi tạo |

### 1.4 Input Validation & Sanitization

```python
# Ví dụ: Validate search input
class SearchInput(BaseModel):
    query: str = Field(..., min_length=2, max_length=2000)
    
    @field_validator("query")
    def sanitize_query(cls, v):
        # Loại bỏ prompt injection patterns
        dangerous_patterns = [
            r"ignore previous instructions",
            r"system prompt",
            r"<script>",
            r"(?i)drop\s+table",
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Invalid input detected")
        return v.strip()

# File upload validation
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".xlsx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_upload(file: UploadFile):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Unsupported file format")
    # Check magic bytes, not just extension
    magic_bytes = file.file.read(8)
    file.file.seek(0)
    if not is_valid_magic(magic_bytes, ext):
        raise HTTPException(400, "File content doesn't match extension")
```

### 1.5 AI-specific Security

**LLM Guardrails:**
- System prompt được hardcode, không inject từ user input
- Output validation: kiểm tra HS code format trước khi trả về
- Confidence threshold: chỉ trả kết quả có confidence > 0.3
- Logging mọi LLM call để audit

**RAG Security:**
- Vector DB chỉ chứa dữ liệu biểu thuế công khai (không có PII)
- User upload files được xóa sau 24h (hoặc theo yêu cầu)
- Không lưu nội dung chứng từ vào training data

---

## 2. Testing Strategy

### 2.1 Test Pyramid

```
        ┌─────────┐
        │  E2E    │  ← Ít nhất, chậm nhất
        │  Tests  │
        ├─────────┤
        │  Integ. │  ← Kiểm tra agent pipeline
        │  Tests  │
        ├─────────┤
        │  Unit   │  ← Nhiều nhất, nhanh nhất
        │  Tests  │
        └─────────┘
```

### 2.2 Unit Tests

**Scope:** Từng function / class riêng lẻ

```python
# test_router_agent.py
class TestRouterAgent:
    def test_route_hs_code_4_digits(self):
        agent = RouterAgent()
        result = agent.route(UserInput(text="5407"))
        assert result == AgentRoute.HS_LOOKUP

    def test_route_hs_code_10_digits(self):
        agent = RouterAgent()
        result = agent.route(UserInput(text="5407520000"))
        assert result == AgentRoute.HS_LOOKUP

    def test_route_text_description(self):
        agent = RouterAgent()
        result = agent.route(UserInput(text="Vải polyester dệt thoi"))
        assert result == AgentRoute.TEXT_SEARCH

    def test_route_file_upload(self):
        agent = RouterAgent()
        result = agent.route(UserInput(text="", file=mock_file))
        assert result == AgentRoute.FILE_UPLOAD

    def test_route_mixed_text_with_numbers(self):
        # "Ống nhựa PVC 25mm" có số nhưng không phải HS code
        agent = RouterAgent()
        result = agent.route(UserInput(text="Ống nhựa PVC 25mm"))
        assert result == AgentRoute.TEXT_SEARCH


# test_hs_classifier.py
class TestHSClassifier:
    def test_hybrid_search_returns_results(self):
        classifier = HSClassifierAgent(vector_db=mock_qdrant, es=mock_es)
        results = classifier.search("Vải polyester dệt thoi nhuộm")
        assert len(results) > 0
        assert all(r.confidence > 0 for r in results)

    def test_reranking_improves_order(self):
        # Top-1 after reranking should have highest confidence
        ...

    def test_empty_query_raises_error(self):
        ...
```

### 2.3 Integration Tests

**Scope:** Kiểm tra luồng agent pipeline end-to-end

```python
# test_agent_pipeline.py
class TestAgentPipeline:
    @pytest.fixture
    def pipeline(self, test_db, test_qdrant):
        """Setup pipeline với test databases"""
        return create_pipeline(db=test_db, vector_db=test_qdrant)

    def test_text_search_happy_path(self, pipeline):
        """Mô tả rõ ràng → trả ≤ 3 kết quả trực tiếp"""
        result = pipeline.run({
            "user_input": "Vải dệt thoi polyester nhuộm, 85% polyester, khổ 150cm",
            "input_type": "text_search"
        })
        assert result["status"] == "success"
        assert len(result["results"]) <= 3
        assert "5407" in result["results"][0]["hs_code"]

    def test_text_search_ambiguous_triggers_clarification(self, pipeline):
        """Mô tả mơ hồ → trigger clarification"""
        result = pipeline.run({
            "user_input": "ống nhựa",
            "input_type": "text_search"
        })
        assert result["status"] == "needs_clarification"
        assert len(result["clarification"]["questions"]) >= 2

    def test_hs_lookup_returns_full_info(self, pipeline):
        """Tra mã HS trực tiếp → trả đầy đủ thông tin"""
        result = pipeline.run({
            "user_input": "5407.52.00",
            "input_type": "hs_lookup"
        })
        assert result["status"] == "success"
        assert result["result"]["tax_info"]["import_mfn"] is not None

    def test_clarification_loop_max_3_iterations(self, pipeline):
        """Đảm bảo clarification không loop vô tận"""
        ...
```

### 2.4 RAG Quality Tests (Golden Set)

**Tạo golden test set** với các cặp (mô tả hàng, mã HS đúng):

```python
GOLDEN_TEST_SET = [
    {
        "query": "Vải dệt thoi polyester nhuộm 85%",
        "expected_hs": "5407.52",
        "expected_chapter": "54"
    },
    {
        "query": "Gạo trắng hạt dài, đóng bao 50kg",
        "expected_hs": "1006.30",
        "expected_chapter": "10"
    },
    {
        "query": "Xe ô tô con 5 chỗ, dung tích 1500cc, chạy xăng",
        "expected_hs": "8703.22",
        "expected_chapter": "87"
    },
    {
        "query": "Laptop Dell 15 inch, RAM 16GB",
        "expected_hs": "8471.30",
        "expected_chapter": "84"
    },
    # ... 50-100 test cases
]

class TestRAGQuality:
    @pytest.mark.parametrize("case", GOLDEN_TEST_SET)
    def test_hs_classification_accuracy(self, pipeline, case):
        result = pipeline.run({"user_input": case["query"]})
        top_hs_codes = [r["hs_code"][:7] for r in result["results"][:3]]
        assert case["expected_hs"] in top_hs_codes, \
            f"Expected {case['expected_hs']} in top 3, got {top_hs_codes}"

    def test_overall_accuracy_above_threshold(self, pipeline):
        """Top-3 accuracy phải >= 80%"""
        correct = 0
        for case in GOLDEN_TEST_SET:
            result = pipeline.run({"user_input": case["query"]})
            top_hs = [r["hs_code"][:7] for r in result["results"][:3]]
            if case["expected_hs"] in top_hs:
                correct += 1
        accuracy = correct / len(GOLDEN_TEST_SET)
        assert accuracy >= 0.80, f"Accuracy {accuracy:.2%} < 80%"
```

### 2.5 E2E Tests

```python
# test_e2e.py (Playwright / Selenium)
class TestE2E:
    def test_search_text_flow(self, page):
        page.goto("/")
        page.fill("#search-input", "Vải polyester dệt thoi")
        page.click("#search-button")
        page.wait_for_selector(".result-card")
        assert page.locator(".result-card").count() >= 1
        # Click vào kết quả → hiển thị chi tiết
        page.click(".result-card:first-child")
        assert page.locator(".tax-info").is_visible()
        assert page.locator(".hs-notes").is_visible()

    def test_clarification_flow(self, page):
        page.goto("/")
        page.fill("#search-input", "ống nhựa")
        page.click("#search-button")
        page.wait_for_selector(".clarification-panel")
        # Chọn option
        page.click(".clarification-option:first-child")
        page.click("#clarify-submit")
        page.wait_for_selector(".result-card")
```

### 2.6 Performance Tests

```yaml
# k6 load test config
scenarios:
  text_search:
    executor: ramping-vus
    startVUs: 0
    stages:
      - duration: "30s", target: 20
      - duration: "1m", target: 50
      - duration: "1m", target: 100
      - duration: "30s", target: 0
    
thresholds:
  http_req_duration:
    - "p(95)<3000"   # P95 < 3s
    - "p(99)<5000"   # P99 < 5s
  http_req_failed:
    - "rate<0.01"    # Error rate < 1%
```

---

## 3. Data Privacy & Compliance

### 3.1 Dữ liệu khách hàng

| Loại dữ liệu | Lưu trữ | Retention | Mã hóa |
|---|---|---|---|
| Search queries | PostgreSQL | 90 ngày | No (không PII) |
| Upload files | MinIO | 24h (auto-delete) | Yes (SSE) |
| User accounts | PostgreSQL | Lifetime | Yes (password bcrypt) |
| Search results | Redis cache | 24h TTL | No |

### 3.2 GDPR / PDPA Compliance

- Quyền xóa dữ liệu: API `DELETE /user/data`
- Quyền export dữ liệu: API `GET /user/data/export`
- Consent management cho file upload
- Data Processing Agreement nếu dùng third-party LLM API

---

## 4. Monitoring & Alerting

| Metric | Threshold | Alert |
|---|---|---|
| API error rate | > 5% trong 5 phút | PagerDuty |
| P95 latency | > 5s trong 5 phút | Slack |
| LLM API errors | > 10% trong 10 phút | PagerDuty |
| Vector DB health | Unhealthy > 1 phút | PagerDuty |
| Disk usage | > 80% | Slack |
| RAG accuracy (weekly) | < 75% top-3 accuracy | Email |
