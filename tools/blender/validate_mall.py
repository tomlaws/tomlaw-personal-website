"""Geometry checks for the shrunken Galleria assembly.

The block was reduced from a four-storey 28 x 26 m department store to a
17 x 15 m, 13.42 m corner emporium, so the rays and clearances moved with the
plan. The approved south entrance bay, canopy, threshold and glass dome keep
their original authored geometry and are fingerprinted against that state.
"""
import bpy
import bmesh
import hashlib
import json
from pathlib import Path
import build_city as city
from mathutils import Vector
from mall_plan import (CONFIG,CX,CY,WEST,EAST,SOUTH,NORTH,HALF_X,HALF_Y,CORNER,FACE,
    FLOORS,GROUND,GALLERY,LIBRARY,ROOF,CEILING,ATRIUM,BRIDGE,ESC,LIFT,SCREENS,
    FRONT_Y,REAR_Y,WEST_X,EAST_X)
from mall_interior import WING_WEST,WING_EAST,ROOM_BACK

PRESERVED=Path(__file__).resolve().parents[2]/'assets/validation/mall-entrance-approved.json'


def digest(obj,graph):
    evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
    data=[[round(v,6) for v in obj.matrix_world@vertex.co] for vertex in mesh.vertices]
    data+=[list(face.vertices) for face in mesh.polygons]
    evaluated.to_mesh_clear()
    return hashlib.sha256(json.dumps(data,separators=(',',':')).encode()).hexdigest()


def verify_mall(graph):
    shell=bpy.data.objects['Galleria continuous limestone envelope']
    bm=bmesh.new();bm.from_mesh(shell.data)
    assert all(edge.is_manifold for edge in bm.edges),'Mall shell has open construction seams'
    remaining=set(bm.verts);components=0
    while remaining:
        components+=1;stack=[remaining.pop()]
        while stack:
            for edge in stack.pop().link_edges:
                for vertex in edge.verts:
                    if vertex in remaining:remaining.remove(vertex);stack.append(vertex)
    bm.free()
    assert components==1,'Mall envelope must be one connected shell'
    def hit_object(origin, direction, skip_glass=True):
        origin=Vector(origin);direction=Vector(direction).normalized()
        for _ in range(24):
            hit,p,_,face,obj,_=bpy.context.scene.ray_cast(graph,origin,direction,distance=50)
            assert hit,'Mall sightline reaches no architecture'
            evaluated=obj.evaluated_get(graph)
            index=evaluated.data.polygons[face].material_index if evaluated.type=='MESH' else 0
            mat=evaluated.data.materials[index]
            if not skip_glass or mat.get('surfaceRole')!='glass':return obj.name,p
            origin=p+direction*.02
        raise AssertionError('Too many overlapping mall glass surfaces')
    # Ground rooms must have genuine depth behind the shopfront glazing.
    for origin,direction,prefix in [
        ((40.55,-13,2.8),(0,1,0),('Galleria bookstore spine','Galleria fitted oak shelf back','Galleria shelf joinery')),
        ((51.70,-13,1.5),(0,1,0),('Galleria curved upholstered chair back','Galleria upholstered chair cushion','Galleria folded indoor foliage','Galleria cafe side wall','Galleria cafe service cabinet'))]:
        name,point=hit_object(origin,direction)
        assert name.startswith(prefix),f'Mall storefront blocked by {name}'
    name,point=hit_object((CX+3.0,CY,ROOF+6),(0,0,-1))
    assert point.z<ROOF-.2,f'Opaque geometry blocks the glass atrium: {name}'
    assert 'Galleria continuous glass lantern' in bpy.data.objects
    # Real flush paving across the released quay and the recessed crossing.
    ground=bpy.data.objects['Continuous neighbourhood ground'].evaluated_get(graph)
    for x,y in [(29,-4.8),(31,0),(34,2),(46,-15),(56,11),(61,10),(45,28),(35,14)]:
        hit,p,_,_=ground.ray_cast(Vector((x,y,3)),Vector((0,0,-1)))
        assert hit and abs(p.z-.8)<.002,f'Released quay paving is absent or raised at {x},{y}'
    for x in [22.0,23.5,25.0]:
        road=bpy.data.objects['Connected recessed asphalt'].evaluated_get(graph)
        origin=road.matrix_world.inverted()@Vector((x,-4.8,3))
        hit,p,_,_=road.ray_cast(origin,Vector((0,0,-1)))
        assert hit and abs((road.matrix_world@p).z-.64)<.002,'Mall crossing must remain on recessed asphalt'
    # Escalator wells stay open through the annular floors.
    for x in ESC['x']:
        for y in [ESC['start']+.45,0.25,ESC['end']-.45]:
            name,p=hit_object((x,y,GALLERY-.2),(0,0,-1))
            assert name.startswith(('Galleria escalator recessed tread','Galleria escalator nosing')),f'Truss covers escalator treads: {name}'
    # Approved entrance, canopy, threshold and dome keep their authored geometry.
    preserved=json.loads(PRESERVED.read_text())
    for name,expected in preserved.items():
        assert name in bpy.data.objects,f'Approved entrance element missing: {name}'
        assert digest(bpy.data.objects[name],graph)==expected,f'Approved entrance element changed: {name}'
    # Lighting reaches every occupied ground and upper zone directly.
    for floor,ceiling in zip(FLOORS,FLOORS[1:]+[ROOF]):
        for x,y in [(40.0,-5.0),(52.0,-5.0),(40.0,1.0),(52.0,1.0),(CX,4.9)]:
            coverage=[]
            for light in city.LIGHTS:
                if not light['name'].startswith('Galleria') or not floor+2.5<light['position'][1]<ceiling-.1:continue
                width=light.get('width',0);depth=light.get('height',0)
                if width and depth and abs(light['position'][0]-x)<width/2 and abs(light['position'][2]+y)<depth/2:
                    coverage.append(light['power']/(width*depth))
            assert coverage and max(coverage)>=8,f'Mall room lacks direct lighting at {x},{y},{floor}'
    collection=bpy.data.collections['07 · Harbor galleria']
    assert not any(o.name.startswith(('Galleria shop continuous bounce','Galleria cafe continuous bounce')) for o in collection.objects)
    for x,y,floor in [(WING_WEST,-4.0,GROUND),(WING_EAST,-5.0,GALLERY),(CX,4.9,LIBRARY)]:
        name,p=hit_object((x,y,floor+.1),(0,0,-1))
        assert floor-.005<=p.z<=floor+.02,f'Interior floor is raised/absent: {name}'
    # Clear entrance axis, wing galleries and the bridge crossings.
    for x,y,z in [(CX,-7.2,GROUND),(WING_WEST,1.5,GALLERY),(WING_EAST,1.5,LIBRARY),(CX,4.9,LIBRARY),(CX,BRIDGE['arrivalY'],GALLERY)]:
        name,p=hit_object((x,y,z+1.65),(0,0,-1))
        assert p.z<=z+.03,f'Furniture obstructs mall circulation: {name}'
    for name,cx,z in [('bookshop',WING_WEST,GROUND),('cafe',WING_EAST,GROUND),
                      ('design salon',WING_WEST,GALLERY),('ceramics atelier',WING_EAST,GALLERY),
                      ('reading room',WING_WEST,LIBRARY),('listening lounge',WING_EAST,LIBRARY)]:
        wall=bpy.data.objects['Galleria '+name+' rear wall'].evaluated_get(graph)
        inverse=wall.matrix_world.inverted()
        door=cx+(.66 if cx<CX else -.66)
        for dx in [-.5,0,.5]:
            hit,_,_,_=wall.ray_cast(inverse@Vector((door+dx,ROOM_BACK+1.0,z+1.5)),Vector((0,-1,0)))
            assert not hit,f'Retail unit has no walkable internal door: {name}'
    # Everything stays inside the released quarter, clear of the side street.
    for obj in collection.objects:
        if obj.type!='MESH' or not obj.name.startswith('Galleria'):continue
        points=[obj.matrix_world@v.co for v in obj.data.vertices]
        assert min(v.x for v in points)>WEST-.4,'Mall architecture intrudes into the side street'
        assert max(v.x for v in points)<EAST+.4,'Mall needs a walkable edge inside the coast'
    assert len([o for o in collection.objects if o.name.startswith('Galleria escalator enclosed truss')])==4
    assert len([o for o in collection.objects if o.name.startswith('Galleria escalator recessed tread')])==96
    assert len([o for o in collection.objects if o.name.startswith('Galleria upper arrival bridge')])==2
    assert len([o for o in collection.objects if o.name.startswith('Galleria upper departure bridge')])==1
    for obj in collection.objects:
        if obj.name.startswith('Galleria bound book'):
            points=[obj.matrix_world@v.co for v in obj.data.vertices]
            assert abs(min(p.z for p in points)-1.8)<.001,'Display books must sit on their table'
    posts=[o.location for o in collection.objects if o.name.startswith('Mall promenade round post')]
    assert len(posts)==21
    assert all((a-c).length>.70 for i,a in enumerate(posts) for c in posts[i+1:]),'Shoreline curve samples must not create clustered posts'
    assert all(obj.name.startswith('Galleria') or 'Temporary' not in obj.name for obj in collection.objects),'Construction cutters were exported'
    # Two real upper floors, each with a clear lift well and approach.
    floors=sorted([o for o in collection.objects if o.get('mallFloor')],key=lambda o:o['mallFloor'])
    assert len(floors)==2,'The emporium has two upper floors'
    for obj,z in zip(floors,FLOORS[1:]):
        mesh=obj.evaluated_get(graph)
        hit,_,_,_=mesh.ray_cast(Vector((LIFT['x'],LIFT['y'],z+.5)),Vector((0,0,-1)))
        assert not hit,'Lift shaft is blocked by a floor slab'
        name,p=hit_object((LIFT['x'],LIFT['doorY']-.55,z+1.5),(0,0,-1))
        assert p.z<z+.04,f'Mall lift approach blocked by {name}'
    for i,z in enumerate(FLOORS+[ROOF]):
        sill=bpy.data.objects['Galleria lift aligned landing sill'+('' if i==0 else f'.{i:03}')]
        assert abs(sill.location.z+.032-z)<1e-5,'Lift sill differs from finished floor'
    assert len([o for o in collection.objects if o.name.startswith('Galleria lift continuous safety enclosure')])==2
    assert len([o for o in collection.objects if o.name.startswith('Galleria rooftop continuous safety glass glass infill')])==1
    # Terrace furniture must not move, reshape or substitute the approved dome.
    from mall_roof_preservation import verify as verify_dome
    retained_dome=verify_dome(graph)
    assert not any(o.name.startswith(('Galleria garden','Galleria southwest garden','Galleria eastern garden',
        'Galleria northwest garden','Galleria rooftop water-facing bench','Galleria rooftop bench back'))
        for o in collection.objects),'Removed garden elements returned'
    from roof_terrace import verify as verify_terrace, BENCHES, LAMPS
    terrace=verify_terrace(graph,ROOF)
    for x,y in [(38.6,-3.0),(53.4,3.5),(46.0,-7.9),(42.8,5.1),(52.5,4.9),(38.6,1.0),(53.4,-3.5)]:
        name,p=hit_object((x,y,ROOF+3.8),(0,0,-1))
        assert abs(p.z-ROOF)<.01,f'Rooftop circulation is not clear continuous paving: {name}'
    assert len([o for o in collection.objects if o.get('digitalAdvertisement')])==2
    dome=bpy.data.objects['Galleria continuous glass lantern']
    assert len(dome.data.vertices)==865,'Retain the original glass dome tessellation'
    for axis,dimension in [(0,6.6),(1,9.2),(2,2.35)]:
        values=[v.co[axis] for v in dome.data.vertices]
        assert abs(max(values)-min(values)-dimension)<.0001,'Original glass dome proportions changed'
    assert len([o for o in collection.objects if o.name.startswith('Galleria formed lantern rib')])==12
    for screen in SCREENS:
        origin=Vector((screen['x']+.8,screen['y'],screen['z'])) if screen['side'] else Vector((screen['x'],screen['y']-.8,screen['z']))
        direction=Vector((-1,0,0)) if screen['side'] else Vector((0,1,0))
        hit,p,_,_=shell.evaluated_get(graph).ray_cast(origin,direction,distance=2)
        assert hit,'Advertising screen must mount to a solid wall, not block glazing'
    assert any(o.name.startswith('Galleria exhibition oval plinth') for o in collection.objects)
    assert any(o.name.startswith('Galleria library reading desk') for o in collection.objects)
    assert any(o.name.startswith('Galleria atelier workbench') for o in collection.objects)
    return {'continuousEnvelope':True,'oppositeShopSightlines':True,'atriumOpenToRoof':True,
            'publicPavingConnected':True,'escalatorTreadsVisible':True,'existingStreetClear':True,
            'approvedEntrancePreserved':len(preserved),'furnishedRoomsHaveFlushFloors':True,'circulationClear':True,
            'upperRetailLightingCoverage':True,'threeDistinctFloorProgrammes':True,'fourAlignedProtectedLiftStops':True,
            'clearProtectedRooftop':True,'approvedDomeObjectsPreserved':retained_dome,
            'viewingTerrace':terrace,
            'originalGlassDomeProportions':True,'digitalScreensOnOpaqueFacade':True,
            'mallFootprintMetres':[round(HALF_X*2,2),round(HALF_Y*2,2),ROOF]}
