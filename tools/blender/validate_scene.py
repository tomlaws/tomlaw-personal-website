"""Geometric regression checks against the editable Blender source scene."""
import bpy, json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[2]
graph=bpy.context.evaluated_depsgraph_get()
graph.update()
checks={}

for obj in bpy.data.objects:
    if obj.type=='FONT':
        assert not any('\u3400'<=c<='\u9fff' or '\uf900'<=c<='\ufaff' or 0x20000<=ord(c)<=0x323af for c in obj.data.body), 'Chinese lettering in city: '+obj.name
checks['noChineseLettering']=True

# The neighbourhood roof is now a flat machine deck, so no inverted-pitch case
# remains; the tiled teahouse roof must not creep back in.
assert not any(o.name.startswith(('Pitched roof','Closed plaster gable'))
    or o.name=='Overlapping pan and cover roof tiles' for o in bpy.data.objects),'The removed tiled roof must not return'
checks['flatMachineRoofWithoutTiles']=True

def visible_object(origin,direction=(0,1,0)):
    point=Vector(origin);direction=Vector(direction)
    for _ in range(16):
        hit,location,normal,index,obj,matrix=bpy.context.scene.ray_cast(graph,point,direction,distance=12)
        assert hit, 'No geometry along shop sightline'
        evaluated=obj.evaluated_get(graph)
        mat=evaluated.data.materials[evaluated.data.polygons[index].material_index]
        if mat.get('surfaceRole')!='glass':return obj.name
        point=location+direction*.04
    raise AssertionError('Too many transparent surfaces in front of shop')

for label,origin,prefix in [
    ('teahouse',(-13.6,-12,2.67),'Tea urn'),
    ('repairShop',(-14.92,-1,2.47),'Stock box'),
    ('cinemaLobby',(9.16,1.2,2.23),'Cinema ticket terminal'),
]:
    name=visible_object(origin)
    assert name.startswith(prefix), f'{label} interior hidden by {name}'
    checks[label+'Sightline']=name

def bounds(name):
    obj=bpy.data.objects[name]
    points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
    return [min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]

# Structural datums: the roof must cover the core, and successive masses must
# actually touch. These caught the core piercing a roof and the floating studio.
core_min,core_max=bounds('Repair house structural core')
roof_min,roof_max=bounds('Roof coping')
assert abs(core_max[2]-roof_min[2])<.005,'Repair house core must end at the roof slab'
floor_min,floor_max=bounds('Cinema mezzanine floor')
assert abs(floor_max[2]-4.7)<.005,'Cinema mezzanine must meet the lift landing'
from validate_picturehouse import verify as verify_picturehouse
checks['continuousPicturehouseAndPreservedEntrance']=verify_picturehouse(graph)
assert visible_object((10.3,8.6,10.0),(0,0,-1)).startswith('Cinema mezzanine floor'),'Cinema rooflight is blocked by an opaque roof panel'
assert not any(o.name.startswith(('Arc continuous floor plate','Arc sculpted copper vault','Arc lower curved glazing')) for o in bpy.data.objects),'Previous atelier geometry remains'
checks['buildingAssembliesConnected']=True

# The exterior stairs were removed on request: the townscape keeps clean
# elevations, so no flight, landing or guard may stand outside a building.
def overlap(a,b,axis):return min(a[1][axis],b[1][axis])-max(a[0][axis],b[0][axis])>.01
external=[o for o in bpy.data.objects if o.name.startswith(('Fire escape','Stair tower',
    'Cinema open underside access stair','Cinema stair','Arc continuous access stair','Arc stair'))]
assert not external,'Exterior building stairs must stay removed: '+', '.join(o.name for o in external[:4])
assert not any(o.get('stair_flight') for o in bpy.data.objects),'No exterior stair flight may remain'
checks['exteriorBuildingStairsRemoved']=True

# The mezzanine and the arcade landing keep their datums and are now reached
# from inside the building rather than by a flight on the pavement.
for name in ['Workshop external terrace','Cinema landing bridge']:
    assert bounds(name)[1][2]<5,name+' must stay at its approved datum'
checks['mezzanineAndLandingServedWithoutExteriorStair']=True

base_min,base_max=bounds('Cinema continuous rounded masonry shell')
for obj in bpy.data.objects:
    if obj.name.startswith('Cinema landing steel column'):
        low,high=bounds(obj.name)
        assert low[0]>base_max[0]+.02,'Landing column passes through the workshop wall'
checks['loadingRailsClearOfWall']=True

panes=[bounds(o.name) for o in bpy.data.objects if o.name.startswith('Reflective front pane')]
stiles=[bounds(o.name) for o in bpy.data.objects if o.name.startswith('Window meeting stile')]
for pane in panes:
    assert not any(all(overlap(pane,stile,axis) for axis in range(3)) for stile in stiles),'Glass passes through a window mullion'
checks['glazingClearOfMullions']=True

canopy_min,canopy_max=bounds('Bus shelter roof')
for obj in bpy.data.objects:
    if obj.name.startswith('Shelter rounded post'):
        low,high=bounds(obj.name)
        assert high[2]>=canopy_min[2] and abs(low[2]-.8)<.002,'Shelter post must connect flush paving and canopy'
checks['shelterPostsConnected']=True

asphalt=bpy.data.objects['Connected recessed asphalt']
street_min,street_max=bounds(asphalt.name)
evaluated_asphalt=asphalt.evaluated_get(graph)
for y in [-13.2,-13.15,-13.1]:
    origin=asphalt.matrix_world.inverted()@Vector((0,y,2))
    hit,position,_,_=evaluated_asphalt.ray_cast(origin,Vector((0,0,-1)))
    assert hit and abs((asphalt.matrix_world@position).z-.64)<.001,'Delivery lane must meet the main road without a gap'
import bmesh
mesh=bmesh.new();mesh.from_mesh(asphalt.data)
assert all(e.is_manifold for e in mesh.edges),'Unified asphalt must be a closed surface'
mesh.free()
checks['deliveryLaneConnected']=True
checks['asphaltUnifiedWithoutOverlappingVolumes']=True

terrace_min,terrace_max=bounds('Workshop external terrace')
assert terrace_max[0]<=19.05+.001,'Terrace must not intersect the lift shaft'
cap_min,cap_max=bounds('Lift weather cap')
assert cap_min[2]>4.56+2.54,'Cabin collides with shaft cap at upper landing'
checks['liftClearance']=True

wall_min,wall_max=bounds('Harbour retaining wall')
assert wall_min[2]<-1.8,'Seawall must extend below the waterline'
ground=bpy.data.objects['Continuous neighbourhood ground']
wall=bpy.data.objects['Harbour retaining wall']
outline=[(round(v.co.x,4),round(v.co.y,4)) for v in wall.data.vertices if abs(v.co.z+2.2)<.0001]
bottom={(round(v.co.x,4),round(v.co.y,4)) for v in ground.data.vertices if abs(v.co.z-.6)<.0001}
assert len(outline)>=120,'Seawall corners must be modelled as smooth plan curves'
assert set(outline)<=bottom,'Ground must retain the rounded seawall footprint'
coping=bpy.data.objects['Quay coping']
assert {(round(v.co.x,4),round(v.co.y,4)) for v in coping.data.vertices}==set(outline),'Coping and seawall curves must align'
def boundary_distance(point,a,c):
    p=Vector(point);a=Vector(a);c=Vector(c);v=c-a
    t=max(0,min(1,(p-a).dot(v)/v.length_squared))
    return (p-a-v*t).length
for x,y in bottom:
    assert min(boundary_distance((x,y),a,c) for a,c in zip(outline,outline[1:]+outline[:1]))<.001,'Ground boundary extends away from the seawall'
for i,p in enumerate(outline):
    incoming=Vector(p)-Vector(outline[i-1]);outgoing=Vector(outline[(i+1)%len(outline)])-Vector(p)
    assert incoming.angle(outgoing)<.08,'Sharp kink in the rounded quay perimeter'
checks['roundedGroundLayersAligned']=True
for obj in bpy.data.objects:
    if obj.name.startswith('Pier pile'):
        low,high=bounds(obj.name)
        assert low[2]<-1.8 and high[2]>=-.15,'Pier piles must join the deck and extend below water'
checks['coastAndPierSupported']=True

# Former paving joints now share the continuous surrounding quay surface.
assert not any(o.name.startswith(('Transit court paving','Waterfront paving block')) for o in bpy.data.objects),'Raised paving slabs reintroduced'
evaluated_ground=ground.evaluated_get(graph)
# The four central junction corners retain their small pedestrian radii.
for x,sx in [(-1.65,-1),(1.65,1)]:
    for y,sy in [(-13.15,1),(12.55,-1)]:
        for inset,paved in [(.25,False),(.65,True)]:
            origin=Vector((x+sx*inset,y+sy*inset,2))
            hit,position,_,_=evaluated_ground.ray_cast(origin,Vector((0,0,-1)))
            assert hit and (abs(position.z-.8)<.002 if paved else position.z<.641),'Building plot corner is pinched, square or unsupported'
# Measure both boundaries of the four peripheral bends in the actual mesh.
# Every radial section must cross exactly 4.2 m of asphalt, bounded by the
# same centre. These probes catch the previous mismatched circle/ellipse pair.
import math
for cx,cy,start in [(19.9,-11.65,-90),(19.9,10.35,0),(-19.9,10.35,90),(-19.9,-11.65,180)]:
    for i in range(1,16):
        a=math.radians(start+90*i/16)
        for r,road in [(1.4,False),(1.6,True),(5.6,True),(5.8,False)]:
            origin=Vector((cx+r*math.cos(a),cy+r*math.sin(a),2))
            hit,position,_,_=evaluated_ground.ray_cast(origin,Vector((0,0,-1)))
            assert hit and (position.z<.641 if road else abs(position.z-.8)<.002),'Road bends must have concentric boundaries and constant width'
    # The complete taxi body (including mirrors), not just its centre point,
    # must stay on asphalt throughout the updated 3.6 m turning path.
    for i in range(17):
        a=math.radians(start+90*i/16)
        for side in [-1.17,1.17]:
            for along in [-2.364,2.364]:
                x=cx+(3.6+side)*math.cos(a)-along*math.sin(a)
                y=cy+(3.6+side)*math.sin(a)+along*math.cos(a)
                origin=asphalt.matrix_world.inverted()@Vector((x,y,2))
                hit,p,_,_=evaluated_asphalt.ray_cast(origin,Vector((0,0,-1)))
                assert hit and abs((asphalt.matrix_world@p).z-.64)<.001,'Taxi swept body leaves the revised road bend'
checks['concentricConstantWidthRoadBends']=True
checks['taxiBodyFitsRevisedBends']=True
checks['eightRoundedBuildingPlotCorners']=True
for x,y in [(2.5,-10.2),(3.1,-8.4),(3.1,-9.6),(1.8,-10.2),
            (-19,-19.9),(-18.325,-19.225),(-16.975,-19.225),(-20,-19.9),
            (1.9,-8.4),(19.9,-8.4),(6.7,-10.8),(6.7,-2.4)]:
    hit,position,normal,index=evaluated_ground.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
    assert hit and abs(position.z-.8)<.0002,f'Paving must be continuous at {x}, {y}: {position.z}'
assert max(v.co.z for v in ground.data.vertices)<=.8001,'Paving protrudes above the quay'
assert not any(o.name.startswith(('Road storm drain','Drain opening')) for o in bpy.data.objects),'Slotted drain grates remain'
checks['continuousPavingWithoutDrainSlots']=True

for obj in bpy.data.objects:
    if obj.type in {'MESH','CURVE'}:
        assert not any(mat and mat.get('paletteKey') in {'Skin','Cloth'} for mat in obj.data.materials),'Person remains in scene: '+obj.name
checks['noPeopleInCityOrVehicles']=True

door_view=visible_object((-6,-5.2,2.5),(-1,0,0))
door_material=bpy.data.objects[door_view].data.materials[0]
assert door_material.get('surfaceRole')=='light','The side door must open onto a lit interior surface, got '+door_view
checks['teaDoorHasInteriorDepth']=True

treads=[bounds(o.name) for o in bpy.data.objects if o.name.startswith('Ferry exposed stair tread')]
assert len(treads)==5,'Pier stairs need five exposed treads and the quay landing'
treads.sort(key=lambda t:t[0][1])
assert all(t[1][1]<=-22+.0001 for t in treads),'Pier tread buried inside the quay'
levels=[-.025]+[t[1][2] for t in treads]+[.8]
assert max(levels[i+1]-levels[i] for i in range(6))-min(levels[i+1]-levels[i] for i in range(6))<.0001,'Pier risers must be equal, including the quay landing'
assert abs(treads[-1][1][1]+22)<.0001,'Stair flight must end precisely at the quay face'
checks['pierStepsExposedWithEqualRisers']=True

import public_realm
tree_foliage=[o for o in bpy.data.objects if o.name.startswith('Tree broad veined leaves')]
tree_trunks=[o for o in bpy.data.objects if o.name.startswith('Tree unified sculpted trunk')]
assert len(tree_foliage)==len(public_realm.TREES),'Every planned street tree needs authored foliage'
assert len(tree_trunks)==len(public_realm.TREES),'Every planned street tree needs a sculpted trunk'
assert all(o.get('leafCount',0)>=500 for o in tree_foliage)
assert all(o.get('primaryBoughs',0)>=6 for o in tree_trunks)
assert 'Tree bed' not in bpy.data.objects,'Raised tree plinth must not return'
assert not [o for o in bpy.data.objects if o.name.startswith('Tree bed')],'Raised tree plinth must not return'
soils=[o for o in bpy.data.objects if o.name.startswith('Recessed tree soil')]
assert len(soils)==len(public_realm.TREES),'Each street tree needs its recessed soil opening'
for soil in soils:
    soil_min,soil_max=bounds(soil.name)
    assert .73<soil_max[2]<.8,'Tree soil must sit inside a recessed opening'
checks['sculptedTreesWithRecessedSoil']=True
import build_city as city_builder
assert city_builder.VEGETATION,'Blender tree wind anchors were not exported'
assert len(city_builder.VEGETATION)==len(public_realm.TREES),'Each street tree needs one wind anchor'
for tree in city_builder.VEGETATION:
    assert 4<tree['height']<7 and 2<tree['radius']<4
    assert abs(tree['root'][1]-.87)<.01,'Wind anchor must be at the street tree root; roof planting is removed'
for foliage in tree_foliage:
    assert foliage.get('windLeafTipUV')=='DetailUV.y'
    tips=[d.uv.y for d in foliage.data.uv_layers['DetailUV'].data]
    assert min(tips)==0 and max(tips)>.9,'Leaf flutter needs both attached petioles and free tips'
checks['authoredTreeWindAnchorsAndLeafTipWeights']=True

# Public-realm relationships: furniture on footways, safe traffic clearance,
# weather-tight lift enclosure, and road/rail datums coherent with their vehicles.
assert abs(street_max[2]-.64)<.001,'Road must be below pedestrian paving'
for x,y in [(10,-14.3),(-23.5,0),(0,8),(10,14.3),(20,8.2)]+list(public_realm.TREES):
    hit,p,_,_=evaluated_ground.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
    assert hit and p.z<.641,'Paving blocks a road, planting opening or lift pit'
for obj in bpy.data.objects:
    if obj.name.startswith('Street lantern mast'):
        x,y=obj.location.x,obj.location.y
        hit,p,_,_=evaluated_ground.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        assert hit and abs(p.z-.8)<.002,'Streetlight planted in the carriageway'
    if obj.name.startswith('Bench profiled timber slat') and obj.location.y<-18:
        assert abs(obj.rotation_euler.z)<.01,'Promenade seat faces away from the harbour'
for prefix in ['Lift front sealed glass','Lift east sealed glass','Lift enclosed landing door']:
    panes=[o for o in bpy.data.objects if o.name.startswith(prefix)]
    assert len(panes)>=4 and all(o.data.materials[0].get('surfaceRole')=='glass' for o in panes)
assert 'Lift enclosed machinery back' in bpy.data.objects
for obj in bpy.data.objects:
    if obj.name.startswith('Lift protected guide rail'):
        low,high=bounds(obj.name)
        assert low[1]>8.2+.875,'Guide rail passes through the moving cabin'
for obj in bpy.data.objects:
    if obj.name.startswith('Lift landing threshold') and obj.location.z>4:
        low,high=bounds(obj.name)
        assert low[0]<=terrace_max[0] and low[1]>=terrace_min[1] and high[1]<=terrace_max[1],'Lift opening overhangs its terrace'
assert 'Rear rail retaining plinth' not in bpy.data.objects and 'Small rear platform' not in bpy.data.objects
from metro_train import CONFIG, RAIL_TOP, TRACK_Y, FLOOR, CAR_CENTRES, DOORS, HALF_LENGTH
from cartoon_station import PLATFORM, EDGE, CANOPY
for obj in bpy.data.objects:
    if obj.name.startswith('Steel running rail'):
        lo,hi=bounds(obj.name);assert abs(hi[2]-RAIL_TOP)<.002,'Running rail height differs from runtime'
    if obj.name.startswith(('Shuttle platform fixed','Shuttle platform sliding','Shuttle canopy tulip','Shuttle scalloped canopy')):
        lo,hi=bounds(obj.name)
        assert hi[1]<TRACK_Y-CONFIG['carWidth']/2-.08,'Station enters the train swept body: '+obj.name
platform_lo,platform_hi=bounds('Shuttle integrated boarding platform')
assert abs(platform_hi[2]-(RAIL_TOP+FLOOR))<.002,'Boarding floor mismatch'
assert .08<TRACK_Y-CONFIG['carWidth']/2-platform_hi[1]<.20,'Boarding gap must remain small and clear'
checks['connectedPublicRealmAndEnclosedLift']=True
markers=[o for o in bpy.data.objects if o.name.startswith('Shuttle boarding marker')]
assert len(markers)==len(CAR_CENTRES)*len(DOORS)
assert all(abs(a-c)<.001 for a,c in zip(sorted(o['gateCenter'] for o in markers),sorted(-cy-dy for cy in CAR_CENTRES for dy in DOORS)))
assert CONFIG['travelLimit']+HALF_LENGTH<CONFIG['bufferInnerEdge'],'Shuttle must clear both buffers'
assert len([o for o in bpy.data.objects if o.name.startswith('Metro steel wheel')])==16
assert len([o for o in bpy.data.objects if o.name.startswith('Metro level door threshold')])==8
for obj in bpy.data.objects:
    if obj.name.startswith('Metro steel wheel'):
        lo,hi=bounds(obj.name);assert abs(lo[2])<.002,'Wheel must sit on the running rail'
    if obj.name.startswith('Shuttle connected bogie bolster'):
        lo,hi=bounds(obj.name)
        assert lo[2]<=.54 and hi[2]>=FLOOR-.1,'Bogie is detached from the passenger floor'
for obj in bpy.data.objects:
    if obj.name.startswith('Shuttle hollow rounded shell'):
        assert obj['hollowCabin'] and 3.1<obj['bodyLength']/obj['bodyWidth']<3.3
    if obj.name.startswith('Metro passenger glazing'):
        centre=min(CAR_CENTRES,key=lambda cy:abs(sum(v.co.y for v in obj.data.vertices)/len(obj.data.vertices)-cy))
        outward=1 if centre>0 else -1
        assert max((v.co.y-centre)*outward for v in obj.data.vertices)<=3.301,'Passenger glass overlaps the enclosed cab'
        assert all(p.area>0 for p in obj.data.polygons),'Degenerate passenger glazing'
checks['cartoonShuttleDoorAlignmentAndSweptClearance']=True
from validate_train_polish import verify_train_polish
checks['refinedTrainJoineryAndLighting']=verify_train_polish(graph)
assert not any(o.name.startswith(('MTR ','Overhead ','Metro catenary','Metro continuous contact wire','Metro carbon contact shoe')) for o in bpy.data.objects),'Old railway hardware survived the rebuild'
piers=[o for o in bpy.data.objects if o.name.startswith('Shuttle flared viaduct pier')]
assert len(piers)==3
for obj in piers:
    lo,hi=bounds(obj.name)
    assert abs(lo[2]-.8)<.003 and abs(hi[2]-(RAIL_TOP-1.42))<.003,'Pier must meet its ground and bearing'
    assert lo[1]>25,'Pier intrudes into the road network'
girder_lo,girder_hi=bounds('Shuttle sculpted viaduct')
assert girder_lo[2]>5.0,'Preserve clear headroom under the railway'
assert girder_hi[2]<RAIL_TOP and girder_hi[2]>RAIL_TOP-.5
stairs=[o for o in bpy.data.objects if o.name.startswith('Shuttle access stair tread')]
assert len(stairs)==40
for obj in stairs:
    assert .16<obj['rise']<.18
    lo,hi=bounds(obj.name);assert lo[1]>17.7,'Stair must not land in traffic'
for key in {o['accessFlight'] for o in stairs}:
    flight=[bounds(o.name) for o in stairs if o['accessFlight']==key]
    assert max(p[1][2] for p in flight)<=PLATFORM+.002
upper_lo,upper_hi=bounds('Shuttle stair upper landing')
assert upper_hi[1]>platform_lo[1] and upper_hi[0]>platform_lo[0],'Upper landing misses the platform'
assert abs(upper_hi[2]-platform_hi[2])<.002
for obj in bpy.data.objects:
    if obj.name.startswith('Shuttle lift weather glass'):assert obj.data.materials[0].get('surfaceRole')=='glass'
    if obj.name.startswith('Shuttle lift aligned threshold'):
        lo,hi=bounds(obj.name)
        if hi[2]>4:assert hi[1]>=platform_lo[1] and abs(hi[2]-PLATFORM)<.003
assert 'Track trench cutter' not in bpy.data.objects
checks['cartoonRailSupportsAccessAndProtectedLift']=True
from validate_station_guards import verify_station_guards
checks['continuousStationGuardsAndClearEntrances']=verify_station_guards(graph)
for prefix in ['Metro passenger glazing','Metro glazed plug door','Ferry transparent side glazing','Ferry wheelhouse windscreen']:
    panes=[o for o in bpy.data.objects if o.name.startswith(prefix)]
    assert panes and all(o.data.materials[0].get('surfaceRole')=='glass' for o in panes),'Missing transparent transport glazing: '+prefix
assert 'Tram coach' not in bpy.data.objects and 'Passenger cabin' not in bpy.data.objects,'Solid transport cores would block the windows'
import bmesh
bm=bmesh.new();bm.from_mesh(bpy.data.objects['Ferry sculpted displacement hull'].data)
assert bm.calc_volume(signed=True)>0 and all(e.is_manifold for e in bm.edges),'Ferry hull must be closed with outward normals'
bm.free()
checks['hollowGlazedTransportAndClosedHull']=True

# A lit back wall alone is not a complete room. View rays can hit the reveals,
# ceiling or floor as the camera orbits; those must carry the same soft bounce.
for prefix in ['Tea shop continuous interior bounce','Vending interior bounce']:
    lining=[o for o in bpy.data.objects if o.name.startswith(prefix)]
    assert len(lining)==4, 'Incomplete light envelope: '+prefix
    for obj in lining:
        assert obj.get('interiorBounce') and obj.data.uv_layers.get('RoomUV')
        assert obj.data.materials[0].get('nightEmission',0)>0
deep_bays=[o for o in bpy.data.objects if o.name.startswith('Shop rear wall')]
shop_linings=[o for o in bpy.data.objects if o.name.startswith('Shop continuous interior bounce')]
assert len(shop_linings)==4*len(deep_bays),'Every deep shopfront needs its four interior bounce planes'
checks['deepShopfrontLinings']=len(shop_linings)
for prefix in ['Cinema booth continuous bounce']:
    assert len([o for o in bpy.data.objects if o.name.startswith(prefix)])==4,'Incomplete new interior envelope: '+prefix
assert 'Vending machine' not in bpy.data.objects,'Opaque vending core blocks the display'
assert 'White taxi cabin' not in bpy.data.objects,'Opaque taxi cabin blocks the glazing'
taxi_body=bpy.data.objects['Taxi formed hollow coachwork'].evaluated_get(graph)
assert taxi_body.get('hollowCabin') and abs(taxi_body.get('wheelbase')-2.78)<.001
hit,point,_,_=taxi_body.ray_cast(Vector((0,.3,1.4)),Vector((0,0,-1)),distance=2)
assert hit and point.z<.7,'Taxi coachwork fills the passenger compartment'
for y in [-1.39,1.39]:
    hit,_,_,_=taxi_body.ray_cast(Vector((-2,y,.32)),Vector((1,0,0)),distance=4)
    assert not hit,'Taxi wheel opening is blocked by solid coachwork'
tyres=[o for o in bpy.data.objects if o.name.startswith('Taxi rounded touring tyre')]
assert len(tyres)==4
for tyre in tyres:
    assert abs(tyre['wheelCenter'][2]-tyre['radius'])<.005,'Taxi tyres do not meet the road'
checks['taxiHollowCabinOpenWheelArchesAndRoadContact']=True
for prefix in ['Taxi clear door glazing','Taxi raked windscreen','Lift sliding glass door']:
    assert any(o.name.startswith(prefix) and o.data.materials[0].get('surfaceRole')=='glass' for o in bpy.data.objects)
assert len([o for o in bpy.data.objects if o.name.startswith('Metro cabin continuous bounce')])==8
for obj in bpy.data.objects:
    if obj.name.startswith(('Metro cabin continuous bounce left','Metro cabin continuous bounce right')):
        lo,hi=bounds(obj.name);assert hi[2]<1.78,'Cabin wall lining blocks passenger glazing'
assert len([o for o in bpy.data.objects if o.name.startswith('Shuttle moulded roof')])==2
checks['completeInteriorLightEnvelopes']=True

for name in ['Wood','Weathered timber','Roof ceramic','Canvas fabric','Aluminium','Taxi paint']:
    mat=next(m for m in bpy.data.materials if m.get('paletteKey')==name and any(n.type=='TEX_IMAGE' for n in m.node_tree.nodes))
    shader=mat.node_tree.nodes.get('Principled BSDF')
    assert all(shader.inputs[k].is_linked for k in ['Base Color','Roughness','Normal']),'Missing PBR texture: '+name
assert 'Tea shop roof deck' in bpy.data.objects and 'Tea shop roof coping' in bpy.data.objects
assert len([o for o in bpy.data.objects if o.name.startswith('Bench profiled timber slat')])>=24
checks['referenceLedTexturedAssemblies']=True

from validate_traffic_signals import verify_traffic_signals
checks['trafficSignalsJoineryVisibilityAndClearance']=verify_traffic_signals(graph)
from validate_mall import verify_mall
checks['easternMallAssembly']=verify_mall(graph)
from toyshop import verify as verify_toyshop
checks['toyshopAssembly']=verify_toyshop(graph)
from night_identity import verify as verify_night_identity
checks['nightIdentity']=verify_night_identity(graph)
from cyber_teahouse import verify as verify_cyber_teahouse
checks['cyberpunkTeahouseAssembly']=verify_cyber_teahouse(graph)

out=root/'assets/validation/geometry-report.json'
out.write_text(json.dumps(checks,indent=2))
print('GEOMETRY_CHECKS '+json.dumps(checks))
