"""Multi-agent workflow (spec 02): Router -> HS Classifier -> Clarification/Tax-Legal -> Formatter."""
import re
import uuid

from . import config, llm
from .store import Store, normalize_terms

# ---------------------------------------------------------------- Router

HS_CODE_RE = re.compile(r"^\s*(\d{4}[\.\s]?\d{0,2}[\.\s]?\d{0,2})\s*$")

ROUTER_SYSTEM = """Bạn là Router Agent của hệ thống tra cứu mã HS Việt Nam.
Phân tích query của người dùng và trả JSON:
{
 "intent": "hs_lookup" | "product_search" | "invalid",
 "normalized_query": "<mô tả hàng hóa chuẩn hóa tiếng Việt, bổ sung từ khóa kỹ thuật nếu có thể>",
 "keywords": ["từ khóa quan trọng"],
 "reason": "ngắn gọn"
}
- "hs_lookup": query là mã HS trực tiếp.
- "product_search": query nêu tên hoặc mô tả BẤT KỲ hàng hóa/vật phẩm vật lý nào — kể cả tên ngắn gọn như động vật, thực vật, thực phẩm, nguyên liệu, máy móc (vd: "con cua", "gạo", "tôm hùm", "sắt thép"). Mọi vật phẩm hữu hình đều có thể có mã HS.
- "invalid": CHỈ khi query rõ ràng không phải hàng hóa: chào hỏi, câu hỏi kiến thức chung, dịch vụ, khái niệm trừu tượng, nội dung vô nghĩa.
- Khi nghi ngờ, ưu tiên "product_search" thay vì "invalid".
- Giữ nguyên thuật ngữ chuyên ngành; dịch tên tiếng Anh sang tiếng Việt kèm nguyên gốc."""


def route(query: str) -> dict:
    m = HS_CODE_RE.match(query)
    if m:
        return {"intent": "hs_lookup", "hs_code": re.sub(r"[^0-9]", "", m.group(1)),
                "normalized_query": query.strip(), "keywords": []}
    return llm.chat_json(ROUTER_SYSTEM, f"Query: {query}")

# ---------------------------------------------------------- HS Classifier

CLASSIFIER_SYSTEM = """Bạn là chuyên gia phân loại mã HS (HS Classification Agent) theo quy tắc GRI 1-6 của Việt Nam.
Người dùng mô tả hàng hóa; bạn nhận danh sách ứng viên mã HS 8 số từ hệ thống retrieval.
Nhiệm vụ: chọn và xếp hạng các mã phù hợp nhất, loại các mã không liên quan.

Trả JSON:
{
 "candidates": [
   {"hs_code": "8 số", "confidence": 0.0-1.0, "reasoning": "giải thích áp dụng GRI, vì sao phù hợp/tiêu chí phân biệt"}
 ],
 "need_clarification": true|false,
 "missing_info": ["thông tin còn thiếu để phân loại chính xác"]
}
Quy tắc:
- Ưu tiên hs_code trong danh sách ứng viên; nếu bạn chắc chắn có mã 8 số khác đúng hơn theo biểu thuế VN, được phép đề xuất kèm reasoning rõ ràng.
- confidence >= 0.85: gần như chắc chắn; 0.6-0.85: khả năng cao; < 0.6: không chắc.
- Nếu có >3 mã confidence gần nhau hoặc thiếu thông tin quyết định (chất liệu, công dụng, thông số) -> need_clarification=true.
- Tối đa 6 candidates, sắp theo confidence giảm dần."""


def classify(query: str, context: dict | None = None) -> dict:
    store = Store.get()
    query = normalize_terms(query)
    qvec = None
    if config.OPENAI_API_KEY:
        try:
            qvec = llm.embed([query])[0]
        except Exception:
            qvec = None
    hits = store.hybrid_search(query, qvec)
    if not hits:
        return {"candidates": [], "need_clarification": False, "missing_info": []}

    lines = []
    for h in hits:
        lines.append(f"- {h['hs_code']}: {h.get('description_full_vi') or h['description_vi']}"
                     f" (Chương {h['chapter_code']} {h.get('chapter_name') or ''})")
    ctx = f"\nBối cảnh thêm: {context}" if context else ""
    user = f"Mô tả hàng hóa: {query}{ctx}\n\nỨng viên retrieval:\n" + "\n".join(lines)
    result = llm.chat_json(CLASSIFIER_SYSTEM, user, model=config.REASONING_MODEL)

    # Chấp nhận mã ngoài retrieval nếu tồn tại thực trong biểu thuế (leaf 8 số)
    valid = []
    for c in result.get("candidates", []):
        code = re.sub(r"[^0-9]", "", str(c.get("hs_code", "")))
        r = store.by_code.get(code)
        if r and r.get("level") == 8:
            c["hs_code"] = code
            valid.append(c)
    result["candidates"] = valid[:6]
    return result

# ------------------------------------------------------- Clarification

CLARIFY_SYSTEM = """Bạn là Clarification Agent. Người dùng mô tả hàng hóa chưa đủ chi tiết để chọn 1 mã HS duy nhất.
Dựa trên các mã HS ứng viên và thông tin còn thiếu, tạo tối đa 3 câu hỏi giúp phân biệt giữa các mã.
Trả JSON:
{
 "message": "1 câu giải thích vì sao cần hỏi thêm",
 "questions": [
   {"id": "q1", "question": "...", "type": "single_choice"|"free_text",
    "options": ["..."] (chỉ khi single_choice), "placeholder": "..." (chỉ khi free_text)}
 ]
}
Câu hỏi phải cụ thể, tập trung vào tiêu chí phân biệt các mã (chất liệu, công dụng, thông số kỹ thuật, quy cách)."""


def make_clarification(query: str, candidates: list[dict], missing: list[str]) -> dict:
    store = Store.get()
    lines = []
    for c in candidates[:6]:
        r = store.by_code.get(c["hs_code"], {})
        lines.append(f"- {c['hs_code']}: {r.get('description_full_vi', '')} (confidence {c.get('confidence')})")
    user = (f"Mô tả gốc: {query}\nThiếu: {missing}\nCác mã ứng viên:\n" + "\n".join(lines))
    return llm.chat_json(CLARIFY_SYSTEM, user)

# ------------------------------------------------------- Tax & Legal (deterministic)

def tax_info(r: dict) -> dict:
    pref = {fta: f"{v['rate']}%" if str(v.get("rate", "")).replace(".", "").isdigit() else v.get("rate")
            for fta, v in (r.get("preferential_rates") or {}).items()}
    vat_raw = r.get("vat_rate_raw") or ""
    vat = f"{r['vat_rate']:g}%" if r.get("vat_rate") is not None else (vat_raw or None)
    return {
        "import_mfn": f"{r['mfn_rate']:g}%" if r.get("mfn_rate") is not None else (r.get("mfn_rate_raw") or None),
        "import_ordinary": f"{r['nk_tt_rate']:g}%" if r.get("nk_tt_rate") is not None else (r.get("nk_tt_rate_raw") or None),
        "import_preferential": pref,
        "vat": vat,
        "special_consumption_tax": r.get("ttdb_rate_raw") or None,
        "export": r.get("xk_rate_raw") or None,
        "environment_tax": r.get("bvmt_rate_raw") or None,
    }


def legal_references(r: dict) -> list[dict]:
    refs = []
    if r.get("mfn_doc"):
        refs.append({"type": "Nghị định", "number": r["mfn_doc"],
                     "title": "Biểu thuế xuất khẩu, biểu thuế nhập khẩu ưu đãi",
                     "relevant_section": f"Chương {r.get('chapter_code')}"})
    for fta, v in (r.get("preferential_rates") or {}).items():
        if v.get("doc"):
            refs.append({"type": "Nghị định", "number": v["doc"],
                         "title": f"Biểu thuế nhập khẩu ưu đãi đặc biệt {fta}",
                         "relevant_section": f"Chương {r.get('chapter_code')}"})
    return refs


def special_conditions(r: dict) -> dict:
    policy = (r.get("policy") or "").strip()
    return {
        "import_license_required": "giấy phép" in policy.lower(),
        "specialized_inspection": any(k in policy.lower() for k in ("kiểm tra", "kiểm dịch", "chất lượng")),
        "quarantine_required": "kiểm dịch" in policy.lower(),
        "notes": policy or None,
    }

# ------------------------------------------------------------ Formatter

def format_result(c: dict) -> dict:
    store = Store.get()
    r = store.by_code.get(c["hs_code"])
    if not r:
        return {}
    code = r["hs_code"]
    pretty = f"{code[:4]}.{code[4:6]}.{code[6:8]}" if len(code) == 8 else code
    return {
        "hs_code": pretty,
        "description_vi": r.get("description_full_vi") or r.get("description_vi"),
        "description_en": r.get("description_en") or None,
        "unit": r.get("unit_vi") or None,
        "confidence": c.get("confidence"),
        "reasoning": c.get("reasoning"),
        "tax_info": tax_info(r),
        "legal_references": legal_references(r),
        "hs_notes": store.notes_for(r),
        "special_conditions": special_conditions(r),
    }

# ------------------------------------------------- Legal Verify sub-agent

LEGAL_VERIFY_SYSTEM = """Bạn là Legal Verification Agent — sub-agent tự động kiểm tra pháp lý cho kết quả phân loại mã HS.
Đầu vào: mô tả hàng hóa + mã HS đã phân loại + trích đoạn văn bản luật liên quan (retrieval).
Nhiệm vụ: kiểm tra mặt hàng này khi XNK có vướng quy định gì không (cấm XNK, giấy phép, kiểm tra chuyên ngành, kiểm dịch, điều kiện, nhãn mác...).

Trả JSON:
{
 "status": "ok" | "conditional" | "restricted" | "unknown",
 "summary": "1-2 câu tiếng Việt tóm tắt kết luận kiểm tra pháp lý",
 "requirements": ["yêu cầu/điều kiện cụ thể nếu có"],
 "citations": [{"chunk_id": "...", "doc": "số hiệu văn bản", "article": "Điều N", "quote": "trích ngắn"}]
}
Quy tắc:
- "ok": không thấy quy định hạn chế trong trích đoạn; "conditional": cần giấy phép/kiểm tra/điều kiện; "restricted": thuộc diện cấm/tạm ngừng; "unknown": trích đoạn không đủ thông tin.
- CHỈ kết luận dựa trên trích đoạn; không bịa. Không nêu yêu cầu chung chung vô căn cứ."""


def legal_verify(product_desc: str, results: list[dict]) -> dict | None:
    """Tự động verify pháp lý cho kết quả HS (chạy sau classifier)."""
    store = Store.get()
    if not store.legal_chunks or not results:
        return None
    top = results[0]
    q = f"quy định nhập khẩu xuất khẩu giấy phép kiểm tra chuyên ngành cấm {product_desc} {top.get('description_vi') or ''}"
    qvec = None
    if config.OPENAI_API_KEY:
        try:
            qvec = llm.embed([q])[0]
        except Exception:
            qvec = None
    hits = store.legal_search(q, qvec, top_k=6)
    if not hits:
        return None
    blocks = []
    for h in hits:
        head = f"[{h['chunk_id']}] {h['doc_id']}"
        if h.get("article"):
            head += f" — Điều {h['article']} {h.get('article_title') or ''}"
        blocks.append(f"{head}\n{h['text'][:1800]}")
    user = (f"Hàng hóa: {product_desc}\n"
            f"Mã HS: {top.get('hs_code')} — {top.get('description_vi')}\n\n"
            "Trích đoạn văn bản luật:\n\n" + "\n\n---\n\n".join(blocks))
    try:
        result = llm.chat_json(LEGAL_VERIFY_SYSTEM, user)
    except Exception:
        return None
    valid = {h["chunk_id"]: h for h in hits}
    cites = []
    for c in result.get("citations", []):
        h = valid.get(c.get("chunk_id"))
        if h:
            c["doc_title"] = h["doc_title"]
            cites.append(c)
    return {
        "status": result.get("status", "unknown"),
        "summary": result.get("summary", ""),
        "requirements": result.get("requirements", []),
        "citations": cites,
    }

# ------------------------------------------------------- Legal QA (RAG)

LEGAL_QA_SYSTEM = """Bạn là Legal Agent của LogiAI — chuyên gia pháp luật hải quan, thuế, thương mại Việt Nam.
Người dùng hỏi về quy định pháp luật hoặc muốn kiểm tra một hành vi/lô hàng có vi phạm không.
Bạn được cung cấp các trích đoạn văn bản luật liên quan (retrieval). CHỈ trả lời dựa trên trích đoạn đó.

Trả JSON:
{
 "answer": "câu trả lời tiếng Việt, rõ ràng, trích dẫn Điều/văn bản cụ thể (markdown)",
 "compliance": "compliant" | "violation" | "risk" | "unclear" | null,
 "citations": [{"chunk_id": "...", "doc": "số hiệu văn bản", "article": "Điều N", "quote": "trích ngắn"}],
 "caveats": ["lưu ý/giới hạn của câu trả lời"]
}
Quy tắc:
- "compliance" chỉ đặt khi người dùng hỏi về tính hợp pháp/vi phạm; nếu hỏi thông tin chung -> null.
- Nếu trích đoạn không đủ để kết luận -> compliance "unclear", nói rõ thiếu gì.
- Nêu mức phạt/số tiền cụ thể nếu có trong trích đoạn.
- KHÔNG bịa quy định ngoài trích đoạn. Câu trả lời không phải tư vấn pháp lý chính thức."""


def legal_ask(question: str, context: dict | None = None) -> dict:
    store = Store.get()
    if not store.legal_chunks:
        return {"status": "no_data", "message": "Chưa có dữ liệu văn bản luật."}
    qvec = None
    if config.OPENAI_API_KEY:
        try:
            qvec = llm.embed([question])[0]
        except Exception:
            qvec = None
    hits = store.legal_search(question, qvec, top_k=8)
    if not hits:
        return {"status": "no_results",
                "message": "Không tìm thấy quy định liên quan trong kho văn bản."}

    blocks = []
    for h in hits:
        head = f"[{h['chunk_id']}] {h['doc_id']}"
        if h.get("article"):
            head += f" — Điều {h['article']} {h.get('article_title') or ''}"
        blocks.append(f"{head}\n{h['text'][:2500]}")
    ctx = f"\nBối cảnh: {context}" if context else ""
    user = f"Câu hỏi: {question}{ctx}\n\nTrích đoạn văn bản luật:\n\n" + "\n\n---\n\n".join(blocks)
    result = llm.chat_json(LEGAL_QA_SYSTEM, user, model=config.REASONING_MODEL)

    valid = {h["chunk_id"]: h for h in hits}
    cites = []
    for c in result.get("citations", []):
        h = valid.get(c.get("chunk_id"))
        if h:
            c["doc_title"] = h["doc_title"]
            c["source_file"] = h["source_file"]
            cites.append(c)
    return {
        "status": "success",
        "answer": result.get("answer", ""),
        "compliance": result.get("compliance"),
        "citations": cites,
        "caveats": result.get("caveats", []),
        "sources_searched": len(store.legal_chunks),
    }

# ----------------------------------------------- Document Extraction

DOC_EXTRACT_SYSTEM = """Bạn là Document Extraction Agent của hệ thống tra cứu mã HS Việt Nam.
Người dùng upload ảnh/chứng từ XNK (Invoice, Packing List, C/O, ảnh sản phẩm, nhãn hàng...).
Nhiệm vụ: đọc ảnh, trích xuất thông tin hàng hóa để tra mã HS.

Trả JSON:
{
 "document_type": "invoice" | "packing_list" | "product_image" | "label" | "other",
 "items": [
   {
     "description": "<mô tả hàng hóa đầy đủ, tiếng Việt, kèm nguyên gốc tiếng Anh nếu có>",
     "material": "<chất liệu nếu thấy>",
     "quantity": "<số lượng + đơn vị nếu thấy>",
     "origin": "<xuất xứ nếu thấy>",
     "declared_hs": "<mã HS ghi trên chứng từ nếu có, chỉ số>"
   }
 ],
 "raw_text": "<toàn bộ text đọc được, tóm lược>",
 "readable": true|false,
 "note": "ghi chú ngắn (chất lượng ảnh, thông tin thiếu...)"
}
Quy tắc:
- Nếu ảnh mờ/không chứa thông tin hàng hóa -> readable=false, items=[].
- Tối đa 5 items quan trọng nhất. Mô tả càng chi tiết càng tốt (tên, chất liệu, công dụng, thông số)."""


def search_file(image_b64: str, mime: str, context: dict | None = None) -> dict:
    """Luồng 2 (spec 01): upload ảnh/chứng từ -> extract -> tra mã HS từng item."""
    request_id = f"req_{uuid.uuid4().hex[:10]}"
    try:
        ext = llm.chat_json_vision(
            DOC_EXTRACT_SYSTEM,
            "Trích xuất thông tin hàng hóa từ chứng từ/ảnh này.",
            image_b64, mime, model=config.REASONING_MODEL)
    except Exception as e:
        return {"status": "error", "request_id": request_id,
                "message": f"Không đọc được file: {e}"}

    items = ext.get("items") or []
    if not ext.get("readable", True) or not items:
        return {"status": "no_results", "request_id": request_id,
                "document_type": ext.get("document_type"),
                "message": ext.get("note") or
                "Không trích xuất được thông tin hàng hóa từ ảnh. Vui lòng dùng ảnh rõ nét hơn."}

    extractions = []
    for it in items[:3]:
        desc = it.get("description") or ""
        parts = [desc]
        if it.get("material"):
            parts.append(f"chất liệu {it['material']}")
        query = ", ".join(p for p in parts if p)
        res = search_text(query, context)
        extractions.append({
            "item": it,
            "query": query,
            "search": res,
        })
    return {
        "status": "success",
        "request_id": request_id,
        "document_type": ext.get("document_type"),
        "note": ext.get("note"),
        "extractions": extractions,
    }

# ------------------------------------------------------------ Pipeline


SESSIONS: dict[str, dict] = {}          # request_id -> {query, context, loops}


def search_text(query: str, context: dict | None = None,
                request_id: str | None = None, emit=None,
                skip_router: bool = False) -> dict:
    """Pipeline chính cho /search/text và /search/clarify."""
    emit = emit or (lambda *a, **k: None)
    session = SESSIONS.get(request_id or "", {"loops": 0})
    request_id = request_id or f"req_{uuid.uuid4().hex[:10]}"

    if skip_router:
        # Vòng clarify: intent đã xác định là mô tả hàng hóa — không cần router lại
        emit("router", "skipped", "Bỏ qua — intent đã xác định từ vòng trước (mô tả hàng hóa)")
        nq = query
    else:
        emit("router", "running", "Guardrail kiểm tra truy vấn & phân loại intent (mô tả hàng hóa / mã HS / không hợp lệ)")
        routed = route(query)
        if routed.get("intent") == "invalid":
            emit("router", "done", "Truy vấn không hợp lệ — dừng pipeline")
            return {"status": "invalid_query", "request_id": request_id,
                    "message": routed.get("reason", "Query không liên quan hàng hóa XNK.")}
        if routed.get("intent") == "hs_lookup":
            emit("router", "done", f"Intent: tra cứu trực tiếp mã HS {routed['hs_code']}")
            return lookup_hs(routed["hs_code"], request_id, emit=emit)
        emit("router", "done", "Intent: mô tả hàng hóa → chuyển sang HS Classifier")
        nq = routed.get("normalized_query") or query
    emit("classifier", "running", "Truy hồi ứng viên trên 12.000+ mã HS (vector + keyword) rồi LLM phân tích, xếp hạng")
    cls = classify(nq, context)
    cands = cls.get("candidates", [])
    if not cands:
        emit("classifier", "done", "Không tìm thấy ứng viên phù hợp")
        return {"status": "no_results", "request_id": request_id,
                "message": "Không tìm thấy mã HS phù hợp. Vui lòng mô tả chi tiết hơn."}
    emit("classifier", "done",
         f"{len(cands)} ứng viên · top confidence {max((c.get('confidence') or 0) for c in cands):.0%}")

    top_conf = max((c.get("confidence") or 0) for c in cands)
    need_clarify = (cls.get("need_clarification") or len(cands) > config.CLARIFY_THRESHOLD) \
        and top_conf < 0.85
    if need_clarify and session["loops"] < config.MAX_CLARIFY_LOOPS:
        SESSIONS[request_id] = {"query": query, "context": context,
                                "loops": session["loops"] + 1}
        emit("clarify", "running", "Độ tin cậy chưa đủ — sinh câu hỏi làm rõ cho người dùng")
        clar = make_clarification(nq, cands, cls.get("missing_info", []))
        store = Store.get()
        partial = []
        for c in cands:
            r = store.by_code.get(c["hs_code"], {})
            code = c["hs_code"]
            partial.append({
                "hs_code": f"{code[:4]}.{code[4:6]}.{code[6:8]}" if len(code) == 8 else code,
                "description_vi": r.get("description_full_vi") or r.get("description_vi"),
                "confidence": c.get("confidence"),
            })
        emit("clarify", "done", f"{len(clar.get('questions', []))} câu hỏi làm rõ — chờ phản hồi người dùng")
        return {"status": "needs_clarification", "request_id": request_id,
                "partial_results": partial, "clarification": clar}

    emit("tax", "running", "Tra biểu thuế XNK 2026: MFN, VAT, ưu đãi FTA, điều kiện đặc biệt cho từng mã")
    results = [format_result(c) for c in cands[:config.MAX_RESULTS]]
    results = [r for r in results if r]
    emit("tax", "done", f"Đã gắn thuế suất & căn cứ pháp lý cho {len(results)} mã HS")
    SESSIONS.pop(request_id, None)
    emit("legal", "running", "Sub-agent pháp lý RAG đối chiếu văn bản luật XNK, kiểm tra tuân thủ")
    verification = legal_verify(nq, results)
    emit("legal", "done",
         f"Kết luận: {verification.get('status', 'không xác định')}" if verification
         else "Không có cảnh báo pháp lý bổ sung")
    return {"status": "success", "request_id": request_id, "results": results,
            "legal_verification": verification}


def clarify(request_id: str, answers: list[dict], emit=None) -> dict:
    session = SESSIONS.get(request_id)
    if not session:
        return {"status": "error", "message": "request_id không tồn tại hoặc đã hết hạn."}
    extra = "; ".join(f"{a.get('question_id', '')}: {a.get('answer', '')}" for a in answers)
    merged = f"{session['query']}. Thông tin bổ sung: {extra}"
    return search_text(merged, session.get("context"), request_id=request_id,
                       emit=emit, skip_router=True)


def lookup_hs(hs_code: str, request_id: str | None = None, emit=None) -> dict:
    emit = emit or (lambda *a, **k: None)
    store = Store.get()
    emit("tax", "running", f"Tra cứu trực tiếp mã {hs_code} trong biểu thuế XNK 2026")
    r = store.lookup(hs_code)
    request_id = request_id or f"req_{uuid.uuid4().hex[:10]}"
    if not r:
        emit("tax", "done", "Không tìm thấy mã trong biểu thuế")
        return {"status": "not_found", "request_id": request_id,
                "message": f"Không tìm thấy mã HS {hs_code}."}
    result = format_result({"hs_code": r["hs_code"], "confidence": 1.0,
                            "reasoning": "Tra cứu trực tiếp bằng mã HS."})
    emit("tax", "done", "Đã lấy thuế suất MFN/VAT/FTA và mô tả đầy đủ")
    return {"status": "success", "request_id": request_id, "result": result}
