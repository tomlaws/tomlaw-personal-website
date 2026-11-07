"""Small-scale interpretation of the real One Island East rooftop farm.

Source: https://www.dbs.com/newsroom/DBSHK_TheLoopOIE_EN
The positions are adapted to the miniature's existing service enclosure.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, colour):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = .72
    return m

stone = material('stone', (.68, .72, .72))
soil = material('soil', (.34, .25, .16))
leaf = material('leaf', (.3, .53, .25))
light_leaf = material('leafLight', (.45, .62, .29))

def box(name, location, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj

# The crown's plant enclosure occupies the middle; the beds sit on the
# adjoining roof, below the existing tall screen. No signage is invented.
for side in (-1, 1):
    x = side * .68
    for y in (-.48, .34):
        box('OIE rooftop farm raised bed', (x, y, 10.49), (.24, .52, .10), stone)
        box('OIE rooftop farm soil', (x, y, 10.547), (.20, .47, .018), soil)
        for row in (-.14, 0, .14):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(x, y+row, 10.59))
            plant = bpy.context.object
            plant.name = 'OIE rooftop farm crop'
            plant.scale = (.065, .075, .055)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            plant.data.materials.append(leaf if row else light_leaf)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/one-island-east-garden.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/hk-models/one-island-east-garden.glb'), export_format='GLB')
