"""Rebuild editable sources and all browser assets through the normal pipeline."""
import sys
import traceback
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_neighborhood
import finish_assets

try:
    build_neighborhood.build()
    finish_assets.finish()
except Exception:
    finish_assets.status('failed',error=traceback.format_exc())
    raise
