#!/usr/bin/env python3
"""Build vector index cho HS codes (leaf 8 số) -> data/index/.

Cần OPENAI_API_KEY trong backend/.env hoặc env.
Chạy:  python scripts/build_index.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import numpy as np  # noqa: E402

from app import config, llm  # noqa: E402
from app.store import Store  # noqa: E402


def main():
    if not config.OPENAI_API_KEY:
        sys.exit("Thiếu OPENAI_API_KEY (backend/.env)")

    store = Store.get()
    config.DATA_INDEX.mkdir(parents=True, exist_ok=True)

    # HS codes
    hs_meta = config.DATA_INDEX / "hs_embeddings.meta.json"
    if hs_meta.exists() and json.loads(hs_meta.read_text()).get("count") == len(store.chunks):
        print(f"HS index đã có ({len(store.chunks)} chunks) — bỏ qua.")
    else:
        texts = [Store.chunk_text(r) for r in store.chunks]
        print(f"Embedding {len(texts)} HS chunks với model {config.EMBED_MODEL}...")
        vecs = llm.embed(texts)
        np.save(config.DATA_INDEX / "hs_embeddings.npy", vecs)
        hs_meta.write_text(json.dumps({
            "count": len(texts), "model": config.EMBED_MODEL, "dims": int(vecs.shape[1]),
        }))
        print(f"OK HS: {vecs.shape}")

    # Legal chunks
    if store.legal_chunks:
        lmeta = config.DATA_INDEX / "legal_embeddings.meta.json"
        if lmeta.exists() and json.loads(lmeta.read_text()).get("count") == len(store.legal_chunks):
            print(f"Legal index đã có ({len(store.legal_chunks)} chunks) — bỏ qua.")
        else:
            ltexts = [Store.legal_text(c) for c in store.legal_chunks]
            print(f"Embedding {len(ltexts)} legal chunks...")
            lvecs = llm.embed(ltexts)
            np.save(config.DATA_INDEX / "legal_embeddings.npy", lvecs)
            lmeta.write_text(json.dumps({
                "count": len(ltexts), "model": config.EMBED_MODEL, "dims": int(lvecs.shape[1]),
            }))
            print(f"OK Legal: {lvecs.shape}")
    print(f"Index -> {config.DATA_INDEX}")


if __name__ == "__main__":
    main()
