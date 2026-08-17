"""OpenAI client: chat (JSON mode) + embeddings."""
import json

import numpy as np
from openai import OpenAI

from . import config

_client = None


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=config.OPENAI_API_KEY, timeout=config.OPENAI_TIMEOUT)
    return _client


def chat_json(system: str, user: str, model: str | None = None) -> dict:
    """Gọi chat model, ép trả JSON object."""
    resp = client().chat.completions.create(
        model=model or config.CHAT_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return json.loads(resp.choices[0].message.content)


def chat_json_vision(system: str, user_text: str, image_b64: str, mime: str,
                     model: str | None = None) -> dict:
    """Gọi vision model với 1 ảnh (base64), ép trả JSON object."""
    resp = client().chat.completions.create(
        model=model or config.CHAT_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": [
                {"type": "text", "text": user_text},
                {"type": "image_url",
                 "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            ]},
        ],
    )
    return json.loads(resp.choices[0].message.content)


def embed(texts: list[str], batch_size: int | None = None) -> np.ndarray:

    """Embed danh sách text -> ma trận (n, dims), đã normalize L2."""
    batch_size = batch_size or config.EMBED_BATCH_SIZE
    vecs = []
    for i in range(0, len(texts), batch_size):
        batch = [t[:8000] for t in texts[i:i + batch_size]]
        resp = client().embeddings.create(
            model=config.EMBED_MODEL,
            dimensions=config.EMBED_DIMENSIONS,
            input=batch,
            timeout=config.EMBED_TIMEOUT,
        )
        vecs.extend(d.embedding for d in resp.data)
    arr = np.asarray(vecs, dtype=np.float32)
    arr /= np.linalg.norm(arr, axis=1, keepdims=True) + 1e-9
    return arr
