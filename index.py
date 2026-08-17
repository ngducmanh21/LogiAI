"""Vercel entrypoint — import app qua absolute path để relative imports hoạt động."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.app.main import app  # noqa: E402,F401
