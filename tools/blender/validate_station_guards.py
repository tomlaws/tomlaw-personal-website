"""Probe the actual exported guard surfaces along exposed floor boundaries.

Independent of the guard builder's paths/metadata: these boundaries describe
the walking surfaces. Missing panels, unjoined corners and blocked entrances
must fail even if the builder still reports that it created a guard.
"""
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from cartoon_station import PLATFORM, FRONT, EDGE


def verify_station_guards(graph):
    vertices=[];faces=[];caps=[];cap_faces=[]
    objects=[o for o in bpy.data.objects if o.get('stationGuard')]
    assert objects,'Station guards are missing'
    for obj in objects:
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        target,polys=(caps,cap_faces) if obj.get('guardPart')=='cap' else (vertices,faces)
        offset=len(target)
        target.extend(tuple(obj.matrix_world@v.co) for v in mesh.vertices)
        polys.extend(tuple(offset+i for i in p.vertices) for p in mesh.polygons)
        evaluated.to_mesh_clear()
    infill=BVHTree.FromPolygons(vertices,faces)
    cap=BVHTree.FromPolygons(caps,cap_faces)
    mid=(PLATFORM+.8)/2
    boundaries=[]
    # Both sides of each flight, plus every exposed side of the turn landing.
    for y in [17.82,19.38]:boundaries.append([(-13.9,y,.8),(-20.1,y,mid)])
    for y in [19.72,21.28]:boundaries.append([(-20.1,y,mid),(-13.9,y,PLATFORM)])
    boundaries.extend([
        [(-20.1,17.79,mid),(-21.5,17.79,mid),(-21.5,21.31,mid),(-20.1,21.31,mid)],
        [(-20.1,19.38,mid),(-20.1,19.72,mid)],
        [(-13.9,19.69,PLATFORM),(-12.5,19.69,PLATFORM),(-12.5,FRONT,PLATFORM)],
        [(-12.5,FRONT,PLATFORM),(8.56,FRONT,PLATFORM)],
        [(10.44,FRONT,PLATFORM),(13,FRONT,PLATFORM)],
        [(-13.9,21.28,PLATFORM),(-13.9,21.31,PLATFORM),(-13.8,22,PLATFORM),(-13.8,EDGE-.8,PLATFORM)],
        [(13.8,FRONT+.8,PLATFORM),(13.8,EDGE-.8,PLATFORM)],
        [(-13,EDGE,PLATFORM),(13,EDGE,PLATFORM)],
    ])
    for x,y,a,c in [(-13,EDGE-.8,180,90),(13,EDGE-.8,90,0),(13,FRONT+.8,0,-90)]:
        boundaries.append([(x+.8*math.cos(math.radians(a+(c-a)*i/24)),
                            y+.8*math.sin(math.radians(a+(c-a)*i/24)),PLATFORM) for i in range(25)])
    probes=0;max_distance=0
    for boundary in boundaries:
        for a,c in zip(boundary,boundary[1:]):
            a,c=Vector(a),Vector(c);count=max(1,math.ceil((c-a).length/.09))
            for i in range(count+1):
                base=a.lerp(c,i/count)
                for height,tree in [(.3,infill),(.65,infill),(1.02,infill),(1.16,cap)]:
                    point=base+Vector((0,0,height));nearest=tree.find_nearest(point)
                    assert nearest[0] is not None and nearest[3]<.14, f'Unprotected station edge at {tuple(point)}: gap {nearest[3]}'
                    max_distance=max(max_distance,nearest[3]);probes+=1
    # Clear approaches must stay open: stair foot, stair arrival and lift door.
    for label,origin,direction,length in [
        ('stair foot',(-13.1,18.6,1.45),(-1,0,0),1.2),
        ('stair arrival',(-13.1,20.4,PLATFORM+.65),(0,1,0),2.2),
        ('lift doorway',(9.5,20.8,PLATFORM+.65),(0,1,0),1.0),
    ]:
        hit=infill.ray_cast(Vector(origin),Vector(direction),length)
        assert hit[0] is None, f'Guard blocks the {label}'
    return {'boundaryProbes':probes,'maxSurfaceDistance':round(max_distance,4),'clearApproaches':3}
