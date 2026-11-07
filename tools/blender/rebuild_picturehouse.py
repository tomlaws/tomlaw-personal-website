"""One-off migration: capture approved joinery, then run the normal city pipeline."""
import sys
import traceback
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/blender'))
import validate_picturehouse as validation
import build_neighborhood
import finish_assets

try:
    if not validation.BASELINE.exists():
        bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/nocturne-source.blend'))
        validation.capture_baseline()
    build_neighborhood.build()
    finish_assets.finish()
except Exception:
    finish_assets.status('failed',error=traceback.format_exc())
    raise
