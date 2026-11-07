"""Stylised Sing Ho Finance Building and its L-shaped rooftop display.

References: https://www.sino-offices.com/en/our-properties/sing-ho-finance-building/
https://adintime.hk/en/3581-sing-ho-finance-building.html
The display artwork is fictional and text-free; no real campaign is implied.
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, colour):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*colour, 1)
    shader.inputs['Roughness'].default_value = .55
    return m

stone = material('stone', (.78, .8, .8))
glass = material('crystal', (.29, .46, .56))
metal = material('metal', (.38, .47, .53))
screen = material('signBack', (.13, .18, .25))
cyan = material('teal', (.20, .8, .86))
pink = material('pink', (.92, .38, .62))
warm = material('warm', (1, .8, .42))

def box(name, centre, dims, finish):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(finish)
    return obj

# A slim office shaft with a continuous glazed envelope, recessed behind its
# regularly spaced structural frame. The display sits on a solid roof deck.
box('Sing Ho continuous office glazing', (0, 0, 3.17), (1.72, 1.46, 5.82), glass)
box('Sing Ho stone podium', (0, 0, .23), (1.91, 1.66, .46), stone)
box('Sing Ho roof slab', (0, 0, 6.13), (1.89, 1.63, .12), stone)
for x in (-.88, -.45, 0, .45, .88):
    for y in (-.75, .75):
        box('Sing Ho vertical pier', (x, y, 3.19), (.065, .065, 5.82), stone)
for y in (-.73, -.36, 0, .36, .73):
    for x in (-.87, .87):
        box('Sing Ho side pier', (x, y, 3.19), (.065, .065, 5.82), stone)
for level in range(1, 11):
    z=.26+level*.55
    for y in (-.75, .75):
        box('flush floor joint Sing Ho', (0, y, z), (1.76, .045, .05), stone)
    for x in (-.88, .88):
        box('flush floor joint Sing Ho', (x, 0, z), (.045, 1.48, .05), stone)

# The real screen wraps a corner, with a shorter return. The main face points
# towards the harbour and the second face wraps around the west side.
box('Sing Ho screen support plinth', (0, -.10, 6.25), (1.75, 1.10, .12), metal)
for x in (-.68, .68):
    box('Sing Ho screen steel support', (x, -.53, 6.53), (.08, .09, .50), metal)
box('Sing Ho main display housing', (0, -.67, 6.79), (1.83, .12, 1.00), metal)
box('Sing Ho main display', (0, -.738, 6.79), (1.70, .025, .87), screen)
box('Sing Ho return display housing', (-.88, -.18, 6.79), (.12, 1.00, 1.00), metal)
box('Sing Ho return display', (-.948, -.18, 6.79), (.025, .88, .87), screen)

# A fictional graphic advert with large shapes that remain legible at the
# map's small scale; it does not reproduce a real brand or campaign.
for i, (z, width, finish) in enumerate(((6.49, 1.45, cyan), (6.59, 1.18, pink), (7.07, 1.40, cyan))):
    box('Sing Ho display luminous graphic', (0, -.756, z), (width, .016, .045), finish)
box('Sing Ho display central icon', (-.28, -.762, 6.82), (.34, .018, .30), warm)
box('Sing Ho display graphic inset', (-.28, -.774, 6.82), (.20, .012, .16), screen)
for x, z, width in ((.25, 6.86, .46), (.25, 6.74, .34)):
    box('Sing Ho display accent', (x, -.760, z), (width, .016, .055), cyan)
for z, finish in ((6.49, cyan), (6.60, pink), (7.07, cyan)):
    box('Sing Ho return luminous graphic', (-.966, -.18, z), (.016, .73, .045), finish)
box('Sing Ho return display icon', (-.970, -.16, 6.82), (.018, .25, .25), warm)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/sing-ho-finance.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/hk-models/sing-ho-finance.glb'), export_format='GLB')
