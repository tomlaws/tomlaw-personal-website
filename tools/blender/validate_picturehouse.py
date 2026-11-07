"""Continuous cinema envelope and retained entrance regression checks."""
import hashlib
import json
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
BASELINE=ROOT/'assets/validation/picturehouse-entrance-baseline.json'
KEPT=('Cinema entrance','Cinema curved ticket','Cinema polished counter',
      'Cinema counter','Cinema ticket','Cinema terminal','Cinema popcorn',
      'Cinema lobby','Cinema foyer poster','Cinema pavement poster',
      'Cinema faceted marquee','Cinema marquee ivory','Cinema continuous marquee',
      'Cinema marquee ceiling','Cinema recessed canopy')


def entrance_fingerprint():
    graph=bpy.context.evaluated_depsgraph_get();graph.update()
    result={}
    for obj in bpy.data.collections['02 · Loop picturehouse'].objects:
        if obj.type not in {'MESH','CURVE','FONT'} or not obj.name.startswith(KEPT):continue
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        vertices=sorted(tuple(round(v,5) for v in obj.matrix_world@p.co) for p in mesh.vertices)
        result[obj.name]=hashlib.sha256(json.dumps(vertices).encode()).hexdigest()
        evaluated.to_mesh_clear()
    return result


def capture_baseline():
    assert not BASELINE.exists(),'Do not overwrite the approved entrance baseline'
    BASELINE.write_text(json.dumps(entrance_fingerprint(),indent=2))


def verify(graph):
    assert entrance_fingerprint()==json.loads(BASELINE.read_text()),'Approved cinema entrance or canopy changed'
    obj=bpy.data.objects['Cinema continuous rounded masonry shell']
    bm=bmesh.new();bm.from_mesh(obj.data)
    assert all(e.is_manifold for e in bm.edges),'Cinema shell contains open cracks'
    unseen=set(bm.verts);components=0
    while unseen:
        components+=1;stack=[unseen.pop()]
        while stack:
            for edge in stack.pop().link_edges:
                for vert in edge.verts:
                    if vert in unseen:unseen.remove(vert);stack.append(vert)
    assert components==1,'Cinema walls must form one connected envelope'
    assert bm.calc_volume(signed=True)>0,'Cinema shell normals must face out'
    bm.free()
    shell=obj.evaluated_get(graph)
    hit,_,_,_=shell.ray_cast(Vector((6.5,5.5,9.3)),Vector((0,-1,0)),distance=.7)
    assert hit,'Roof recess must not remove the back of the sign tower'
    # Sightlines pass through real openings, rather than windows over solid walls.
    for origin,direction in [((11.65,2.3,6.5),(0,1,0)),((12.75,2.3,2.5),(0,1,0)),((16.8,8.2,5.9),(-1,0,0))]:
        hit,point,_,_=shell.ray_cast(Vector(origin),Vector(direction),distance=.9)
        assert not hit,'Masonry obstructs a glazed opening'
    for x in [5.7,7.6,8.4,11.65,15.65]:
        for z in [4.48,4.75,7.65,8.1]:
            hit,_,_,_=shell.ray_cast(Vector((x,2.2,z)),Vector((0,1,0)),distance=1.5)
            assert hit,'Unexpected gap in the front masonry'
    coping=bpy.data.objects['Cinema continuous parapet coping'].evaluated_get(graph)
    hit,_,_,_=coping.ray_cast(Vector((7.99,3.12,9)),Vector((0,0,-1)),distance=.5)
    assert hit,'Roof coping ends short of the integrated sign tower'
    assert not any(o.name.startswith(('Cinema facade fluted','Cinema pylon rounded','Cinema oculus','Outdoor stool','Stool pedestal','Stool foot')) for o in bpy.data.objects)
    return {'connectedClosedShell':True,'realDoorAndWindowOpenings':True,
            'entranceAndCanopyObjectsPreserved':len(entrance_fingerprint()),'teaOutdoorStoolsRemoved':True}


if __name__=='__main__':
    print('PICTUREHOUSE_CHECKS '+json.dumps(verify(bpy.context.evaluated_depsgraph_get())))
