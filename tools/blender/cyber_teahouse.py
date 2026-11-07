"""Jade Circuit: the harbour's neon corner teahouse, rebuilt as a cyberpunk shop.

A complete reworking of the former Jade corner teahouse. The building is now one
continuous pressed-metal envelope with real shopfront, entrance, roller service
hatch and round-window openings; layered neon signage on fabricated steel cases;
exposed conduit, meters and split-system cooling; and a fully stocked interior
with a continuous light envelope behind every pane. The referenced tiled roof
and its eaves are kept, so the corner keeps its pitch, silhouette and place in
the district. Dimensions are metres; the sources and the construction details
carried into this model are recorded in reference/asset-references.md.
"""
import math
import bpy
import bmesh
from mathutils import Vector
import build_city as b
import craftsmanship as craft
import public_realm as realm
from craftsmanship import opening_frame, opening_profile

CX,CY=-12.0,-6.2
WEST,EAST=-16.35,-7.65
FRONT,BACK=-9.65,-2.75
BASE=.90
HEAD=5.0
PLINTH='Jade tile'
CLAD='Neon panel'
DARK='Rail graphite'
STEEL='Aluminium'
MAGENTA='Night magenta'
CYAN='Night cyan'

# Front elevation, west to east. Every bay is a real opening cut from the shell
# and then lined with its own fabricated steel surround, glazing or shutter.
WINDOW=(-13.85,1.06,4.10,2.50)
WINDOW_MULLIONS=[-14.583,-13.217]
ENTRANCE=(-10.50,.90,2.10,2.55)
SERVICE=(-8.60,.90,1.30,1.50)
EAST_DOOR=(-5.20,BASE,1.20,2.25)
ROUND_WINDOW=(-8.35,2.90,.62)
BELT=4.80
PARAPET=5.46
# Interior envelope: the shop now uses the full depth of the building. The
# lining sits just inside the hollow, so no reveal is ever left unlit.
INTERIOR=(CX,-9.58,-2.90,2.45,8.36,3.05)
URN_X=-13.6


def slab_over(name,x,y,bottom,w,d,h,material,bevel=.03):
    """Box positioned by its underside, so every join is unambiguous to read."""
    return b.box(name,(x,y,bottom+h/2),(w,d,h),material,bevel)


def pipe_run(name,points,radius,material):
    """Small fabricated pipe run with couplings, matching the district detailing."""
    b.tube(name,points,radius,material)
    for i,p in enumerate(points[1:-1],1):
        direction=Vector(points[i+1])-Vector(p)
        b.cylinder(name+' coupling',p,radius*1.34,.11,material,12,direction.to_track_quat('Z','Y').to_euler())


def neon_tube(label,points,radius,material,closed=False):
    lamp=b.tube('Tea '+label+' neon tube',points,radius,material,closed)
    lamp.data.use_fill_caps=True
    return lamp


def ring_tube(label,centre,radius,thickness,material,plane='x'):
    """Continuous circle of tube lying in the YZ ('x') or XZ ('z') elevation."""
    x,y,z=centre
    points=[(x,y+math.cos(i*math.tau/48)*radius,z+math.sin(i*math.tau/48)*radius) if plane=='x'
        else (x+math.cos(i*math.tau/48)*radius,y,z+math.sin(i*math.tau/48)*radius) for i in range(49)]
    return neon_tube(label,points,thickness,material,True)


def glow_letters(label,body,position,size,material,rotation):
    obj=b.text('Tea '+label+' neon lettering',body,position,size,material,rotation)
    obj.data.align_y='CENTER'
    return obj


def aperture(label,centre,bottom,width,height,depth,axis,glazing='Window glass',sill=.13):
    """Cut-ready rounded aperture plus the steel surround and pane that fill it."""
    inner=opening_profile(centre,bottom,width,height)
    outer=opening_profile(centre,bottom-sill,width+.30,height+.17+sill,.24)
    opening_frame('Tea '+label+' steel surround',outer,inner,depth-.09,depth+.16,axis,DARK)
    if glazing:
        pane=craft.profile_beam('Tea '+label+' fitted glazing',inner,depth+.020,depth+.038,axis,glazing)
        pane['teaShopGlazing']=True
    return inner


def cladding():
    """Pressed-sheet construction: belt course, joint trims and through-fixings.

    Vertical sheets lap unsealed, so the horizontal belt and the per-pier joint
    trims read as real sheeting joints rather than decoration; the fixings sit
    on that belt line like self-drilling screws with sealing washers.
    """
    b.box('Tea shop cladding belt course',(CX,FRONT-.035,BELT),(8.66,.13,.14),STEEL,.02)
    b.box('Tea shop east cladding belt course',(EAST+.035,CY,BELT),(.13,6.86,.14),STEEL,.02)
    b.box('Tea shop west cladding belt course',(WEST-.035,CY,BELT),(.13,6.86,.14),STEEL,.02)
    b.box('Tea shop rear cladding belt course',(CX,BACK+.035,BELT),(8.66,.13,.14),STEEL,.02)
    for i in range(12):
        b.cylinder('Tea shop belt through-fixing',(WEST+.44+i*.72,FRONT-.10,BELT),.030,.05,STEEL,10,(math.pi/2,0,0))
    for i in range(9):
        b.cylinder('Tea shop belt through-fixing',(EAST+.10,FRONT+.30+i*.72,BELT),.030,.05,STEEL,10,(0,math.pi/2,0))
    for i in range(9):
        b.cylinder('Tea shop belt through-fixing',(WEST-.10,FRONT+.30+i*.72,BELT),.030,.05,STEEL,10,(0,math.pi/2,0))
    for i in range(12):
        b.cylinder('Tea shop belt through-fixing',(WEST+.44+i*.72,BACK+.10,BELT),.030,.05,STEEL,10,(math.pi/2,0,0))
    for x in [-16.20,-11.68,-9.35,-7.80]:
        b.box('Tea shop cladding joint trim',(x,FRONT-.035,2.30),(.11,.10,2.62),STEEL,.018)
    for y in [-9.42,-7.40,-4.48]:
        b.box('Tea shop cladding joint trim',(EAST+.035,y,2.30),(.10,.11,2.62),STEEL,.018)
    for a,c in [(-16.34,-15.87),(-11.79,-11.56),(-9.44,-9.26),(-7.94,-7.64)]:
        b.box('Tea shop front plinth shoe',((a+c)/2,FRONT-.03,.98),(c-a,.16,.10),STEEL,.016)
    for a,c in [(-9.63,-5.84),(-4.56,-2.79)]:
        b.box('Tea shop east plinth shoe',(EAST+.03,(a+c)/2,.98),(.16,c-a,.10),STEEL,.016)


def roller_shutter(centre,y,bottom,width,height,drop):
    """Fabricated service hatch: headbox, insulated guide channels and laths."""
    top=bottom+height
    b.box('Tea service hatch headbox',(centre,y-.10,top-.085),(width+.22,.34,.20),DARK,.035)
    b.box('Tea service hatch headbox cap',(centre,y-.13,top+.035),(width+.10,.26,.05),STEEL,.014)
    for dx in [-1,1]:
        x=centre+dx*(width/2-.028)
        b.box('Tea service hatch guide channel',(x,y-.055,bottom+height-.46),(.075,.21,.98),STEEL,.014)
    count=max(3,int(drop/.068))
    for i in range(count):
        b.box('Tea service hatch formed lath',(centre,y-.085,top-.115-i*.068),(width-.085,.055,.062),'Oxidized metal',.010)
    b.box('Tea service hatch end rail',(centre,y-.075,top-.115-count*.068),(width-.075,.11,.045),STEEL,.012)


def east_services():
    """Exposed conduit, meter cabinet and split-system cooling on the east wall."""
    x=EAST+.02;conduit=-4.34
    pipe_run('Tea shop rising service conduit',[(x+.04,conduit,1.10),(x+.20,conduit,1.36),
        (x+.20,conduit,3.92),(x+.04,conduit,4.14)],.040,DARK)
    for z in [1.40,2.60,3.86]:
        b.box('Tea shop conduit inspection box',(x+.19,conduit,z),(.19,.17,.26),'Oxidized metal',.022)
    b.box('Tea shop meter cabinet',(x+.15,-3.82,2.02),(.30,.66,.70),DARK,.035)
    b.box('Tea shop meter cabinet door',(x+.31,-3.82,2.02),(.02,.56,.58),STEEL,.010)
    b.box('Tea shop meter cabinet glazing',(x+.325,-3.82,2.12),(.012,.34,.28),'Window glass',0)
    pipe_run('Tea shop consumer tail run',[(x+.18,-3.82,1.64),(x+.06,-3.82,1.42),
        (x+.06,conduit,1.42),(x+.06,conduit,1.18)],.032,STEEL)
    # A wall-hung condenser pair on a shared frame, with drip tray and drain.
    frame=-3.06
    for z in [2.42,3.32]:
        b.box('Tea shop condenser casing',(x+.30,frame,z),(.58,.86,.68),DARK,.07)
        b.box('Tea shop condenser grille',(x+.585,frame,z),(.03,.72,.50),STEEL,.02)
        for i in range(3):
            b.box('Tea shop condenser louvre',(x+.605,frame,z-.14+i*.14),(.02,.68,.10),DARK,.012)
        ring_tube('condenser fan cowl',(x+.46,frame-.24,z),.185,.026,STEEL,'x')
        for i in range(6):
            a=i*math.tau/6
            pipe_run('Tea shop condenser blade',[(x+.505,frame-.24+math.cos(a)*.15,z+math.sin(a)*.15),
                (x+.505,frame-.24-math.cos(a)*.15,z-math.sin(a)*.15)],.016,STEEL)
        for dy in [-.52,.52]:
            b.box('Tea shop condenser bracket',(x+.13,frame+dy,z),(.42,.055,.80),DARK,.014)
            b.tube('Tea shop condenser brace',[(x+.02,frame+dy,z+.30),(x+.34,frame+dy,z-.24)],.026,DARK)
    b.box('Tea shop condenser drip tray',(x+.30,frame-.49,2.02),(.58,.09,.07),STEEL,.014)
    pipe_run('Tea shop condenser condensate drain',[(x+.42,frame-.49,2.02),(x+.42,frame-.58,1.80),
        (x+.42,frame-.50,1.40),(x+.20,frame-.50,1.02),(x+.06,frame-.50,BASE-.03)],.032,STEEL)
    for i in range(4):
        b.box('Tea shop cable tray rung',(x+.19,frame+.95,2.60+i*.36),(.20,.05,.04),STEEL,.008)


def interior():
    x,front,back,z,w,h=INTERIOR
    b.poly('Tea shop flush tiled floor',b.rounded(CX,CY,8.54,6.64,.20,10),BASE-.055,.055,PLINTH,.02)
    # Complete light envelope: ceiling, floor and both walls carry the same cyan
    # bounce, so orbiting the camera never finds an unlit reveal behind a pane.
    craft.room_lining('Tea shop continuous interior bounce',x,front,back,z,w,h,'Lagoon interior')
    b.room_panel('Tea shop back bar lit wall',(CX,-2.94,2.45),8.10,2.94,'Lagoon interior')
    slab_over('Tea shop back bar carcass',CX,-3.16,BASE,7.90,.52,.96,CLAD,.05)
    slab_over('Tea shop back bar steel top',CX,-3.16,1.86,8.04,.60,.075,STEEL,.02)
    slab_over('Tea shop back bar toe recess',CX,-3.16,1.00,7.60,.34,.22,DARK,.02)
    neon_tube('back bar underlight',[(CX-3.80,-3.47,1.80),(CX+3.80,-3.47,1.80)],.028,MAGENTA)
    for zz in [2.30,3.00]:
        slab_over('Tea shop back bar shelf',CX,-3.02,zz,7.60,.42,.055,DARK,.012)
        for i in range(7):
            xx=CX-3.15+i*1.05
            if abs(xx-URN_X)<.40:
                continue
            slab_over('Tea shop stocked canister',xx,-3.02,zz+.055,.23,.23,.30,PLINTH if i%2 else DARK,.02)
            slab_over('Tea shop canister lid',xx,-3.02,zz+.355,.245,.245,.035,STEEL,.012)
    b.box('Tea shop backlit menu board',(CX,-3.05,3.66),(6.30,.20,.62),DARK,.03)
    b.box('Tea shop menu board glowface',(CX,-3.16,3.66),(6.06,.02,.46),CYAN,.005)
    for i in range(4):
        b.box('Tea shop menu printed line',(CX-2.30+i*1.52,-3.175,3.66),(1.20,.012,.075),DARK,0)
    # Serving counter; the copper urn standing on it is the shop's sightline.
    slab_over('Tea shop serving counter carcass',CX-.50,-7.30,BASE,6.60,.72,1.00,CLAD,.06)
    slab_over('Tea shop serving counter toe recess',CX-.50,-7.30,BASE,6.30,.44,.24,DARK,.02)
    slab_over('Tea shop serving counter steel top',CX-.50,-7.30,1.90,6.86,.86,.075,STEEL,.02)
    neon_tube('counter underlight',[(CX-3.72,-7.70,1.82),(CX+2.72,-7.70,1.82)],.028,MAGENTA)
    urn()
    for i in range(3):
        xx=CX-3.05+i*1.30
        if abs(xx-URN_X)<.62:
            continue
        slab_over('Tea shop heated urn bay',xx,-7.30,1.24,1.14,.60,.52,DARK,.02)
        neon_tube('urn bay tap light',[(xx-.42,-7.62,1.46),(xx+.42,-7.62,1.46)],.020,CYAN)
    # Glazed display cabinet in front of the shopfront, stocked with teaware.
    slab_over('Tea shop display cabinet carcass',CX-.85,-8.85,BASE,3.90,.68,.46,DARK,.04)
    b.box('Tea shop display cabinet case',(CX-.85,-8.85,1.64),(3.80,.58,.62),'Window glass',.01)
    slab_over('Tea shop display cabinet cap',CX-.85,-8.85,1.94,3.96,.74,.055,STEEL,.015)
    slab_over('Tea shop display cabinet plinth light',CX-.85,-8.53,1.26,3.80,.02,.045,CYAN,.004)
    for i in range(4):
        slab_over('Tea shop display pot',CX-2.30+i*.96,-8.85,1.38,.27,.27,.20,PLINTH if i%2 else 'Pale ceramic',.02)
    # Seating, kept clear of the entrance and shopfront sightlines.
    for xx,yy in [(CX-2.60,-6.05),(CX+.90,-6.05)]:
        b.cylinder('Tea shop round table top',(xx,yy,1.46),.42,.075,DARK,24,r2=.40)
        b.cylinder('Tea shop table pedestal',(xx,yy,1.19),.075,.48,STEEL,16)
        b.cylinder('Tea shop table foot',(xx,yy,.925),.26,.05,DARK,16)
        for side in [-1,1]:
            b.cylinder('Tea shop counter stool',(xx+side*.70,yy,.945),.19,.05,DARK,16)
            b.cylinder('Tea shop stool column',(xx+side*.70,yy,1.14),.055,.40,STEEL,12)
            b.cylinder('Tea shop stool seat',(xx+side*.70,yy,1.355),.20,.055,DARK,20)
    # Recessed ceiling trays carry the interior's own light lines.
    for yy in [-6.90,-3.90]:
        b.box('Tea shop ceiling tray',(CX,yy,3.86),(7.90,.42,.075),DARK,.02)
        neon_tube('ceiling light line',[(CX-3.10,yy,3.82),(CX+3.10,yy,3.82)],.030,CYAN)


def urn():
    x=URN_X;y=-7.30;base=1.975
    b.cylinder('Tea urn copper body',(x,y,base+.34),.30,.68,'Copper',28,r2=.28)
    slab_over('Tea urn copper lid',x,y,base+.68,.48,.48,.10,'Copper',.03)
    b.cylinder('Tea urn lid knob',(x,y,base+.83),.055,.09,STEEL,16)
    pipe_run('Tea urn dispense tap',[(x-.30,y,base+.30),(x-.45,y,base+.26),(x-.45,y,base+.11)],.030,'Copper')
    b.tube('Tea urn carrying handle',[(x+.30,y,base+.42),(x+.43,y,base+.60),(x+.30,y,base+.76)],.026,'Copper')


def storefront():
    """Steel shopfront: surrounds, mullions, transom, door leaf and shutter."""
    centre,bottom,width,height=WINDOW
    aperture('shopfront',centre,bottom,width,height,FRONT,1)
    for x in WINDOW_MULLIONS:
        b.box('Tea shopfront steel mullion',(x,FRONT-.035,bottom+height/2),(.105,.20,height),DARK,.014)
    b.box('Tea shopfront transom rail',(centre,FRONT-.035,bottom+height-.30),(width-.10,.20,.10),DARK,.014)
    b.box('Tea shopfront deep sill',(centre,FRONT-.14,bottom-.19),(width+.46,.50,.13),'Paving stone',.03)
    # Entrance: a glazed leaf beside a fixed sidelight, under a fabricated canopy.
    centre,bottom,width,height=ENTRANCE
    aperture('entrance',centre,bottom,width,height,FRONT,1,sill=.02)
    b.box('Tea entrance mullion stile',(centre+.42,FRONT-.035,bottom+height/2),(.12,.20,height),DARK,.014)
    opening_frame('Tea entrance glazed leaf frame',opening_profile(centre-.33,bottom+.04,1.20,height-.08,.10),
        opening_profile(centre-.33,bottom+.06,1.08,height-.14,.08),FRONT-.10,FRONT-.055,1,DARK)
    leaf=craft.profile_beam('Tea entrance leaf glazing',opening_profile(centre-.33,bottom+.16,.92,height-.34,.07),
        FRONT-.088,FRONT-.076,1,'Window glass')
    leaf['teaShopGlazing']=True
    side=craft.profile_beam('Tea entrance sidelight glazing',opening_profile(centre+.75,bottom+.06,.52,height-.12,.06),
        FRONT-.088,FRONT-.076,1,'Window glass')
    side['teaShopGlazing']=True
    b.box('Tea entrance leaf kick panel',(centre-.33,FRONT-.085,bottom+.20),(1.10,.04,.34),CLAD,.02)
    pipe_run('Tea entrance push bar',[(centre-.33,FRONT-.07,bottom+.98),(centre-.33,FRONT-.17,bottom+1.03),
        (centre-.33,FRONT-.17,bottom+1.43),(centre-.33,FRONT-.07,bottom+1.48)],.028,'Copper')
    b.box('Tea entrance threshold',(centre,FRONT-.05,bottom-.05),(width+.20,.42,.06),STEEL,.02)
    b.box('Tea entrance canopy',(centre,FRONT-.50,bottom+height+.28),(width+.70,1.10,.10),DARK,.03)
    for dx in [-1,1]:
        x=centre+dx*(width/2-.12)
        b.tube('Tea entrance canopy stay',[(x,FRONT-.06,bottom+height+.08),(x,FRONT-.66,bottom+height+.32)],.032,DARK)
    neon_tube('entrance canopy light line',[(centre-.92,FRONT-.92,bottom+height+.225),(centre+.92,FRONT-.92,bottom+height+.225)],.026,MAGENTA)
    centre,bottom,width,height=SERVICE
    aperture('service hatch',centre,bottom,width,height,FRONT,1,glazing=None,sill=.02)
    roller_shutter(centre,FRONT,bottom,width,height,.62)


def signage():
    # Fascia box sign: a sealed cabinet with a recessed face, channel letters and
    # a neon border, held off the cladding by bolted brackets (PNAP APP-126).
    centre=-13.60;z=4.28;width=5.20;height=.78;case=FRONT-.11;face=case-.11
    b.box('Tea fascia sign cabinet',(centre,case,z),(width,.22,height),DARK,.035)
    b.box('Tea fascia sign recessed face',(centre,face,z),(width-.22,.02,height-.20),'Dark interior',.01)
    glow_letters('fascia',"JADE  TEA",(centre,face-.012,z-.02),.40,MAGENTA,(math.pi/2,0,0))
    neon_tube('fascia border',[(centre+dx*width*.465,face-.02,z+dz*height*.30) for dx,dz in [(-1,-1),(1,-1),(1,1),(-1,1)]],.022,CYAN,True)
    b.box('Tea fascia sign access panel',(centre+width*.32,face-.015,z),(.24,.02,.26),STEEL,.008)
    for dx in [-1,1]:
        x=centre+dx*width*.34
        b.tube('Tea fascia sign bracket',[(x,FRONT-.02,z-.24),(x,case+.04,z-.02),(x,case+.04,z+.20)],.030,DARK)
        b.box('Tea fascia sign anchor plate',(x,FRONT-.015,z-.28),(.17,.06,.17),STEEL,.012)
    # Vertical projecting sign on the east end of the frontage, readable along
    # the street. Legal projecting-signboard proportions: reach far under 4.2 m,
    # a cabinet under 600 mm thick, and its soffit clear above head height.
    bx=-8.62;top=4.72;reach=1.15;thick=.11;h=1.27
    b.box('Tea blade sign cabinet',(bx,FRONT-.10-reach/2,top-h/2),(thick,reach,h),DARK,.045)
    for side in [-1,1]:
        glow_letters('blade',"J\nA\nD\nE",(bx+side*thick/2,FRONT-.10-reach/2,top-h/2),
            .21,MAGENTA,(math.pi/2,0,side*math.pi/2))
    b.box('Tea blade sign access panel',(bx+thick/2,FRONT-.10-reach+.24,top-h+.22),(.02,.22,.22),STEEL,.008)
    neon_tube('blade edge',[(bx,FRONT-.10,top-.10),(bx,FRONT-.10-reach+.10,top-.10),
        (bx,FRONT-.10-reach+.10,top-h+.10),(bx,FRONT-.10,top-h+.10)],.024,CYAN,True)
    for zz in [top-.22,top-h+.22]:
        b.tube('Tea blade sign bracket',[(bx-.02,FRONT-.02,zz),(bx-.02,FRONT-.42,zz)],.036,DARK)
        b.box('Tea blade sign bracket plate',(bx-.02,FRONT-.015,zz),(.34,.05,.17),STEEL,.012)
        b.tube('Tea blade sign diagonal',[(bx-.02,FRONT-.02,zz+(.20 if zz<top-.5 else -.20)),(bx-.02,FRONT-.42,zz)],.026,DARK)
    b.box('Tea blade sign transformer box',(bx-.14,FRONT-.30,top-h-.16),(.24,.30,.24),DARK,.03)
    pipe_run('Tea blade sign supply',[(bx-.14,FRONT-.16,top-h-.04),(bx-.14,FRONT-.30,top-h-.10)],.026,DARK)
    # Round window: glazing, steel ring and a neon halo set proud of the wall.
    ry,rz,radius=ROUND_WINDOW
    b.cylinder('Tea round window glazing',(EAST+.012,ry,rz),radius-.03,.024,'Window glass',40,(0,math.pi/2,0))
    ring_tube('round window steel ring',(EAST+.030,ry,rz),radius+.020,.028,DARK,'x')
    ring_tube('round window halo',(EAST+.058,ry,rz),radius+.075,.030,MAGENTA,'x')
    b.box('Tea round window halo bracket',(EAST-.02,ry,rz-radius-.16),(.24,.34,.10),STEEL,.02)
    # A small projected light box over the service hatch.
    b.box('Tea hatch light box case',(-8.60,FRONT-.16,2.92),(1.02,.24,.42),DARK,.03)
    glow_letters('hatch box',"OPEN 24H",(-8.60,FRONT-.285,2.90),.19,CYAN,(math.pi/2,0,0))
    neon_tube('hatch light box edge',[(-9.08,FRONT-.29,3.10),(-8.12,FRONT-.29,3.10)],.018,MAGENTA)
    for x in [-9.02,-8.18]:
        b.tube('Tea hatch light box bracket',[(x,FRONT-.02,3.19),(x,FRONT-.19,3.13)],.024,DARK)


def roof():
    """Flat machine roof in place of the tiled pitch.

    Concealed-fix ribbed sheeting laid to the profiled-sheet cover width, inside
    a clad parapet with a projecting drip coping. On it sits the plant a dense
    rooftop really carries: packaged condensers on a cranked steel base, a steel
    water tank on cradles, a braced tapered mast with its dish, the kitchen
    extract on a curb, a louvred plant cabinet, an access hatch with a fixed
    ladder, roof outlets and a neon name board on bolted legs.
    """
    b.poly('Tea shop roof deck',b.rounded(CX,CY,8.44,6.64,.20,12),4.94,.12,DARK,.02)
    craft.opening_frame('Tea shop roof parapet',b.rounded(CX,CY,8.78,6.98,.28,12),
        b.rounded(CX,CY,8.38,6.58,.20,12),4.94,PARAPET,2,CLAD)
    craft.opening_frame('Tea shop roof coping',b.rounded(CX,CY,8.94,7.14,.30,12),
        b.rounded(CX,CY,8.42,6.62,.20,12),PARAPET-.06,PARAPET+.06,2,STEEL)
    craft.opening_frame('Tea shop roof coping drip',b.rounded(CX,CY,8.94,7.14,.30,12),
        b.rounded(CX,CY,8.84,7.04,.30,12),PARAPET-.09,PARAPET+.01,2,STEEL)
    # Concealed-fix sheeting: clips hold every 42 mm rib, so the seams sit at the
    # profiled sheet's 700 mm cover width and the plant frames land over them.
    for i in range(12):
        x=WEST+.42+i*.70
        b.tube('Tea shop standing seam',[(x,-9.30,5.07),(x,-3.10,5.07)],.026,DARK)
    neon_tube('roof east coping line',[(-7.575,-9.60,5.30),(-7.575,-2.80,5.30)],.026,CYAN)
    neon_tube('roof west coping line',[(-16.425,-9.60,5.30),(-16.425,-2.80,5.30)],.026,MAGENTA)
    roof_condensers();roof_tank();roof_mast();roof_extract();roof_cabinet()
    roof_access();roof_sky_sign()


def roof_condensers():
    """Three packaged air-cooled condensers on a bolted cranked steel base."""
    row=-3.66;base=5.10;units=[CX-1.32,CX,CX+1.32]
    for dx in [-1.86,1.86]:
        for dy in [-.44,.44]:
            b.box('Tea shop roof plant base plate',(CX+dx,row+dy,base+.05),(.28,.28,.10),DARK,.02)
            for px in [-.09,.09]:
                b.cylinder('Tea shop roof plant anchor bolt',(CX+dx+px,row+dy,base+.12),.022,.05,STEEL,8)
            b.box('Tea shop roof plant frame post',(CX+dx,row+dy,base+.19),(.11,.11,.22),DARK,.014)
    for dy in [-.44,.44]:
        b.box('Tea shop roof plant frame rail',(CX,row+dy,base+.25),(4.00,.11,.12),DARK,.014)
    for xx in units:
        b.box('Tea shop packaged condenser',(xx,row,base+.65),(1.26,.74,.80),DARK,.06)
        b.box('Tea shop condenser weather cowl',(xx,row+.31,base+1.06),(1.32,.12,.10),DARK,.02)
        b.box('Tea shop condenser grille',(xx,row-.375,base+.65),(1.06,.03,.56),STEEL,.015)
        for k in range(4):
            b.box('Tea shop condenser louvre',(xx,row-.392,base+.44+k*.14),(1.00,.02,.10),DARK,.012)
        ring_tube('condenser fan cowl',(xx-.32,row-.40,base+.65),.23,.026,STEEL,'z')
        for k in range(6):
            a=k*math.tau/6
            pipe_run('Tea shop condenser blade',[(xx-.32+math.cos(a)*.19,row-.42,base+.65+math.sin(a)*.19),
                (xx-.32-math.cos(a)*.19,row-.42,base+.65-math.sin(a)*.19)],.015,STEEL)
        for dy in [-.30,.30]:
            b.box('Tea shop condenser service valve',(xx+.52,row+dy,base+.30),(.10,.10,.20),STEEL,.012)
    b.box('Tea shop condenser drip tray',(CX,row-.46,base+.19),(3.30,.16,.07),STEEL,.014)
    pipe_run('Tea shop condenser condensate drain',[(CX,row-.50,base+.19),(CX+1.30,row-.56,base+.10),
        (CX+2.12,row-.56,5.06),(CX+2.32,row-.56,5.04)],.022,STEEL)
    for i in range(5):
        b.box('Tea shop roof tray rung',(CX-2.40+i*.90,row+.62,base+.34),(.22,.05,.04),STEEL,.008)


def roof_tank():
    """Horizontal steel tank on anchor-bolted cradles, strapped and vented."""
    y=-6.55;x0,x1=-16.02,-13.72;r=.55;mid=(x0+x1)/2;z=5.12+r
    b.cylinder('Tea shop water tank barrel',(mid,y,z),r,x1-x0,STEEL,32,(0,math.pi/2,0))
    for xx in [x0,x1]:
        ring_tube('water tank end seam',(xx,y,z),r+.005,.032,DARK,'x')
        b.cylinder('Tea shop water tank end plate',(xx,y,z),r-.02,.04,STEEL,32,(0,math.pi/2,0))
    b.cylinder('Tea shop water tank top vent',(mid-.55,y,z+r-.02),.055,.36,STEEL,12)
    b.tube('Tea shop water tank vent cap',[(mid-.55,y,z+r+.16),(mid-.55,y-.13,z+r+.22)],.072,STEEL)
    b.box('Tea shop water tank level gauge',(mid+r*.55,y+.30,z+.12),(.05,.28,.84),'Window glass',.01)
    for xx in [x0+.52,x1-.52]:
        b.box('Tea shop water tank cradle',(xx,y,z-r-.10),(.24,1.00,.20),DARK,.025)
        for py in [-.36,.36]:
            b.cylinder('Tea shop water tank anchor bolt',(xx,y+py,5.14),.024,.06,STEEL,8)
    for xx in [x0+.26,x1-.26]:
        b.box('Tea shop water tank strap',(xx,y,z),(.06,1.30,1.20),DARK,.02)


def roof_mast():
    """Braced tapered mast with whips and a dish, cables dropped to a cabinet."""
    x=-9.20;y=-3.30;base=5.10;top=7.14
    b.box('Tea shop antenna mast base',(x,y,base+.11),(.50,.50,.22),DARK,.03)
    for dx in [-.17,.17]:
        for dy in [-.17,.17]:
            b.cylinder('Tea shop antenna mast bolt',(x+dx,y+dy,base+.24),.026,.06,STEEL,8)
    b.cylinder('Tea shop antenna mast',(x,y,(base+.22+top)/2),.082,top-base-.22,DARK,14,r2=.048)
    for k in range(3):
        a=k*math.tau/3+.4
        px,py=x+math.cos(a)*.62,y+math.sin(a)*.62
        b.box('Tea shop antenna stay foot',(px,py,base+.06),(.24,.24,.10),DARK,.02)
        b.tube('Tea shop antenna stay',[(x,y,base+.30),(px,py,base+.10),(px,py,top-.62)],.022,STEEL)
        b.tube('Tea shop antenna whip',[(x,y,top-.50),(px,py,top+.36)],.016,DARK)
    b.cylinder('Tea shop antenna mast cap',(x,y,top+.04),.072,.10,DARK,12)
    # Dish on a yoke, tipped south and up so its feed arm reads at this scale.
    dz=6.30
    b.cylinder('Tea shop roof dish mount',(x,y-.24,dz-.10),.075,.34,DARK,12,(math.pi/2,0,0))
    b.cylinder('Tea shop roof dish reflector',(x,y-.44,dz),.40,.20,DARK,28,(math.radians(35),0,0),r2=.13)
    ring_tube('roof dish rim',(x,y-.44,dz),.40,.022,STEEL,'z')
    b.tube('Tea shop roof dish feed arm',[(x,y-.44,dz),(x,y-.82,dz+.34)],.022,STEEL)
    b.cylinder('Tea shop roof dish feed horn',(x,y-.86,dz+.36),.055,.10,STEEL,10)
    b.box('Tea shop antenna equipment cabinet',(x+.62,y+.30,base+.30),(.44,.32,.60),DARK,.03)
    pipe_run('Tea shop antenna cable drop',[(x+.30,y,base+.36),(x+.46,y,base+.22),(x+.62,y,base+.40)],.022,DARK)


def roof_extract():
    """Kitchen extract taken to roof level on a curb, with a grease trap and cowl."""
    x=-15.34;y=-8.30;base=5.10
    b.box('Tea shop extract roof curb',(x,y,base+.13),(1.06,.80,.26),DARK,.03)
    b.box('Tea shop extract riser duct',(x,y,base+.86),(.62,.46,1.24),STEEL,.02)
    b.box('Tea shop extract grease filter housing',(x-.42,y,base+.86),(.24,.36,.62),DARK,.03)
    b.box('Tea shop extract inspection window',(x+.32,y,base+.92),(.03,.30,.34),'Window glass',.008)
    b.box('Tea shop extract motor housing',(x,y+.34,base+1.20),(.36,.22,.34),DARK,.03)
    b.box('Tea shop extract rain hood',(x,y,base+1.52),(.86,.68,.16),DARK,.03)
    for k in range(3):
        b.box('Tea shop extract cowl louvre',(x,y-.335,base+1.44-k*.12),(.78,.02,.09),STEEL,.01)
    b.box('Tea shop extract hood lip',(x,y-.40,base+1.40),(.86,.06,.20),STEEL,.015)
    pipe_run('Tea shop extract grease drain',[(x+.34,y-.20,base+.46),(x+.34,y-.36,base+.26),
        (x+.46,y-.44,base+.16)],.024,STEEL)
    b.box('Tea shop extract access door',(x+.32,y,base+.56),(.03,.34,.40),STEEL,.012)


def roof_cabinet():
    """Louvred roof plant cabinet, screened on its street-facing side."""
    x=-9.86;y=-7.36;base=5.06
    b.box('Tea shop roof plant cabinet',(x,y,base+.62),(1.24,.94,1.16),DARK,.04)
    b.box('Tea shop roof cabinet cap',(x,y,base+1.24),(1.34,1.04,.08),STEEL,.02)
    for k in range(4):
        b.box('Tea shop roof cabinet louvre',(x,y-.475,base+.28+k*.20),(1.06,.02,.14),STEEL,.012)
    b.box('Tea shop roof cabinet access panel',(x+.42,y+.30,base+.60),(.36,.03,.80),STEEL,.01)
    pipe_run('Tea shop roof cabinet duct',[(x-.34,y+.44,base+.30),(x-.34,y+.60,base+.16),
        (x-.20,y+.74,base+.10)],.10,STEEL)


def roof_access():
    """Curbed access hatch with a raised cover and a fixed access ladder."""
    x=-12.70;y=-5.06;base=5.06
    b.box('Tea shop roof hatch curb',(x,y,base+.16),(1.04,1.04,.32),DARK,.03)
    b.box('Tea shop roof hatch cover',(x,y,base+.36),(1.08,1.08,.08),STEEL,.02)
    b.box('Tea shop roof hatch upstand',(x,y,base+.42),(.84,.84,.06),DARK,.014)
    for dy in [-.42,.42]:
        b.cylinder('Tea shop roof hatch hinge',(x-.50,y+dy,base+.36),.030,.12,STEEL,10,(0,math.pi/2,0))
    b.box('Tea shop roof hatch latch',(x+.52,y,base+.34),(.08,.20,.10),STEEL,.012)
    lx=-11.42
    for dy in [-.20,.20]:
        b.tube('Tea shop roof ladder stile',[(lx,y+dy,base),(lx,y+dy,PARAPET+.30)],.032,STEEL)
    for k in range(5):
        b.tube('Tea shop roof ladder rung',[(lx,y-.20,base+.24+k*.32),(lx,y+.20,base+.24+k*.32)],.024,STEEL)
    b.tube('Tea shop roof ladder return',[(lx,y+.20,PARAPET+.30),(lx-.44,y+.20,PARAPET+.34)],.032,STEEL)


def roof_sky_sign():
    """Rooftop name board on bolted legs, readable from both approaches."""
    centre=-12.70;y=-8.86;board=6.14;width=3.24;height=.62
    for dx in [-1,1]:
        x=centre+dx*1.12
        for dy in [-1,1]:
            b.box('Tea shop roof sign base plate',(x,y+dy*.26,5.11),(.28,.28,.10),DARK,.02)
            for px in [-.08,.08]:
                b.cylinder('Tea shop roof sign anchor bolt',(x+px,y+dy*.26,5.18),.022,.05,STEEL,8)
            b.box('Tea shop roof sign post',(x,y+dy*.26,(5.16+board)/2),(.10,.10,board-5.16),DARK,.014)
            b.tube('Tea shop roof sign brace',[(x,y+dy*.26,5.34),(x,y-dy*.34,5.98)],.024,DARK)
        b.box('Tea shop roof sign yoke',(x,y,board-.07),(.14,.62,.14),DARK,.014)
    b.box('Tea shop roof sign cabinet',(centre,y,board+height/2-.03),(width,.24,height),DARK,.035)
    for side in [-1,1]:
        glow_letters('ridge',"JADE",(centre,y+side*.132,board+height/2-.05),.36,MAGENTA,
            (math.pi/2,0,0) if side<0 else (math.pi/2,0,math.pi))
    for yy in [y-.13,y+.13]:
        neon_tube('roof sign border',[(centre+dx*width*.465,yy,board+height/2-.03+dz*height*.30)
            for dx,dz in [(-1,-1),(1,-1),(1,1),(-1,1)]],.020,CYAN,True)
    b.box('Tea shop roof sign transformer',(centre-2.20,y,5.32),(.26,.32,.30),DARK,.03)
    pipe_run('Tea shop roof sign supply',[(centre-2.20,y+.16,5.30),(centre-2.20,y+.16,5.16),
        (centre-2.10,y+.30,5.12)],.024,DARK)


def build(api):
    api.surface('Neon panel','#5c6577',.45,'panel',metal=.14)
    b.collection('03 · Jade corner teahouse')
    b.status('Jade Circuit teahouse cladding')

    b.poly('Tea shop foundation plinth',b.rounded(CX,CY,9.0,7.25,.30,10),.80,.15,PLINTH,.025)
    plan=b.rounded(CX,CY,EAST-WEST,BACK-FRONT,.28,12)
    shell=b.poly('Tea shop continuous cladding envelope',plan,BASE,HEAD-BASE,CLAD,0)
    # Hollow the envelope first: the apertures below then cut clean through the
    # 170 mm walls instead of leaving shallow recesses in a solid block.
    room=b.poly('Temporary tea shop room',b.rounded(CX,CY,EAST-WEST-.34,BACK-FRONT-.34,.11,12),
        BASE-.05,3.30,'Gunmetal',0)
    cutters=[room]
    for label,spec in [('shopfront',WINDOW),('entrance',ENTRANCE),('service hatch',SERVICE)]:
        centre,bottom,width,height=spec
        cutters.append(craft.profile_beam('Temporary '+label+' aperture',opening_profile(centre,bottom,width,height),
            FRONT-.95,FRONT+.85,1,'Gunmetal'))
    centre,bottom,width,height=EAST_DOOR
    cutters.append(craft.profile_beam('Temporary east door aperture',opening_profile(centre,bottom,width,height),
        EAST-.75,EAST+.95,0,'Gunmetal'))
    ry,rz,radius=ROUND_WINDOW
    cutters.append(b.cylinder('Temporary round window aperture',(EAST,ry,rz),radius,.95,'Gunmetal',40,(0,math.pi/2,0)))
    realm.apply_difference(shell,cutters);craft.soften(shell,.032,3)
    shell['continuousEnvelope']=True

    cladding();storefront()
    # East entrance: a glazed leaf hung on the outer face of its steel surround.
    centre,bottom,width,height=EAST_DOOR
    aperture('east door',centre,bottom,width,height,EAST,0,sill=.02)
    opening_frame('Tea east door glazed leaf frame',opening_profile(centre,bottom+.04,1.12,height-.08,.10),
        opening_profile(centre,bottom+.06,1.00,height-.14,.08),EAST+.10,EAST+.055,0,DARK)
    east_leaf=craft.profile_beam('Tea east door leaf glazing',opening_profile(centre,bottom+.16,.86,height-.34,.07),
        EAST+.088,EAST+.076,0,'Window glass')
    east_leaf['teaShopGlazing']=True
    b.box('Tea east door kick panel',(EAST+.085,centre,bottom+.20),(.04,1.04,.34),CLAD,.02)
    pipe_run('Tea east door pull',[(EAST+.07,centre+.30,bottom+.98),(EAST+.17,centre+.30,bottom+1.03),
        (EAST+.17,centre+.30,bottom+1.43),(EAST+.07,centre+.30,bottom+1.48)],.028,'Copper')
    b.box('Tea east door steel threshold',(EAST+.05,centre,bottom-.05),(.42,width+.20,.06),STEEL,.02)
    interior();signage();east_services()
    # Rear service elevation: the steel door, pipes and conduit are deliberately a
    # different finish from the cladding, so back-of-house detail still reads.
    b.box('Tea rear service door surround',(CX+2.55,BACK+.02,1.98),(1.44,.16,2.30),DARK,.03)
    b.box('Tea rear service door leaf',(CX+2.55,BACK+.075,1.95),(1.14,.07,2.10),'Oxidized metal',.03)
    b.box('Tea rear door lintel canopy',(CX+2.55,BACK+.19,3.20),(1.60,.42,.09),STEEL,.02)
    for zz in [1.05,2.92]:
        b.cylinder('Tea rear door hinge',(CX+2.10,BACK+.12,zz),.035,.13,STEEL,12)
    b.cylinder('Tea rear door handle',(CX+3.02,BACK+.14,1.98),.032,.22,STEEL,12,(math.pi/2,0,0))
    b.box('Tea rear door step',(CX+2.55,BACK+.28,BASE-.03),(1.50,.44,.06),STEEL,.015)
    pipe_run('Tea rear downpipe',[(CX-3.95,BACK+.06,5.16),(CX-3.95,BACK+.20,4.55),
        (CX-3.95,BACK+.20,1.20),(CX-3.95,BACK+.42,.94)],.062,'Oxidized metal')
    b.box('Tea rear roof outlet',(CX-3.95,BACK+.34,5.09),(.34,.36,.14),STEEL,.02)
    for zz in [1.55,2.75,3.95]:
        b.box('Tea rear downpipe clip',(CX-3.95,BACK+.13,zz),(.20,.24,.055),STEEL,.01)
    pipe_run('Tea rear lighting conduit',[(CX-2.20,BACK+.06,1.20),(CX-2.20,BACK+.18,1.45),
        (CX-2.20,BACK+.18,3.85),(CX-2.20,BACK+.06,4.05)],.048,DARK)
    b.box('Tea rear security floodlight',(CX-2.20,BACK+.22,4.20),(.24,.24,.20),'Oxidized metal',.025)
    b.box('Tea rear floodlight lens',(CX-2.20,BACK+.35,4.16),(.17,.02,.13),'Warm neon',.01)
    # West elevation: a plain panel run with its own drainage and joint trim.
    pipe_run('Tea west downpipe',[(WEST-.06,BACK+.30,5.16),(WEST-.20,BACK+.30,4.50),
        (WEST-.20,BACK+.30,1.20),(WEST-.42,BACK+.30,.94)],.058,'Oxidized metal')
    b.box('Tea west roof outlet',(WEST-.16,BACK+.44,5.09),(.34,.34,.14),STEEL,.02)
    b.box('Tea west cladding joint trim',(WEST-.035,CY,2.30),(.10,6.86,.14),STEEL,.018)
    roof()

    api.planter(-17.4,-9.8,scale=1.05);api.planter(-6.2,-8.5,scale=.8)
    b.sign_light('Night tea shopfront neon',(-13.60,FRONT-.22,4.28),5.20,.78,'#ff369a',150)
    b.area('Tea blade sign magenta pool',(-8.62,FRONT-1.55,2.70),'#ff3ba6',120,3.0,(-8.62,FRONT-1.0,1.10))
    # Broad ceiling emitter inside the room: without it the shopfront, the reveals
    # and the side door showed as surfaces with no light falling on the joinery.
    b.area('Tea interior cool ceiling',(CX,-6.10,3.70),'#cdeee8',320,6.40,(CX,-6.10,1.00),dimensions=(6.40,3.20))
    # A small daytime share keeps the shop readable through the glass without
    # turning its windows into lightboxes on a bright afternoon.
    b.LIGHTS[-1]['daylightFactor']=.25
    b.status('Jade Circuit teahouse modeled')


def verify(graph):
    collection=bpy.data.collections['03 · Jade corner teahouse']
    envelope=bpy.data.objects['Tea shop continuous cladding envelope']
    mesh=envelope.evaluated_get(graph).to_mesh()
    bm=bmesh.new();bm.from_mesh(mesh)
    assert all(e.is_manifold for e in bm.edges),'Tea shop cladding must be closed and manifold'
    pending=set(bm.verts);components=0
    while pending:
        components+=1;todo=[pending.pop()]
        while todo:
            for e in todo.pop().link_edges:
                for v in e.verts:
                    if v in pending:pending.remove(v);todo.append(v)
    bm.free();envelope.evaluated_get(graph).to_mesh_clear()
    assert components==1,'Tea shop must have one joined architectural envelope'
    # Every bay must be a real hole: a ray down each bay centre must pass through.
    evaluated=envelope.evaluated_get(graph)
    for origin,direction in [((WINDOW[0],FRONT-1,2.30),(0,1,0)),((ENTRANCE[0],FRONT-1,2.20),(0,1,0)),
                              ((SERVICE[0],FRONT-1,1.60),(0,1,0)),((EAST-1,EAST_DOOR[0],2.20),(1,0,0)),
                              ((EAST-1,ROUND_WINDOW[0],ROUND_WINDOW[1]),(1,0,0))]:
        hit,_,_,_=evaluated.ray_cast(Vector(origin),Vector(direction),distance=2.5)
        assert not hit,'Cladding obstructs an aperture'
    panes=[o for o in collection.objects if o.get('teaShopGlazing')]
    assert len(panes)==6 and all(o.data.materials[0].get('surfaceRole')=='glass' for o in panes),'Missing shop glazing'
    assert bpy.data.objects['Tea round window glazing'].data.materials[0].get('surfaceRole')=='glass'
    lamps=[light for light in b.LIGHTS if 'tea' in light['name'].lower()]
    assert len(lamps)==3,'The teahouse keeps to three local emitters'
    p=b.M[CLAD].node_tree.nodes.get('Principled BSDF')
    assert all(p.inputs[k].is_linked for k in ['Base Color','Roughness','Normal']),'Missing PBR texture: '+CLAD
    assert b.M[CLAD].get('surfaceRole')=='solid'
    # The teahouse roof is now a machine deck: prove the traditional tiled pitch
    # has gone and that the new deck, parapet and plant are all present.
    assert not any(o.name.startswith(('Pitched roof','Tea ridge sign','Closed plaster gable'))
        for o in bpy.data.objects),'The traditional roof must not return'
    deck=bpy.data.objects['Tea shop roof deck'].evaluated_get(graph)
    mesh=deck.to_mesh()
    for face in mesh.polygons:
        if face.normal.z>.999:
            assert all(mesh.corner_normals[i].vector.z>.999 for i in face.loop_indices),'Roof deck must not carry diagonal smoothed shading'
    heights=[v.co.z for v in mesh.vertices];deck.to_mesh_clear()
    assert abs(min(heights)-4.94)<.01 and abs(max(heights)-5.06)<.01,'Roof deck level changed'
    for name in ['Tea shop roof parapet','Tea shop roof coping','Tea shop roof coping drip',
                 'Tea shop packaged condenser','Tea shop water tank barrel','Tea shop antenna mast',
                 'Tea shop extract riser duct','Tea shop roof plant cabinet','Tea shop roof hatch cover',
                 'Tea shop roof sign cabinet']:
        assert name in bpy.data.objects,'Missing rooftop element: '+name
    assert len([o for o in bpy.data.objects if o.name.startswith('Tea shop packaged condenser')])==3
    assert len([o for o in bpy.data.objects if o.name.startswith('Tea shop standing seam')])==12,'Keep the sheeting at its cover width'
    assert 'Tea shop standing seam' in bpy.data.objects
    coping=bpy.data.objects['Tea shop roof coping']
    top=max((coping.matrix_world@v.co).z for v in coping.data.vertices)
    assert abs(top-PARAPET-.06)<.001,'Coping must cap the parapet at its finished level'
    ground=bpy.data.objects['Continuous neighbourhood ground'].evaluated_get(graph)
    for x,y in [(CX,FRONT-1.4),(EAST-1.4,CY),(WEST+1.4,CY),(CX,BACK+1.4)]:
        hit,p,_,_=ground.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        assert hit and abs(p.z-.8)<.01,'Shop approach needs flush supported paving'
    lowest,lowest_name,highest=1e9,None,-1e9
    for obj in collection.objects:
        if obj.type not in {'MESH','CURVE'}:continue
        obj_eval=obj.evaluated_get(graph);obj_mesh=obj_eval.to_mesh()
        for v in obj_mesh.vertices:
            point=obj.matrix_world@v.co
            if point.z<lowest:lowest,lowest_name=point.z,obj.name
            highest=max(highest,point.z)
        obj_eval.to_mesh_clear()
    assert lowest>=.79,f'Teahouse fixture penetrates paving: {lowest_name} at {lowest:.3f}'
    assert highest<8.2,f'Teahouse silhouette must stay below the repair house parapet: {highest:.2f}'
    for name in ['Tea shop continuous interior bounce ceiling','Tea shop continuous interior bounce floor',
                 'Tea shop continuous interior bounce left','Tea shop continuous interior bounce right']:
        obj=bpy.data.objects[name]
        assert obj.get('interiorBounce') and obj.data.uv_layers.get('RoomUV')
        assert obj.data.materials[0].get('nightEmission',0)>0,'Interior bounce must carry its own light'
    assert 'Tea shop back bar lit wall' in bpy.data.objects
    return {'connectedClosedShell':True,'realApertures':5,'continuousInteriorLightEnvelope':True,
        'flatMachineRoof':True,'rooftopPlant':['3 condensers','water tank','antenna mast','extract','access hatch'],
        'cladBeltAndFixings':True,'localEmitters':len(lamps)}