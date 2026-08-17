"""Cấu hình backend LogiAI — đọc từ biến môi trường / .env"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]          # repo root
load_dotenv(ROOT / "backend" / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_TIMEOUT = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "45"))

CHAT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
REASONING_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

EMBED_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
EMBED_DIMENSIONS = int(os.getenv("OPENAI_EMBEDDING_DIMENSIONS", "1536"))
EMBED_BATCH_SIZE = int(os.getenv("OPENAI_EMBEDDING_BATCH_SIZE", "64"))
EMBED_TIMEOUT = float(os.getenv("OPENAI_EMBEDDING_TIMEOUT_SECONDS", "60"))

DATA_CLEAN = ROOT / "data" / "clean"
DATA_INDEX = ROOT / "data" / "index"

# Hybrid search
ALPHA = float(os.getenv("LOGIAI_ALPHA", "0.6"))     # trọng số semantic
TOP_K = int(os.getenv("LOGIAI_TOP_K", "20"))
MAX_RESULTS = int(os.getenv("LOGIAI_MAX_RESULTS", "5"))
CLARIFY_THRESHOLD = 3                                # > 3 ứng viên -> hỏi thêm
MAX_CLARIFY_LOOPS = 3
