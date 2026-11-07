"""Furnished retail rooms and a planted gallery, authored at human scale.

See reference/asset-references.md: Jewel's quiet circulation palette and layered
shop thresholds inform this original small interior. The rooms sit in the two
3.54 m wings of the shrunken plan and are entered from the rear gallery, so the
glazed frontage stays clear.
"""
import math
import random
import bpy
from mathutils import Vector
import build_city as b
import craftsmanship as craft
import public_realm as realm
from detailed_assets import mesh_object, glass_panel
from mall_plan import (CX,CY,WEST_X,EAST_X,SOUTH,NORTH,FRONT_Y,REAR_Y,FLOORS,
    GROUND,GALLERY,LIBRARY,ROOF,CEILING,ATRIUM,LIFT,ESC,BRIDGE)

WING_WEST,WING_EAST=39.45,52.56   # Wing room centres inside the 3.54 m wings
ROOM_FRONT,ROOM_BACK=-8.60,-.60   # Between the facade and the rear gallery
ROOM_WIDTH=2.90


def lathe(name, x, y, z, profile, material, sides=24):
    vertices=[]; faces=[]
    for radius,height in profile:
        vertices.extend((x+radius*math.cos(i*math.tau/sides),y+radius*math.sin(i*math.tau/sides),z+height) for i in range(sides))
    for j in range(len(profile)-1):
        for i in range(sides):
            a=j*sides+i; c=j*sides+(i+1)%sides
            faces.append((a,c,c+sides,a+sides))
    faces.extend([tuple(range(sides-1,-1,-1)),tuple(range((len(profile)-1)*sides,len(vertices)))])
    return mesh_object(name,vertices,faces,material,True)


def plant(x,y,z,size=.8):
    """Hollow tapered planter, soil, stems and folded lanceolate leaves."""
    lathe('Galleria ceramic planter',x,y,z,[(.23*size,0),(.33*size,.48*size),(.32*size,.54*size),(.28*size,.54*size),(.28*size,.45*size)],'Awning cream')
    b.cylinder('Galleria planter soil',(x,y,z+.46*size),.28*size,.035,'Tree soil',24)
    rng=random.Random(round(x*523+y*751+z*105))
    for j in range(11):
        a=j*math.tau/11;length=rng.uniform(.45,.85)*size
        base=Vector((x,y,z+.48*size));tip=base+Vector((math.cos(a)*length*.55,math.sin(a)*length*.55,length))
        mid=base.lerp(tip,.58)+Vector((0,0,.12*size));cross=Vector((-math.sin(a),math.cos(a),0))*.13*size
        b.tube('Galleria indoor plant stem',[tuple(base),tuple(mid),tuple(tip)],.009*size,'Leaf')
        verts=[tuple(base),tuple(mid-cross),tuple(tip),tuple(mid+cross),tuple(mid+Vector((0,0,.06*size)))]
        mesh_object('Galleria folded indoor foliage',verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'Leaf light' if j%3==0 else 'Leaf',True)


def chair(x,y,z,angle=0,material='Canvas fabric'):
    """Curved upholstered bucket with a substantial seat and splayed legs."""
    start=set(b.GROUP.objects)
    b.slab('Galleria upholstered chair cushion',(0,0),.58,.57,z+.40,.13,material,.21)
    points=[]
    for i in range(17):
        a=math.radians(12+156*i/16)
        points.append((.33*math.cos(a),.31*math.sin(a)))
    vertices=[(px,py,z+height) for height in [.48,.89] for px,py in points]
    faces=[(i,i+1,i+18,i+17) for i in range(16)]
    shell=mesh_object('Galleria curved upholstered chair back',vertices,faces,material,True)
    shell.modifiers.new('Upholstery shell','SOLIDIFY').thickness=.065
    craft.soften(shell,.025,3)
    for xx in [-.19,.19]:
        for yy in [-.18,.18]:b.tube('Galleria splayed chair leg',[(xx*1.15,yy*1.15,z+.025),(xx,yy,z+.43)],.028,'Wood')
    for obj in set(b.GROUP.objects)-start:
        # Local props are transformed as one assembly, including mesh coordinates.
        from mathutils import Matrix
        obj.matrix_world=Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z')@obj.matrix_world


def table(x,y,z,wide=1.05):
    lathe('Galleria cafe formed pedestal',x,y,z,[(.25,0),(.27,.06),(.075,.12),(.05,.62),(.12,.70)],'Copper')
    b.slab('Galleria cafe solid oak top',(x,y),wide,.75,z+.70,.075,'Wood',.32)
    for dx in [-.24,.24]:
        b.cylinder('Galleria cafe saucer',(x+dx,y,z+.785),.085,.02,'Pale ceramic',20)
        lathe('Galleria hollow stoneware cup',x+dx,y,z+.795,[(.043,0),(.062,.09),(.052,.09),(.045,.025)],'Pale ceramic',20)
        b.ring('Galleria stoneware cup handle',(x+dx+.061,y,z+.84),.028,.010,'Pale ceramic','y')


def shelves(cx,y,z,width=2.4,kind='books'):
    """Open joinery, recessed back, actual shelf-supported varied stock."""
    b.box('Galleria fitted oak shelf back',(cx,y+.19,z+1.55),(width,.10,3.1),'Wood',.02)
    for dx in [-width/2,width/2]:
        b.box('Galleria fitted shelf cheek',(cx+dx,y-.045,z+1.55),(.10,.58,3.10),'Wood',.024)
    for row,h in enumerate([.12,.70,1.28,1.86,2.44,3.02]):
        b.box('Galleria shelf joinery',(cx,y-.07,z+h),(width,.64,.065),'Wood',.014)
        if row==5:continue
        b.box('Galleria concealed shelf light',(cx,y-.32,z+h+.52),(width-.2,.025,.018),'Warm neon',0)
        if kind=='books':
            for i in range(9):
                xx=cx-width*.42+i*width*.84/8; height=.29+.055*((i+row)%4)
                book=b.box('Galleria bookstore spine',(xx,y-.055,z+h+.0325+height/2),(.19,.28,height),['Burgundy enamel','Mineral blue','Awning cream','Canvas fabric'][(i+row)%4],.009)
                book['supportedMerchandise']=True
        else:
            for i in range(5):
                xx=cx-width*.36+i*width*.72/4
                lathe('Galleria shelf ceramic vessel',xx,y-.08,z+h+.0325,[(.095,0),(.16,.16),(.12,.28),(.065,.34),(.066,.38),(.045,.38),(.045,.31)],'Pale ceramic' if (i+row)%2 else 'Jade tile')


def floor_zone(name,cx,cy,w,d,z,material='Wood'):
    # Surface finish is only 8 mm, flush in character; no platforms or tile gaps.
    b.slab(name,(cx,cy),w,d,z,.008,material,.18)
    edge=b.rounded(cx,cy,w-.16,d-.16,.16,8)
    b.tube(name+' flush brass border',[(x,y,z+.008) for x,y in edge],.009,'Copper',True)


def ceiling_light(name,position,power,dimensions,target,daylight=.35):
    b.area(name,position,'#ffe3c6',power,dimensions[0],target,dimensions=dimensions)
    b.LIGHTS[-1]['daylightFactor']=daylight


def room(name,cx,front,back,width,z,wall='Dusty plaster',door=None):
    """Real walls and ceiling, with textured floors instead of emitter rectangles."""
    ceiling=CEILING[z]
    depth=back-front
    rear=b.box(name+' rear wall',(cx,back+.07,(z+ceiling)/2),(width,.14,ceiling-z),wall,0)
    if door is None:door=cx+(.72 if cx<CX else -.72)
    realm.apply_difference(rear,[b.box('Temporary shop access door',(door,back+.07,z+1.40),(1.35,.5,2.85),'Gunmetal',0)])
    craft.soften(rear,.02,3)
    for xx in [door-.70,door+.70]:b.box(name+' oak door jamb',(xx,back+.035,z+1.42),(.075,.22,2.84),'Wood',.014)
    b.box(name+' oak door lintel',(door,back+.035,z+2.86),(1.47,.22,.075),'Wood',.014)
    for x in [cx-width/2,cx+width/2]:
        b.box(name+' side wall',(x,(front+back)/2,(z+ceiling)/2),(.14,depth,ceiling-z),wall,.025)
    b.box(name+' ceiling',(cx,(front+back)/2,ceiling+.045),(width,depth,.09),'Awning cream',.012)
    floor_zone(name+' oak floor',cx,(front+back)/2,width-.16,depth-.05,z)
    # Small downward-facing soffit surfaces soften the ceiling; room walls and
    # furniture receive actual broad area light, rather than covering the room.
    for x in [cx-width*.26,cx+width*.26]:
        b.box(name+' recessed ceiling diffuser',(x,(front+back)/2,ceiling-.018),(.09,depth*.72,.022),'Warm neon',0)


def boutique(cx,cy,z):
    """Rounded display islands, stitched handbags and inset presentation trays."""
    for dx,dy,w,d,h in [(-.62,-.42,1.10,.62,.84),(.66,.55,.92,.64,.98)]:
        b.slab('Galleria boutique fluted cabinet',(cx+dx,cy+dy),w,d,z+.06,h-.06,'Burgundy enamel',.24)
        b.slab('Galleria boutique stone counter',(cx+dx,cy+dy),w+.04,d+.04,z+h,.055,'Pale ceramic',.26)
        for i in range(2):
            x=cx+dx+(i-.5)*.40;y=cy+dy
            b.slab('Galleria display bag moulded body',(x,y),.28,.15,z+h+.055,.25,'Canvas fabric' if i else 'Wood',.055)
            b.tube('Galleria bag stitched handle',[(x-.07,y,z+h+.27),(x-.06,y,z+h+.40),(x+.06,y,z+h+.40),(x+.07,y,z+h+.27)],.017,'Copper')
            b.box('Galleria bag brass clasp',(x,y-.079,z+h+.22),(.055,.012,.025),'Copper',0)


def ground_shops():
    """Ground floor: one bookshop in the west wing, entered from the gallery."""
    room('Galleria bookshop',WING_WEST,ROOM_FRONT,ROOM_BACK,ROOM_WIDTH,GROUND,door=WING_WEST+.66)
    shelves(WING_WEST,-1.05,GROUND,2.30)
    b.slab('Galleria bookshop display table',(WING_WEST,-3.90),1.42,.82,GROUND,.78,'Wood',.20)
    b.slab('Galleria bookshop display top',(WING_WEST,-3.90),1.56,.92,1.72,.08,'Awning cream',.21)
    for y in [-4.14,-3.72]:
        for i in range(4):
            xx=WING_WEST-.57+i*.38;thickness=.07+(i%3)*.025
            b.box('Galleria bound book',(xx,y,1.80+thickness/2),(.26,.34,thickness),'Burgundy enamel' if i%3==0 else 'Mineral blue',.015,rot=(0,0,.08*(i%3-1)))
    chair(WING_WEST-.62,-6.05,GROUND,-.35)
    b.slab('Galleria bookshop checkout',(WING_WEST+.70,-5.45),.62,.95,GROUND,.92,'Mineral blue',.16)
    plant(WING_WEST+.62,-7.70,GROUND,.72)


def cafe():
    """Ground floor east wing: fitted counter, two window tables and a plant."""
    room('Galleria cafe',WING_EAST,ROOM_FRONT,ROOM_BACK,ROOM_WIDTH,GROUND,'Ochre plaster',door=WING_EAST-.66)
    # The counter backs onto the room's own side wall, leaving the glazed
    # frontage clear for the tables.
    b.slab('Galleria cafe service cabinet',(WING_EAST+.32,-1.05),1.20,2.30,GROUND,.90,'Jade tile',.22)
    b.slab('Galleria cafe pale counter',(WING_EAST+.32,-1.05),1.26,2.36,GROUND+.90,.07,'Pale ceramic',.24)
    b.box('Galleria espresso formed casing',(WING_EAST+.30,-.35,2.12),(.52,.72,.38),'Aluminium',.08)
    for yy in [-.58,-.15]:b.tube('Galleria coffee group handle',[(WING_EAST+.58,yy,2.01),(WING_EAST+.74,yy,2.01)],.027,'Gunmetal')
    for xx in [WING_EAST+.52,WING_EAST+.72]:b.cylinder('Galleria coffee serving cup',(xx,-.35,1.955),.055,.09,'Pale ceramic',20)
    # A glazed pastry case with shaped loaves, not an opaque display decal.
    b.slab('Galleria pastry tray',(WING_EAST+.30,-2.45),.72,.80,1.91,.035,'Copper',.12)
    glass_panel('Galleria pastry case front',[(WING_EAST+.68,-2.85,1.945),(WING_EAST+.68,-2.05,1.945),(WING_EAST+.50,-2.05,2.42),(WING_EAST+.50,-2.85,2.42)])
    glass_panel('Galleria pastry case top',[(WING_EAST-.06,-2.85,2.42),(WING_EAST+.50,-2.85,2.42),(WING_EAST+.50,-2.05,2.42),(WING_EAST-.06,-2.05,2.42)])
    for yy in [-2.66,-2.28]:
        for xx in [WING_EAST+.10,WING_EAST+.42]:lathe('Galleria baked pastry',xx,yy,1.945,[(.09,0),(.13,.055),(.10,.11),(.025,.14)],'Wood',16)
    for y in [-5.10,-7.30]:
        b.slab('Galleria cafe banquette base',(WING_EAST+.80,y),.62,1.80,GROUND,.32,'Wood',.19)
        b.slab('Galleria cafe banquette cushion',(WING_EAST+.86,y),.60,1.80,GROUND+.32,.16,'Canvas fabric',.20)
        b.slab('Galleria cafe padded back',(WING_EAST+1.10,y),.18,1.80,GROUND+.48,.58,'Canvas fabric',.09)
        table(WING_EAST-.20,y,GROUND,.95)
        chair(WING_EAST-1.05,y,GROUND,-math.pi/2)
        b.tube('Galleria cafe pendant suspension',[(WING_EAST-.20,y,CEILING[GROUND]-.02),(WING_EAST-.20,y,3.57)],.016,'Copper')
        lathe('Galleria cafe spun pendant',WING_EAST-.20,y,3.30,[(.32,0),(.32,.055),(.23,.13),(.095,.26),(.042,.29)],'Copper',32)
        b.cylinder('Galleria cafe pendant diffuser',(WING_EAST-.20,y,3.303),.27,.018,'Warm neon',32)
    plant(WING_EAST-.85,-3.85,GROUND,.62)


def atrium():
    """Ground floor: concierge, display island and the suspended atrium mobile."""
    b.slab('Galleria curved concierge desk',(43.05,-6.55),2.05,.95,GROUND,.98,'Wood',.45)
    b.slab('Galleria concierge worktop',(43.05,-6.55),2.15,1.03,1.92,.07,'Awning cream',.45)
    b.box('Galleria concierge terminal',(43.00,-6.60,2.13),(.42,.15,.31),'Gunmetal',.045,rot=(-.15,0,0))
    boutique(49.6,-7.30,GROUND)
    for x,y in [(41.60,-7.90),(50.40,-6.15)]:plant(x,y,GROUND,.95)
    # Quiet sculptural mobile below the rooflight: three broad formed loops.
    # It occupies the upper void and leaves cross-atrium sightlines open.
    for radius,z,dx in [(1.22,12.20,0),(.86,11.65,-.22),(.52,11.20,.18)]:
        points=[(ATRIUM['cx']+dx+radius*math.cos(i*math.tau/64),ATRIUM['cy']+2.1+radius*.62*math.sin(i*math.tau/64),z+.16*math.sin(i*math.tau/64)) for i in range(65)]
        b.tube('Galleria suspended sculptural bronze ring',points,.068,'Copper')
        b.tube('Galleria mobile warm inner diffuser',[(x,y,zz-.055) for x,y,zz in points],.026,'Warm neon')
        for a in [0,math.pi]:
            x=ATRIUM['cx']+dx+radius*math.cos(a)
            b.tube('Galleria mobile suspension',[(x,ATRIUM['cy']+2.1,z+.065),(ATRIUM['cx'],ATRIUM['cy'],ROOF-.30)],.014,'Copper')


def rear_and_west():
    """Rear gallery seating shared by every floor, clear of the lift approach."""
    # The west wing north is the protected lift lobby: seating against the wall
    # only, so the 1.3 m approach in front of the doors stays empty.
    b.slab('Galleria gallery bench',(WEST_X+1.05,1.30),.58,1.60,GROUND,.46,'Wood',.24)
    plant(WEST_X+.85,-.05,GROUND,.95)
    for z in [GALLERY,LIBRARY]:
        b.slab('Galleria gallery bench',(WEST_X+1.05,1.30),.58,1.60,z,.46,'Wood',.24)
        plant(WEST_X+.85,-.05,z,.95)
    for x in [43.40,48.60]:
        b.slab('Galleria rear gallery bench',(x,4.85),1.60,.58,GALLERY,.46,'Wood',.24)
        plant(x-1.35,4.85,GALLERY,.85)


def build():
    from mall_levels import design_gallery
    ground_shops();cafe();design_gallery(GALLERY);atrium();rear_and_west()
