"""Knowledge base: load data/clean, hybrid search (vector numpy + BM25).

Index đặt tại data/index/ (tạo bởi scripts/build_index.py).
Dev-mode dùng in-process store thay cho Qdrant/Elasticsearch (spec 01) —
interface giữ nguyên nên có thể swap backend sau.
"""
import gzip
import json
import math
import re
from collections import Counter, defaultdict

import numpy as np

from . import config


# Biến thể EN <-> cách viết trong biểu thuế VN (áp dụng cho cả index lẫn query)
_SYNONYMS = {
    "polyester": "polyeste", "polyesters": "polyeste",
    "polyethylene": "polyetylen", "polypropylene": "polypropylen",
    "polyurethane": "polyurethan", "cotton": "bông",
}


def _read_jsonl(path) -> list[dict]:
    """Đọc JSONL; fallback bản .gz (serverless chỉ bundle file nén cho nhẹ)."""
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    gz = path.with_suffix(path.suffix + ".gz")
    if gz.exists():
        with gzip.open(gz, "rt", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]
    return []


def _tokenize(text: str) -> list[str]:
    toks = re.findall(r"[a-z0-9à-ỹ]+", text.lower())
    return [_SYNONYMS.get(t, t) for t in toks]


def normalize_terms(text: str) -> str:
    """Thay biến thể EN bằng thuật ngữ trong biểu thuế VN (dùng trước khi embed)."""
    def sub(m):
        return _SYNONYMS.get(m.group(0).lower(), m.group(0))
    return re.sub(r"[A-Za-z]+", sub, text)


class BM25:
    def __init__(self, docs_tokens: list[list[str]], k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.doc_len = [len(d) for d in docs_tokens]
        self.avg_len = sum(self.doc_len) / max(len(docs_tokens), 1)
        self.tf = [Counter(d) for d in docs_tokens]
        self.df = Counter()
        for d in docs_tokens:
            self.df.update(set(d))
        self.n = len(docs_tokens)
        self.inverted = defaultdict(list)
        for i, d in enumerate(docs_tokens):
            for t in set(d):
                self.inverted[t].append(i)

    def search(self, query: str, top_k: int) -> list[tuple[int, float]]:
        q = _tokenize(query)
        scores = defaultdict(float)
        for t in q:
            if t not in self.df:
                continue
            idf = math.log(1 + (self.n - self.df[t] + 0.5) / (self.df[t] + 0.5))
            for i in self.inverted[t]:
                tf = self.tf[i][t]
                denom = tf + self.k1 * (1 - self.b + self.b * self.doc_len[i] / self.avg_len)
                scores[i] += idf * tf * (self.k1 + 1) / denom
        return sorted(scores.items(), key=lambda x: -x[1])[:top_k]


class Store:
    """Singleton knowledge base."""
    _instance = None

    @classmethod
    def get(cls) -> "Store":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        # Records theo mã HS (bao gồm mọi level) + map tra cứu nhanh
        self.records: list[dict] = _read_jsonl(config.DATA_CLEAN / "hs_codes.jsonl")
        self.by_code: dict[str, dict] = {}
        for r in self.records:
            self.by_code.setdefault(r["hs_code"], r)

        # Notes chương/phần
        self.notes: list[dict] = _read_jsonl(config.DATA_CLEAN / "hs_notes.jsonl")
        self.chapter_notes = {n["chapter_code"]: n for n in self.notes
                              if n["note_for"] == "chapter" and n.get("chapter_code")}
        self.section_notes = {n["section_code"]: n for n in self.notes
                              if n["note_for"] == "section" and n.get("section_code")}

        # Chunks để search = mã HS 8 số (leaf)
        self.chunks = [r for r in self.records if r["level"] == 8]
        texts = [self.chunk_text(r) for r in self.chunks]
        self.bm25 = BM25([_tokenize(t) for t in texts])

        # Vector index (nếu đã build)
        self.embeddings = None
        emb_path = config.DATA_INDEX / "hs_embeddings.npy"
        meta_path = config.DATA_INDEX / "hs_embeddings.meta.json"
        if emb_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text())
            if meta.get("count") == len(self.chunks):
                self.embeddings = np.load(emb_path)

        # ---- Legal corpus (data/clean/legal_chunks.jsonl) ----
        self.legal_chunks: list[dict] = _read_jsonl(config.DATA_CLEAN / "legal_chunks.jsonl")
        self.legal_bm25 = BM25([_tokenize(self.legal_text(c)) for c in self.legal_chunks]) \
            if self.legal_chunks else None
        self.legal_embeddings = None
        lemb = config.DATA_INDEX / "legal_embeddings.npy"
        lmeta = config.DATA_INDEX / "legal_embeddings.meta.json"
        if lemb.exists() and lmeta.exists():
            meta = json.loads(lmeta.read_text())
            if meta.get("count") == len(self.legal_chunks):
                self.legal_embeddings = np.load(lemb)

    @staticmethod
    def chunk_text(r: dict) -> str:
        parts = [
            f"Mã HS {r['hs_code']}",
            r.get("description_full_vi") or r.get("description_vi") or "",
            r.get("description_en") or "",
            f"Chương {r.get('chapter_code')} {r.get('chapter_name') or ''}",
            r.get("section_name") or "",
        ]
        return ". ".join(p for p in parts if p)

    # ---------- search ----------
    def keyword_search(self, query: str, top_k: int) -> dict[int, float]:
        # Lấy rộng rồi re-rank: boost doc chứa token hiếm (idf cao) của query —
        # tránh chương sai thắng nhờ nhiều token phổ biến ("vải", "định lượng"...).
        hits = self.bm25.search(query, top_k * 8)
        if not hits:
            return {}
        q_tokens = set(_tokenize(query))
        rare = sorted(
            (t for t in q_tokens if t in self.bm25.df and not t.isdigit()),
            key=lambda t: self.bm25.df[t])[:3]
        rare = [t for t in rare if self.bm25.df[t] < self.bm25.n * 0.02]
        boosted = []
        for i, s in hits:
            n_rare = sum(1 for t in rare if self.bm25.tf[i].get(t))
            boosted.append((i, s * (1 + 0.6 * n_rare)))
        boosted.sort(key=lambda x: -x[1])
        boosted = boosted[:top_k]
        mx = boosted[0][1] or 1.0
        return {i: s / mx for i, s in boosted}

    def semantic_search(self, query_vec: np.ndarray, top_k: int) -> dict[int, float]:
        if self.embeddings is None:
            return {}
        sims = self.embeddings @ query_vec
        idx = np.argsort(-sims)[:top_k]
        return {int(i): float(sims[i]) for i in idx}

    def hybrid_search(self, query: str, query_vec: np.ndarray | None,
                      top_k: int | None = None) -> list[dict]:
        top_k = top_k or config.TOP_K
        kw = self.keyword_search(query, top_k)
        sem = self.semantic_search(query_vec, top_k) if query_vec is not None else {}
        alpha = config.ALPHA if sem else 0.0
        combined = defaultdict(float)
        for i, s in sem.items():
            combined[i] += alpha * s
        for i, s in kw.items():
            combined[i] += (1 - alpha) * s
        ranked = sorted(combined.items(), key=lambda x: -x[1])[:top_k]
        out = []
        for i, score in ranked:
            r = dict(self.chunks[i])
            r["_score"] = round(score, 4)
            out.append(r)
        return out

    # ---------- legal ----------
    def legal_documents(self) -> list[dict]:
        """Danh sách văn bản luật trong KB (gom theo doc_id)."""
        docs: dict[str, dict] = {}
        for c in self.legal_chunks:
            d = docs.setdefault(c["doc_id"], {
                "doc_id": c["doc_id"],
                "doc_title": c["doc_title"],
                "source_file": c.get("source_file"),
                "chunks": 0,
                "articles": set(),
            })
            d["chunks"] += 1
            if c.get("article"):
                d["articles"].add(c["article"])
        out = []
        for d in docs.values():
            d["articles"] = len(d["articles"])
            d["uploaded"] = (d.get("source_file") or "").startswith("uploads/")
            out.append(d)
        return out

    def add_legal_chunks(self, chunks: list[dict],
                         embeddings: np.ndarray | None = None) -> None:
        """Cập nhật KB in-memory với chunks mới (đã persist ra file ở caller)."""
        self.legal_chunks.extend(chunks)
        self.legal_bm25 = BM25([_tokenize(self.legal_text(c)) for c in self.legal_chunks])
        if embeddings is not None and self.legal_embeddings is not None:
            self.legal_embeddings = np.vstack([self.legal_embeddings, embeddings])
            np.save(config.DATA_INDEX / "legal_embeddings.npy", self.legal_embeddings)
            meta_path = config.DATA_INDEX / "legal_embeddings.meta.json"
            meta = json.loads(meta_path.read_text())
            meta["count"] = len(self.legal_chunks)
            meta_path.write_text(json.dumps(meta))
        else:
            # không đồng bộ được vector index -> tắt semantic cho legal, giữ BM25
            self.legal_embeddings = None

    @staticmethod
    def legal_text(c: dict) -> str:
        parts = [c["doc_title"]]
        if c.get("article"):
            parts.append(f"Điều {c['article']} {c.get('article_title') or ''}")
        parts.append(c["text"])
        return ". ".join(p for p in parts if p)

    def legal_search(self, query: str, query_vec: np.ndarray | None,
                     top_k: int | None = None) -> list[dict]:
        if not self.legal_chunks:
            return []
        top_k = top_k or config.TOP_K
        kw = {}
        hits = self.legal_bm25.search(query, top_k)
        if hits:
            mx = hits[0][1] or 1.0
            kw = {i: s / mx for i, s in hits}
        sem = {}
        if query_vec is not None and self.legal_embeddings is not None:
            sims = self.legal_embeddings @ query_vec
            idx = np.argsort(-sims)[:top_k]
            sem = {int(i): float(sims[i]) for i in idx}
        alpha = config.ALPHA if sem else 0.0
        combined = defaultdict(float)
        for i, s in sem.items():
            combined[i] += alpha * s
        for i, s in kw.items():
            combined[i] += (1 - alpha) * s
        ranked = sorted(combined.items(), key=lambda x: -x[1])[:top_k]
        out = []
        for i, score in ranked:
            c = dict(self.legal_chunks[i])
            c["_score"] = round(score, 4)
            out.append(c)
        return out

    # ---------- lookup ----------
    def lookup(self, hs_code: str) -> dict | None:
        code = re.sub(r"[^0-9]", "", hs_code)
        if code in self.by_code:
            return self.by_code[code]
        # prefix gần nhất
        for ln in range(len(code), 3, -1):
            prefix = code[:ln]
            matches = [r for r in self.chunks if r["hs_code"].startswith(prefix)]
            if matches:
                return matches[0]
        return None

    def notes_for(self, r: dict) -> dict:
        ch = self.chapter_notes.get(r.get("chapter_code") or "")
        sec = self.section_notes.get(r.get("section_code") or "")
        heading = self.by_code.get(r.get("heading_code") or "")
        return {
            "section": f"{r.get('section_code')} - {r.get('section_name')}" if r.get("section_name") else None,
            "chapter": f"{r.get('chapter_code')} - {r.get('chapter_name')}" if r.get("chapter_name") else None,
            "heading": f"{r.get('heading_code')} - {heading['description_vi']}" if heading else None,
            "section_note": (sec or {}).get("content_vi"),
            "chapter_note": (ch or {}).get("content_vi"),
        }
