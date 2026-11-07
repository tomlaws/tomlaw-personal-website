"""Assembly checks for the refined miniature train, evaluated before export."""
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from metro_train import CAR_CENTRES


def verify_train_polish(graph):
    vertices=[];faces=[];names=[]
    objects=list(bpy.data.collections['Metro'].objects)
    for obj in objects:
        if obj.type not in {'MESH','CURVE'}:continue
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh();offset=len(vertices)
        vertices.extend(tuple(obj.matrix_world@v.co) for v in mesh.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in mesh.polygons)
        names.extend([obj.name]*len(mesh.polygons));evaluated.to_mesh_clear()
    tree=BVHTree.FromPolygons(vertices,faces)
    def hit(origin,direction,distance):
        result=tree.ray_cast(Vector(origin),Vector(direction),distance)
        return names[result[2]] if result[0] is not None else None
    assert hit((0,-.58,2.0),(0,1,0),1.16) is None,'Glass or bulkhead blocks the inter-car passage'
    for y in [-.43,-.3,0,.3,.43]:
        for z in [1.2,2.0,2.9]:
            for side in [-1,1]:
                name=hit((0,y,z),(side,0,0),1.2)
                assert name and name.startswith('Shuttle gangway inner lining'),'Open side in the gangway enclosure'
    lamps=[o for o in objects if o.name.startswith('Shuttle recessed lamp bezel')]
    assert len(lamps)==4
    for lamp in lamps:
        point=Vector(lamp['mountPoint']);normal=Vector(lamp['mountNormal'])
        name=hit(point+normal*.5,-normal,.65)
        assert name and name.startswith('Shuttle opal headlamp'),'Headlamp lens is covered by its bezel or coachwork'
        body=next(o for o in objects if o.name.startswith('Shuttle hollow rounded shell') and
                  min(v.co.y for v in o.data.vertices)<point.y<max(v.co.y for v in o.data.vertices))
        evaluated=body.evaluated_get(graph)
        near=evaluated.closest_point_on_mesh(point)
        assert near[0] and (near[1]-point).length<.004,'Lamp fitting is detached from the curved nose'
    for cy in CAR_CENTRES:
        for offset in [-4.2,0,4.2]:
            name=hit((0,cy+offset,2.2),(0,0,1),1.0)
            assert name and name.startswith('Metro cabin continuous bounce ceiling'),'Cabin roof hides its luminous headlining'
    frames=[o for o in objects if o.name.startswith('Shuttle fitted door surround')]
    assert len(frames)==8
    for frame in frames:
        assert max(v.co.z for v in frame.data.vertices)<=3.121,'Door surround crosses the roof edge'
    for roof in [o for o in objects if o.name.startswith('Shuttle moulded roof')]:
        assert all(p.area>1e-9 for p in roof.data.polygons),'Collapsed roof surface'
        bm=bmesh.new();bm.from_mesh(roof.data)
        assert all(e.is_manifold for e in bm.edges) and bm.calc_volume(signed=True)>0,'Roof must remain a closed outward shell'
        bm.free()
    assert not any(o.name.startswith('Shuttle enclosed flexible gangway') for o in objects),'Old disconnected gangway hoops remain'
    used={m.get('paletteKey') for o in objects for m in getattr(o.data,'materials',[])}
    assert not {'Rail sage','Rail ochre'}&used and {'Rail slate','Rail cream','Rail graphite'}<=used
    from train_cab import point
    for cy in CAR_CENTRES:
        outward=1 if cy>0 else -1
        name=hit((-.55,cy+outward*5.0,2.32),(0,-outward,0),.6)
        assert name and name.startswith('Cab inset windscreen'),'Cab windscreen is blocked by opaque bodywork'
        for side in [-1,1]:
            p=point(cy,outward,side*2.23,2.47)
            name=hit(p+Vector((side*.3,0,0)),(-side,0,0),.6)
            assert name and 'quarter window' in name and name.startswith('Cab inset'),'Cab side window is covered'
        name=hit((-.6,cy+outward*3.7,2.4),(0,-outward,0),.6)
        assert name and name.startswith('Cab solid privacy partition'),'Driver area is not separated from the passenger cabin'
    assert len([o for o in objects if o.name.startswith('Cab moulded driver seat')])==2
    assert not any(o.name.startswith(('Shuttle driver console','Shuttle fitted curved bumper','Shuttle route light')) for o in objects)
    return {'visibleHeadlamps':4,'fittedDoorSurrounds':8,'gangwaySideProbes':30,'clearInterCarPassage':True,'ceilingSightlines':6,
            'clearCabWindows':6,'enclosedDriverCompartments':2}
