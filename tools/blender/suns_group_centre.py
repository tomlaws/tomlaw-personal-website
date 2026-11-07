"""Stylised Sun's Group Centre and its wide rooftop LED display.

References: https://adintime.hk/en/3577-the-suns-group-centre-led-display.html
https://www.tourism.gov.hk/symphony/english/participating/participating_hk.html
Artwork is a fictional text-free composition, adapted to miniature scale.
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, colour):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=(*colour,1)
    shader.inputs['Roughness'].default_value=.55
    return m

stone=material('stone',(.78,.80,.80))
glass=material('crystal',(.29,.46,.56))
metal=material('metal',(.38,.47,.53))
screen=material('signBack',(.13,.18,.25))
cyan=material('teal',(.20,.8,.86))
pink=material('pink',(.92,.38,.62))
warm=material('warm',(1,.8,.42))

def box(name, centre, dims, finish):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(finish)
    return obj

# The continuous glazed office block has broad vertical piers and a low,
# solid podium. Floor joints retain the established day/night glazing system.
box('Suns Group continuous office glazing',(0,0,2.64),(1.98,1.48,4.82),glass)
box('Suns Group street podium',(0,0,.22),(2.12,1.66,.44),stone)
box('Suns Group roof slab',(0,0,5.12),(2.13,1.64,.14),stone)
for x in (-1.01,-.51,0,.51,1.01):
    for y in (-.76,.76):box('Suns Group facade pier',(x,y,2.65),(.065,.065,4.82),metal)
for y in (-.74,-.37,0,.37,.74):
    for x in (-1.01,1.01):box('Suns Group side pier',(x,y,2.65),(.065,.065,4.82),metal)
for floor in range(1,9):
    z=.25+floor*.53
    for y in (-.76,.76):box('flush floor joint Suns Group',(0,y,z),(2.02,.045,.045),stone)
    for x in (-1.01,1.01):box('flush floor joint Suns Group',(x,0,z),(.045,1.50,.045),stone)

# The real display is a broad, shallow L-shaped LED band. Its graphic is
# deliberately different from Sing Ho's taller board, with no real brand text.
box('Suns Group screen rooftop support',(0,-.12,5.22),(1.96,1.10,.12),metal)
for x in (-.75,.75):box('Suns Group screen upright',(x,-.55,5.45),(.07,.09,.42),metal)
box('Suns Group main screen housing',(0,-.68,5.56),(2.13,.13,.55),metal)
box('Suns Group main screen', (0,-.755,5.56),(2.02,.025,.44),screen)
box('Suns Group return screen housing',(-1.01,-.17,5.56),(.13,1.02,.55),metal)
box('Suns Group return screen',(-1.085,-.17,5.56),(.025,.91,.44),screen)
for z,finish in ((5.38,pink),(5.73,cyan)):
    box('Suns Group luminous border',(0,-.774,z),(1.94,.014,.035),finish)
    box('Suns Group return luminous border',(-1.104,-.17,z),(.014,.83,.035),finish)
for x,width,finish in ((-.58,.37,warm),(-.10,.33,cyan),(.40,.48,pink)):
    box('Suns Group advertising graphic',(x,-.777,5.56),(width,.016,.21),finish)
box('Suns Group return graphic',(-1.108,-.17,5.56),(.016,.44,.20),warm)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/suns-group-centre.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/hk-models/suns-group-centre.glb'),export_format='GLB')
