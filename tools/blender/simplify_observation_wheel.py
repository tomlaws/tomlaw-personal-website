"""Blender-authored, small-screen observation-wheel frame. Keeps the cabin source.

Run Blender --background --python tools/blender/simplify_observation_wheel.py.
"""
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
RADIUS=2.10


def main():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/blender/observation-wheel-edit-base.glb'))
    for obj in list(bpy.data.objects):
        if obj.name.startswith('Twin rims, spokes and cross braces'):
            bpy.data.objects.remove(obj,do_unlink=True)
    parts=[]
    metal=bpy.data.materials.get('Wheel pearl-white metal')

    def finish(name,vertices,faces,light,smooth=False):
        data=bpy.data.meshes.new(name)
        data.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces)
        bm=bmesh.new();bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        assert all(edge.is_manifold for edge in bm.edges),name
        bm.to_mesh(data);bm.free();data.update()
        for polygon in data.polygons:polygon.use_smooth=smooth
        data.materials.append(metal)
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
        obj['nightRadiance']=light;parts.append(obj)
        return obj

    def tube(name,a,b,r,light,segments=8):
        start,end=Vector(a),Vector(b);axis=(end-start).normalized()
        helper=Vector((0,0,1)) if abs(axis.z)<.9 else Vector((0,1,0))
        u=axis.cross(helper).normalized();v=axis.cross(u).normalized()
        vertices=[tuple(point+(u*math.cos(i/segments*math.tau)+v*math.sin(i/segments*math.tau))*r)
                  for point in [start,end] for i in range(segments)]
        faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]
        faces += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
        finish(name,vertices,faces,light)

    for depth in [-.15,.15]:
        major,minor=96,8;vertices=[]
        for i in range(major):
            a=i/major*math.tau
            for j in range(minor):
                b=j/minor*math.tau;r=RADIUS+.040*math.cos(b)
                vertices.append((r*math.cos(a),r*math.sin(a),depth+.040*math.sin(b)))
        faces=[]
        for i in range(major):
            for j in range(minor):
                faces.append((i*minor+j,((i+1)%major)*minor+j,
                              ((i+1)%major)*minor+(j+1)%minor,i*minor+(j+1)%minor))
        finish('Observation Wheel luminous outer rim',vertices,faces,1.10,True)
        for i in range(8):
            a=i/8*math.tau
            tube('Observation Wheel primary spoke',(0,0,depth),
                 (RADIUS*math.cos(a),RADIUS*math.sin(a),depth),.027,.60)
    for i in range(16):
        a=i/16*math.tau;x,y=RADIUS*math.cos(a),RADIUS*math.sin(a)
        tube('Observation Wheel cabin axle',(x,y,-.18),(x,y,.18),.024,.30)
    tube('Observation Wheel plain central hub',(0,0,-.22),(0,0,.22),.18,0,24)
    # Compact, tilted floodlights on the existing wheel footing. They stay fixed
    # while the rim rotates, clear of the four structural support feet.
    def flood_box(name,centre,dimensions,direction,key,light=0):
        q=Vector((0,1,0)).rotation_difference(Vector(direction).normalized())
        vertices=[tuple(Vector(centre)+q@Vector((sx*dimensions[0]/2,sy*dimensions[1]/2,sz*dimensions[2]/2)))
                  for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        obj=finish(name,vertices,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],light)
        obj['stationary']=True;obj['key']=key
    for side in [-1,1]:
        x=side*.53;direction=(side*.22,1,-.15)
        flood_box('Wheel uplight pedestal',(x,-2.545,.48),(.16,.05,.15),(0,1,0),'housing')
        flood_box('Wheel uplight housing',(x,-2.465,.48),(.24,.085,.20),direction,'housing')
        normal=Vector(direction).normalized();centre=Vector((x,-2.465,.48))+normal*.046
        flood_box('Wheel uplight optical lens',centre,(.185,.009,.145),direction,'lens',.45)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/observation-wheel.blend'))
    records=[]
    for obj in parts:
        data=obj.data;data.calc_loop_triangles()
        position=[];normal=[];indices=[];lookup={}
        for triangle in data.loop_triangles:
            smooth=data.polygons[triangle.polygon_index].use_smooth
            for vi in triangle.vertices:
                vertex=data.vertices[vi];n=vertex.normal if smooth else triangle.normal
                p=vertex.co;key=(p.x,p.z,-p.y,n.x,n.z,-n.y)
                if key not in lookup:
                    lookup[key]=len(position)//3;position.extend(key[:3]);normal.extend(key[3:])
                indices.append(lookup[key])
        records.append({'name':obj.name,'position':position,'normal':normal,'index':indices,'light':obj['nightRadiance'],
                        'stationary':bool(obj.get('stationary',False)),'key':obj.get('key','frame')})
    output='// Blender-authored wheel frame; regenerate with tools/blender/simplify_observation_wheel.py.\n'
    output+='export const WHEEL_FRAME='+json.dumps(records,separators=(',',':'))+';\n'
    (ROOT/'src/harbour/wheel-frame-meshes.mjs').write_text(output,encoding='utf-8')
    print('Authored two thicker rims, eight paired spokes and 16 cabin axles; manifold frame meshes.')


if __name__=='__main__':main()
