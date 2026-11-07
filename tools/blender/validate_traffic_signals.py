"""Signal joinery, approach visibility, pavement contact and route clearance."""
import bpy
import math
from mathutils import Vector, Matrix
from traffic_signals import CONFIG


def verify_traffic_signals(graph):
    objects=list(bpy.data.objects)
    def bounds(obj):
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        pts=[obj.matrix_world@v.co for v in mesh.vertices];evaluated.to_mesh_clear()
        return Vector([min(p[i] for p in pts) for i in range(3)]),Vector([max(p[i] for p in pts) for i in range(3)])
    assert len([o for o in objects if o.name.startswith('Traffic tapered mast')])==2
    assert len([o for o in objects if o.name.startswith('Traffic optical')])==6
    assert len([o for o in objects if o.name.startswith('Pedestrian inset dark display')])==4
    assemblies=[]
    for pole in CONFIG['poles']:
        parts=[o for o in objects if o.get('trafficSignal')==pole['id']]
        pose=Matrix.Translation((pole['x'],pole['y'],0))@Matrix.Rotation(math.radians(pole['headingDegrees']),4,'Z')
        facing=pose.to_3x3()@Vector((0,-1,0))
        assemblies.append({o['signalPart']:(o,pose.inverted()@o.matrix_world) for o in parts})
        assert len([o for o in parts if o.get('pedestrianAspect')])==2,'Every pole needs both pedestrian aspects'
        shoe=next(o for o in parts if o.name.startswith('Traffic flush mounting shoe'))
        lo,hi=bounds(shoe);assert abs(lo.z-.802)<.005,'Mounting shoe must sit on the paving'
        assert abs(pole['x']-CONFIG['crossingX'])>1.5+.125,'Pole must leave the dropped crossing clear'
        for obj in parts:
            lo,hi=bounds(obj)
            assert hi.y<CONFIG['roadEdges'][0]-.10 or lo.y>CONFIG['roadEdges'][1]+.10,f'Signal hardware intrudes into the road: {obj.name}, {list(lo)}, {list(hi)}'
            if obj.name.startswith('Traffic optical'):
                assert all((obj.matrix_world.to_3x3()@p.normal).dot(facing)>.9 for p in obj.data.polygons),'Lens normals face away from their traffic approach'
                center=obj.matrix_world@Vector((0,-.277,{'Traffic red':3.73,'Traffic amber':3.35,'Traffic green':2.97}[obj['signalAspect']]))
                hit,point,_,_,seen,_=bpy.context.scene.ray_cast(graph,center+facing*2,-facing,distance=2.1)
                assert hit and seen.original==obj,'Housing or visor blocks the luminous lens: '+obj.name
                direction=(pose.to_3x3()@Vector((-1,-1,1))).normalized()
                hit,_,_,_,seen,_=bpy.context.scene.ray_cast(graph,center+direction*2,-direction,distance=2.1)
                assert hit and seen.original==obj,'Visor obscures the lamp from the isometric view: '+obj.name
                assert obj.data.uv_layers.get('DetailUV'),'Lens texture UVs missing'
            if obj.get('pedestrianAspect'):
                normal=obj.matrix_world.to_3x3()@Vector((0,0,1))
                inward=Vector((0,-1 if pole['y']>CONFIG['roadY'] else 1,0))
                assert normal.dot(inward)>.99,f'Pedestrian display must face across the road: {pole["id"]}, {obj.name}, {list(normal)}'
                center=obj.matrix_world.translation
                height=2.844 if obj['pedestrianAspect']=='Pedestrian red' else 2.444
                assert abs(center.z-height)<.001,'Pedestrian lens must stay seated in its display, not fall to the pole origin'
                opposite=next(p for p in CONFIG['poles'] if p['id']!=pole['id'])
                eye=Vector((CONFIG['crossingX'],opposite['y'],2.35))
                sightline=center-eye
                hit,_,_,_,seen,_=bpy.context.scene.ray_cast(graph,eye,sightline.normalized(),distance=sightline.length+.05)
                assert hit and seen.original==obj,'Pedestrian icon must be visible from the opposite waiting pavement: '+obj.name
            if obj.name.startswith('Pedestrian recessed push button'):
                outward=Vector((0,1 if pole['y']>CONFIG['roadY'] else -1,0))
                assert (obj.matrix_world.to_3x3()@Vector((0,0,1))).dot(outward)>.99,'Push button must remain accessible from its own pavement'
    assert abs((CONFIG['poles'][1]['headingDegrees']-CONFIG['poles'][0]['headingDegrees'])%360-180)<.001,'Signals must face opposite headings'
    a,c=assemblies;assert a.keys()==c.keys(),'Both poles must have exactly the same parts'
    for key in a:
        original,local_a=a[key];copy,local_c=c[key]
        assert original.data==copy.data,'Signal components must share identical source geometry'
        assert max(abs(local_a[i][j]-local_c[i][j]) for i in range(4) for j in range(4))<1e-5,'Only the complete assembly heading may differ'
    line=bpy.data.objects['Signal crossing stop line'];lo,hi=bounds(line)
    assert .64<lo.z<hi.z<.652,'Stop-line paint must lie flush with the asphalt'
    assert lo.x>CONFIG['crossingX']+CONFIG['crossingHalfWidth']+.5
    stripes=[o for o in objects if o.name.startswith('Waterfront zebra crossing')]
    assert len(stripes)==6,'Restore the six broad zebra stripes'
    assert not any(o.name.startswith('Signal crossing boundary stud') for o in objects),'Remove replacement dotted boundaries'
    for i,obj in enumerate(sorted(stripes,key=lambda o:o.location.y)):
        lo,hi=bounds(obj)
        assert abs(obj.location.x-CONFIG['crossingX'])<.001 and abs(obj.location.y-(-16.7+i*.6))<.001
        assert abs(hi.x-lo.x-1.35)<.001 and abs(hi.y-lo.y-.3)<.001,'Preserve the previous stripe proportions'
        assert .64<lo.z<hi.z<.652,'Zebra stripes must be flush paint'
    assert len(bpy.data.collections['Signals'].objects)>6,'Pedestrian stencils must remain separately animated'
    return True
