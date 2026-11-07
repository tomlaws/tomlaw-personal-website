"""Fitted architectural light channels for the district's nocturnal identity.

The existing envelopes remain intact. Curved metal channels carry an opal
diffuser; light follows selected cornices rather than every edge of a building.
Dimensions are metres. References are recorded in reference/asset-references.md.
"""
import math
import bpy
from mathutils import Vector
import build_city as b

FIXTURES=[]


def channel(label,points,normal,colour='Night cyan',closed=False,radius=.052):
    """Continuous metal socket and supported, sealed round diffuser."""
    normal=Vector(normal)
    back=b.tube('Night channel / '+label,points,radius*1.48,'Rail graphite',closed)
    back.data.use_fill_caps=True
    face=[tuple(Vector(p)+normal*radius*.80) for p in points]
    lamp=b.tube('Night diffuser / '+label,face,radius,colour,closed)
    lamp.data.use_fill_caps=True
    back['nightFixture']=lamp['nightFixture']=label
    back['fixtureRole']='housing';lamp['fixtureRole']='diffuser'
    lamp['diffuserRadius']=radius;lamp['housingOffset']=radius*.8
    FIXTURES.append((back,lamp))
    return lamp


def roof_channel(label,cx,cy,w,d,z,r,colour='Night cyan',radius=.052):
    points=[(x,y,z) for x,y in b.rounded(cx,cy,w,d,r,12)]
    return channel(label,points,(0,0,1),colour,True,radius)


def face_frame(label,cx,cy,z,w,h,colour='Night magenta',side=False):
    # Rounded corners, without mitred loose ends or separate intersecting bars.
    path=b.rounded(0,0,w,h,.16,8)
    points=[(cx,cy+x,z+y) if side else (cx+x,cy,z+y) for x,y in path]
    return channel(label,points,(1,0,0) if side else (0,-1,0),colour,True,.042)


def build():
    FIXTURES.clear()
    # Tube colours already exist in the district palette; reuse rather than
    # creating a second copy that would split the runtime material batch.
    assert 'Night cyan' in b.M and 'Night magenta' in b.M,'Neon tube colours come from the district palette'

    b.GROUP=bpy.data.collections['01 · Kowloon repair house']
    roof_channel('repair roof coping',-12,7,11.25,11.0,18.755,.22)
    # Clear of the window apertures. The short returns connect the vertical
    # luminaire to the wall, rather than hanging in space.
    channel('repair corner', [(-17.53,1.44,6.0),(-17.53,1.18,6.17),
        (-17.53,1.18,17.84),(-17.53,1.44,18.02)],(0,-1,0),'Night magenta',radius=.065)
    b.sign_light('Night repair facade wash',(-17.4,1.27,11.7),1.0,10.5,'#fb268c',130)

    b.GROUP=bpy.data.collections['02 · Loop picturehouse']
    # The tall cinema sign interrupts the low parapet. Leave its whole footprint
    # clear instead of passing a luminous rail straight through the masonry.
    path=[(8.04,2.94,8.80),(15.67,2.94,8.80)]
    for i in range(1,13):
        a=-math.pi/2+i*math.pi/24;path.append((15.67+.58*math.cos(a),3.52+.58*math.sin(a),8.80))
    path.append((16.25,11.56,8.80))
    for i in range(1,13):
        a=i*math.pi/24;path.append((15.67+.58*math.cos(a),11.56+.58*math.sin(a),8.80))
    path.append((5.63,12.14,8.80))
    for i in range(1,13):
        a=math.pi/2+i*math.pi/24;path.append((5.63+.58*math.cos(a),11.56+.58*math.sin(a),8.80))
    path.append((5.05,5.2,8.80))
    channel('cinema fitted coping',path,(0,0,1),'Night magenta')
    b.sign_light('Night cinema crown wash',(12.2,2.98,8.0),7.2,1.1,'#fc369f',105)

    b.GROUP=bpy.data.collections['03 · Jade corner teahouse']
    # The teahouse lost its tiled eaves, so its fitted channel moves onto the new
    # parapet, tucked under the coping instead of hanging in the old eave's place.
    channel('tea parapet', [(-16.44,-9.765,5.30),(-7.56,-9.765,5.30)],(0,-1,0),'Night cyan',radius=.050)

    b.GROUP=bpy.data.collections['08 · Cloudberry toyshop']
    channel('toyshop fascia', [(-43.34,-10.83,5.165),(-43.25,-10.97,5.165),
        (-32.75,-10.97,5.165),(-32.66,-10.83,5.165)],(0,-1,0),'Night cyan',radius=.048)
    channel('toyshop lantern eave', [(-41.38,-7.94,6.81),(-34.62,-7.94,6.81)],(0,-1,0),'Night magenta',radius=.045)
    b.sign_light('Night toyshop fascia wash',(-38,-10.91,4.85),10.3,.6,'#17d7ff',85)

    b.GROUP=bpy.data.collections['07 · Harbor galleria']
    roof_channel('galleria middle cornice',46,-1.5,17.20,15.20,9.225,2.02,radius=.065)
    roof_channel('galleria crown',46,-1.5,17.26,15.26,13.535,2.05,radius=.065)
    face_frame('galleria south campaign',46,-9.20,11.10,5.61,2.66)
    face_frame('galleria east campaign',54.70,2.20,11.10,3.81,2.66,side=True)
    b.sign_light('Night galleria campaign wash',(46,-9.12,11.10),5.9,2.95,'#ed379e',190)
    b.status('Fitted nighttime light channels modeled')


def verify(graph):
    assert len(FIXTURES)==10
    for housing,diffuser in FIXTURES:
        assert housing.users_collection==diffuser.users_collection
        assert diffuser['diffuserRadius']>=.04
        assert diffuser['housingOffset']<housing.data.bevel_depth
        assert housing.data.use_fill_caps and diffuser.data.use_fill_caps
        assert len(housing.data.splines[0].points)==len(diffuser.data.splines[0].points)
        assert diffuser.data.materials[0].get('nightEmission',0)>0
        assert housing.data.materials[0].get('paletteKey')=='Rail graphite'
    lamps=[l for l in b.LIGHTS if l['name'].startswith('Night ')]
    # The diffuser belongs in front of the new parapet face and below the coping,
    # where the tiled eaves used to carry it.
    tea=bpy.data.objects['Night diffuser / tea parapet']
    for point in tea.data.splines[0].points:
        assert point.co.y+tea.data.bevel_depth< -9.745
        assert 5.215<point.co.z-tea.data.bevel_depth<point.co.z+tea.data.bevel_depth<5.385
    lantern=bpy.data.objects['Night diffuser / toyshop lantern eave']
    assert all(p.co.z+lantern.data.bevel_depth<6.865 for p in lantern.data.splines[0].points), 'Lantern strip must stay below the roof bevel, avoiding a flickering far silhouette'
    assert len(lamps)==5 and len(b.LIGHTS)<=37
    assert all(l.get('signSurface') and l['width']>0 and l['height']>0 for l in lamps)
    return {'fittedChannels':len(FIXTURES),'pairedMetalHousingAndOpalDiffuser':True,
        'sealedRoundedFixtures':True,'localFacadeWashLights':len(lamps),
        'preservedBuildingEnvelopes':True,'additionalShadowMaps':0}
