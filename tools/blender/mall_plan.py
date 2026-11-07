"""Single source of truth for the Galleria plan frame.

The footprint, levels, atrium and lift come from src/mallConfig.json, which the
React runtime and the area-light shader read as well, so the Blender modules and
the shipped shading cannot drift apart. Dimensions are metres.
"""
import json
from pathlib import Path

CONFIG=json.loads((Path(__file__).resolve().parents[2]/'src/mallConfig.json').read_text())
PLAN=CONFIG['plan']
CX,CY=PLAN['cx'],PLAN['cy']
HALF_X,HALF_Y=PLAN['halfX'],PLAN['halfY']
WEST,EAST=CX-HALF_X,CX+HALF_X
SOUTH,NORTH=CY-HALF_Y,CY+HALF_Y
CORNER,FACE=PLAN['corner'],PLAN['face']
FLOORS=CONFIG['floors']
GROUND,GALLERY,LIBRARY=FLOORS
ROOF=CONFIG['roof']
# Every storey keeps the same 4.16 m structural height and 3.52 m clear room.
CEILING={floor:floor+3.52 for floor in FLOORS}
ATRIUM=CONFIG['atrium']
BRIDGE=CONFIG['gallery']
ESC=CONFIG['escalator']
LIFT=CONFIG['lift']
SCREENS=CONFIG['screens']
FLOOR_USES=CONFIG['floorUses']
FRONT_Y=SOUTH+FACE
REAR_Y=NORTH-FACE
WEST_X=WEST+FACE
EAST_X=EAST-FACE
