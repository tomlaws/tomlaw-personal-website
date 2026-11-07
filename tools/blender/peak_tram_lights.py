"""Author the small recessed Peak Tram light module; retain editable source.

Three.js units: 1 m long, .04 m thick, .22 m wide. Used at different scales
for ceiling lights and the low trackside guide lights, with an inset diffuser.
"""
import bpy
import bmesh
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[]

def part(name,dimensions,centre,bevel,key):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(centre[0],-centre[2],centre[1]))
    obj=bpy.context.object;obj.name=name
    obj.dimensions=(dimensions[0],dimensions[2],dimensions[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('Soft machined edges','BEVEL');mod.width=bevel;mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    assert all(edge.is_manifold for edge in bm.edges),name
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    mat=bpy.data.materials.new(name);mat.diffuse_color=(.55,.61,.60,1) if key=='housing' else (1,.8,.5,1)
    obj.data.materials.append(mat);obj['key']=key;parts.append(obj)

part('Recessed light aluminium body',(1,.04,.22),(0,0,0),.008,'housing')
part('Inset frosted light diffuser',(.92,.007,.16),(0,.022,0),.003,'lens')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/peak-tram-lights.blend'))
records=[]
for obj in parts:
    data=obj.data;data.calc_loop_triangles();p=[];n=[];indices=[];lookup={}
    for tri in data.loop_triangles:
        for vi in tri.vertices:
            v=data.vertices[vi].co;normal=tri.normal
            key=(v.x,v.z,-v.y,normal.x,normal.z,-normal.y)
            if key not in lookup:
                lookup[key]=len(p)//3;p.extend(key[:3]);n.extend(key[3:])
            indices.append(lookup[key])
    records.append({'key':obj['key'],'position':p,'normal':n,'index':indices})
(ROOT/'src/harbour/tram-light-meshes.mjs').write_text(
    '// Blender-authored light module; regenerate with tools/blender/peak_tram_lights.py.\n'
    +'export const TRAM_LIGHT_MESHES='+json.dumps(records,separators=(',',':'))+';\n',encoding='utf-8')
print('Validated closed light housing and inset diffuser; retained peak-tram-lights.blend.')
