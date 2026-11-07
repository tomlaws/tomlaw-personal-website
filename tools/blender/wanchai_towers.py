"""Build stylised Wan Chai landmarks in the existing map's local coordinates.

Central Plaza: https://www.skyscrapercenter.com/building/building/277
Great Eagle Centre: https://www.greateagle.com.hk/contact-us
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Metallic'].default_value = .25
    bsdf.inputs['Roughness'].default_value = .35
    return m

def box(name, centre, dims, material, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    o=bpy.context.object; o.name=name; o.dimensions=dims; o.rotation_euler.z=angle
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o

def beam(name, a, b, width, depth, material):
    a,b=Vector(a),Vector(b)
    mid=(a+b)*.5; length=(b-a).length
    o=box(name,mid,(width,depth,length),material)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    return o

def prism(name, points, low, high, material, top_points=None):
    top_points = top_points or points
    vertices=[(x,y,low) for x,y in points]+[(x,y,high) for x,y in top_points]
    n=len(points)
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    return o

def export(name):
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender'/f'{name}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/hk-models'/f'{name}.glb'),export_format='GLB')

reset()
glass=mat('crystal',(.31,.42,.47)); stone=mat('stone',(.78,.79,.74))
metal=mat('metal',(.62,.68,.70)); warm=mat('warm',(1,.72,.36))
# Truncated triangular plan: the three long sides are glazed, while the
# clipped corners become the vertical structural piers seen on the real tower.
points=[(-.94,-.50),(-.72,-.82),(.72,-.82),(.94,-.50),(.20,.88),(-.20,.88)]
prism('Central Plaza continuous glass envelope',points,.38,12.30,glass)
prism('Central Plaza stone entrance podium',[(x*1.06,y*1.06) for x,y in points],0,.38,stone)
for i,(x,y) in enumerate(points):
    beam('Central Plaza corner pier',(x,y,.38),(x,y,12.30),.07,.07,metal)
for floor in range(1,14):
    z=.38+floor*(11.92/14)
    for i,(x,y) in enumerate(points):
        x2,y2=points[(i+1)%len(points)]
        beam('flush floor joint Central Plaza',(x,y,z),(x2,y2,z),.035,.035,stone)
for i,(x,y) in enumerate(points):
    x2,y2=points[(i+1)%len(points)]
    if math.hypot(x2-x,y2-y)<.65: continue
    for u in (.25,.5,.75):
        px=x+(x2-x)*u;py=y+(y2-y)*u
        beam('Central Plaza facade mullion',(px,py,.40),(px,py,12.30),.026,.026,metal)
# A stepped triangular crown and central mast; four luminous clock bars.
for bottom,top,scale1,scale2 in [(12.30,12.64,1,.84),(12.64,12.97,.84,.66),(12.97,13.25,.66,.47)]:
    prism('Central Plaza stepped crown',[(x*scale1,y*scale1) for x,y in points],bottom,top,stone,[(x*scale2,y*scale2) for x,y in points])
beam('Central Plaza central mast',(0,0,13.15),(0,0,14.55),.055,.055,metal)
for j in range(4):
    box('Central Plaza clock light', (0,-.035,13.34+j*.245),(.15,.13,.13),warm)
export('central-plaza')

reset()
glass=mat('crystal',(.24,.36,.43));stone=mat('stone',(.78,.79,.75));metal=mat('metal',(.40,.47,.51))
# A single continuous office shaft with regularly spaced dark piers and
# recessed-looking glazing, rather than separate stacked floor blocks.
box('Great Eagle continuous glazed shaft',(0,0,3.12),(1.92,1.70,5.70),glass)
box('Great Eagle street podium',(0,0,.23),(2.12,1.90,.46),stone)
box('Great Eagle roof cap',(0,0,6.02),(2.02,1.80,.12),stone)
for x in (-.94,-.48,0,.48,.94):
    for y in (-.86,.86):box('Great Eagle vertical facade pier',(x,y,3.12),(.07,.07,5.70),metal)
for y in (-.85,-.42,0,.42,.85):
    for x in (-.97,.97):box('Great Eagle side facade pier',(x,y,3.12),(.07,.07,5.70),metal)
for floor in range(1,10):
    z=.27+floor*.57
    for y in (-.86,.86):box('flush floor joint Great Eagle',(0,y,z),(1.92,.04,.04),stone)
    for x in (-.97,.97):box('flush floor joint Great Eagle',(x,0,z),(.04,1.70,.04),stone)
box('Great Eagle rooftop plant housing',(0,0,6.16),(.70,.70,.18),metal)
export('great-eagle-centre')
