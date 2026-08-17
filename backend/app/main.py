"""FastAPI app — LogiAI HS Code search API (spec 03)."""
import base64
import json
import queue
import threading
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import agents, config, legal_ingest
from .store import Store

app = FastAPI(title="LogiAI API", version="0.1.0")


@app.middleware("http")
async def _strip_proxy_prefix(request, call_next):
    # Vercel rewrite forwards the full path /api/backend/v1/... — strip the prefix.
    path = request.scope.get("path", "")
    if path.startswith("/api/backend"):
        request.scope["path"] = path[len("/api/backend"):] or "/"
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchTextRequest(BaseModel):
    query: str
    context: dict | None = None
    options: dict | None = None


class ClarifyRequest(BaseModel):
    request_id: str
    answers: list[dict]


class LegalAskRequest(BaseModel):
    question: str
    context: dict | None = None


@app.on_event("startup")
def _warm():
    Store.get()


@app.get("/v1/health")
def health():
    store = Store.get()
    return {
        "status": "ok",
        "hs_leaf_codes": len(store.chunks),
        "vector_index": store.embeddings is not None,
        "legal_chunks": len(store.legal_chunks),
        "legal_vector_index": store.legal_embeddings is not None,
        "llm_configured": bool(config.OPENAI_API_KEY),
    }


@app.post("/v1/search/text")
def search_text(req: SearchTextRequest):
    t0 = time.time()
    out = agents.search_text(req.query, req.context)
    out["metadata"] = {"search_time_ms": int((time.time() - t0) * 1000),
                       "data_version": "2026-04-05"}
    return out


def _stream_pipeline(run):
    """Chạy pipeline trong thread, stream NDJSON: agent events + final result."""
    q: queue.Queue = queue.Queue()

    def emit(agent: str, status: str, detail: str = ""):
        q.put({"type": "agent", "agent": agent, "status": status,
               "detail": detail, "ts": time.time()})

    def worker():
        t0 = time.time()
        try:
            out = run(emit)
            out["metadata"] = {"search_time_ms": int((time.time() - t0) * 1000),
                               "data_version": "2026-04-05"}
            q.put({"type": "result", "data": out})
        except Exception as e:
            q.put({"type": "result",
                   "data": {"status": "error", "message": f"Lỗi hệ thống: {e}"}})
        q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    def gen():
        while True:
            item = q.get()
            if item is None:
                break
            yield json.dumps(item, ensure_ascii=False) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


@app.post("/v1/search/text/stream")
def search_text_stream(req: SearchTextRequest):
    return _stream_pipeline(lambda emit: agents.search_text(req.query, req.context, emit=emit))


@app.post("/v1/search/clarify/stream")
def search_clarify_stream(req: ClarifyRequest):
    return _stream_pipeline(lambda emit: agents.clarify(req.request_id, req.answers, emit=emit))


@app.post("/v1/search/clarify")
def search_clarify(req: ClarifyRequest):
    t0 = time.time()
    out = agents.clarify(req.request_id, req.answers)
    out["metadata"] = {"search_time_ms": int((time.time() - t0) * 1000),
                       "data_version": "2026-04-05"}
    return out


@app.get("/v1/search/hs/{hs_code}")
def search_hs(hs_code: str):
    return agents.lookup_hs(hs_code)


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@app.post("/v1/search/file")
async def search_file(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(415, f"Chỉ hỗ trợ ảnh {sorted(ALLOWED_IMAGE_TYPES)}. "
                                 "PDF/Excel sẽ hỗ trợ ở phase sau.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File quá lớn (tối đa 10MB).")
    t0 = time.time()
    b64 = base64.b64encode(data).decode()
    out = agents.search_file(b64, file.content_type)
    out["metadata"] = {"search_time_ms": int((time.time() - t0) * 1000),
                       "data_version": "2026-04-05", "filename": file.filename}
    return out


@app.post("/v1/legal/ask")
def legal_ask(req: LegalAskRequest):
    t0 = time.time()
    out = agents.legal_ask(req.question, req.context)
    out["metadata"] = {"search_time_ms": int((time.time() - t0) * 1000)}
    return out


@app.get("/v1/legal/documents")
def legal_documents():
    store = Store.get()
    docs = sorted(store.legal_documents(), key=lambda d: d["doc_title"])
    return {"documents": docs, "total_chunks": len(store.legal_chunks),
            "vector_index": store.legal_embeddings is not None}


@app.get("/v1/legal/documents/{doc_id}")
def legal_document_detail(doc_id: str):
    """Toàn văn văn bản: ghép các chunks theo thứ tự, nhóm theo Điều."""
    store = Store.get()
    chunks = sorted(
        (c for c in store.legal_chunks if c["doc_id"] == doc_id),
        key=lambda c: c["chunk_id"],
    )
    if not chunks:
        raise HTTPException(404, f"Không tìm thấy văn bản '{doc_id}'.")
    sections = []
    for c in chunks:
        if sections and sections[-1]["article"] == c.get("article"):
            sections[-1]["text"] += "\n" + c["text"]
        else:
            sections.append({
                "article": c.get("article"),
                "article_title": c.get("article_title"),
                "text": c["text"],
            })
    return {
        "doc_id": doc_id,
        "doc_title": chunks[0]["doc_title"],
        "source_file": chunks[0].get("source_file"),
        "chunks": len(chunks),
        "sections": sections,
    }


LEGAL_UPLOAD_EXTS = (".pdf", ".docx")
MAX_LEGAL_UPLOAD_BYTES = 30 * 1024 * 1024


@app.post("/v1/legal/documents")
async def legal_upload(file: UploadFile = File(...)):
    name = file.filename or "document"
    if not name.lower().endswith(LEGAL_UPLOAD_EXTS):
        raise HTTPException(415, "Chỉ hỗ trợ PDF hoặc DOCX.")
    data = await file.read()
    if len(data) > MAX_LEGAL_UPLOAD_BYTES:
        raise HTTPException(413, "File quá lớn (tối đa 30MB).")

    store = Store.get()
    doc_id = legal_ingest.make_doc_id(name)
    if any(c["doc_id"] == doc_id for c in store.legal_chunks):
        raise HTTPException(409, f"Văn bản '{doc_id}' đã có trong knowledge base.")

    try:
        chunks = legal_ingest.ingest(data, name)
    except ValueError as e:
        raise HTTPException(422, str(e))

    # Lưu file gốc + append chunks
    upload_dir = config.ROOT / "data" / "Law" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / name).write_bytes(data)
    legal_ingest.persist_chunks(chunks)

    # Embed chunks mới (nếu có API key) để giữ semantic search
    embeddings = None
    if config.OPENAI_API_KEY and store.legal_embeddings is not None:
        try:
            from . import llm
            from .store import normalize_terms
            texts = [normalize_terms(Store.legal_text(c)) for c in chunks]
            embeddings = llm.embed(texts)
        except Exception:
            embeddings = None
    store.add_legal_chunks(chunks, embeddings)

    return {
        "status": "ok",
        "doc_id": doc_id,
        "doc_title": name,
        "chunks_added": len(chunks),
        "vector_index": store.legal_embeddings is not None,
        "total_chunks": len(store.legal_chunks),
    }


# Frontend tĩnh (chỉ mount khi tồn tại — trên Vercel, frontend là service riêng)
_frontend_dir = config.ROOT / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
