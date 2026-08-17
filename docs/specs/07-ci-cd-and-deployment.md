# 07 — CI/CD & Deployment

> Pipeline triển khai, containerization, và chiến lược deploy

---

## 1. CI/CD Pipeline (GitHub Actions)

```
┌──────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Push │──▶│  Lint &  │──▶│  Unit   │──▶│  Build   │──▶│ Deploy   │
│      │   │  Format  │   │  Tests  │   │  Docker  │   │ Staging  │
└──────┘   └──────────┘   └──────────┘   └──────────┘   └────┬─────┘
                                                              │
                                                    ┌─────────▼────────┐
                                                    │ Integration Test │
                                                    └─────────┬────────┘
                                                              │ (manual approve)
                                                    ┌─────────▼────────┐
                                                    │ Deploy Production│
                                                    └──────────────────┘
```

### 1.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install ruff mypy
      - run: ruff check backend/
      - run: mypy backend/ --ignore-missing-imports

  test-backend:
    needs: lint
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: logiai_test, POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r backend/requirements.txt
      - run: pytest backend/tests/ -v --cov=backend --cov-report=xml
      - uses: codecov/codecov-action@v4

  test-frontend:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: cd frontend && npm ci && npm test && npm run build

  build-and-push:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ghcr.io/${{ github.repository }}/frontend:${{ github.sha }}

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: |
          ssh deploy@staging "cd /app && docker compose pull && docker compose up -d"

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # requires manual approval
    steps:
      - run: |
          ssh deploy@prod "cd /app && docker compose pull && docker compose up -d"
```

---

## 2. Docker Configuration

### 2.1 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-vie && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 2.2 Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### 2.3 Docker Compose

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis, qdrant, elasticsearch]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000

  postgres:
    image: postgres:16
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: logiai
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  qdrant:
    image: qdrant/qdrant:latest
    volumes: [qdrant_data:/qdrant/storage]
    ports: ["6333:6333"]

  elasticsearch:
    image: elasticsearch:8.15.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes: [es_data:/usr/share/elasticsearch/data]
    ports: ["9200:9200"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [minio_data:/data]
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}

  # Monitoring
  prometheus:
    image: prom/prometheus
    volumes: [./infra/prometheus.yml:/etc/prometheus/prometheus.yml]
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana
    volumes: [grafana_data:/var/lib/grafana]
    ports: ["3001:3000"]

volumes:
  postgres_data:
  qdrant_data:
  es_data:
  minio_data:
  grafana_data:
```

---

## 3. Environment Configuration

```bash
# .env.example
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=logiai
DB_PASSWORD=change_me

# Redis
REDIS_URL=redis://redis:6379/0

# Vector DB
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# Elasticsearch
ES_HOST=elasticsearch
ES_PORT=9200

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Object Storage
MINIO_ENDPOINT=minio:9000
MINIO_USER=minioadmin
MINIO_PASSWORD=change_me

# Auth
JWT_SECRET=change_me
JWT_EXPIRY_HOURS=24

# App
LOG_LEVEL=INFO
ENVIRONMENT=development
```

---

## 4. Production Deployment (Kubernetes)

### 4.1 Namespace & Resources

```yaml
# k8s/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: logiai

---
# k8s/backend-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: logiai
spec:
  replicas: 2
  selector:
    matchLabels: { app: backend }
  template:
    metadata:
      labels: { app: backend }
    spec:
      containers:
        - name: backend
          image: ghcr.io/org/logiai/backend:latest
          ports: [{ containerPort: 8000 }]
          resources:
            requests: { cpu: "500m", memory: "1Gi" }
            limits: { cpu: "2000m", memory: "4Gi" }
          livenessProbe:
            httpGet: { path: /health, port: 8000 }
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: /health/ready, port: 8000 }
            periodSeconds: 10
          envFrom:
            - secretRef: { name: logiai-secrets }
```

### 4.2 Deployment Strategy

| Environment | Strategy | Rollback |
|---|---|---|
| Staging | Rolling update | Automatic |
| Production | Blue-green (manual approve) | Instant switch |

---

## 5. Infrastructure as Code

```
infra/
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production overrides
├── prometheus.yml              # Prometheus config
├── grafana/
│   └── dashboards/             # Pre-configured dashboards
├── k8s/                        # Kubernetes manifests
│   ├── namespace.yml
│   ├── backend-deployment.yml
│   ├── frontend-deployment.yml
│   ├── ingress.yml
│   └── secrets.yml
└── terraform/                  # Cloud infrastructure (Phase 3)
    ├── main.tf
    ├── rds.tf                  # PostgreSQL managed
    ├── elasticache.tf          # Redis managed
    └── eks.tf                  # Kubernetes cluster
```
