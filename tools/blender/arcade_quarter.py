"""Lui Seng Chun-inspired corner atelier and a complete miniature railway.

Original Blender geometry. See reference/asset-references.md for research.
World Z is up; the train is authored along local Y, with wheels resting at Z=0.
"""
import math
import bpy
from mathutils import Vector
import build_city as b
import craftsmanship as craft
from detailed_assets import mesh_object, glass_panel

TRACK_Y=20
RAIL_TOP=.8125
WIRE_Z=6.05
TRAIN_HALF_LENGTH=8.5


def ribbon(name,path,z,height,thickness,material):
    """A continuous curved masonry or metal band, with a real wall section."""
    vertices=[]
    for i,p in enumerate(path):
        tangent=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)])
        tangent.normalize();normal=Vector((-tangent.y,tangent.x))
        for side,dz in [(-1,0),(1,0),(1,height),(-1,height)]:
            q=Vector(p)+normal*thickness*.5*side;vertices.append((q.x,q.y,z+dz))
    faces=[(3,2,1,0)]
    for i in range(len(path)-1):
        a=i*4
        for k in range(4):faces.append((a+k,a+(k+1)%4,a+4+(k+1)%4,a+4+k))
    faces.append(tuple(range(len(vertices)-4,len(vertices))))
    obj=mesh_object(name,vertices,faces,material,True)
    craft.soften(obj,min(.024,height*.12),2)
    return obj


def frontage(x0=5.3,x1=16.2,y0=2.2,y1=11.8,r=2):
    """South frontage, rounded east corner, then an east-facing return."""
    return [(x0,y0),(x1-r,y0)]+[(x1-r+r*math.cos(a),y0+r+r*math.sin(a)) for a in [(-math.pi/2)+i*math.pi/24 for i in range(1,13)]]+[(x1,y1)]


def glazed_ribbon(name,path,lo,hi,frame='Burgundy enamel'):
    # Long straight sections are split into readable panes; corner panes are
    # genuinely curved in plan instead of a dark rectangle on a solid core.
    points=[]
    for a,c in zip(path,path[1:]):
        n=max(1,math.ceil((Vector(c)-Vector(a)).length/1.8))
        points.extend(Vector(a).lerp(Vector(c),i/n) for i in range(n))
    points.append(Vector(path[-1]))
    for a,c in zip(points,points[1:]):
        d=(c-a).normalized()*.035;p=a+d;q=c-d
        glass_panel(name,[(p.x,p.y,lo),(q.x,q.y,lo),(q.x,q.y,hi),(p.x,p.y,hi)])
    # At the curved corner use only three robust vertical posts, not a forest
    # of tiny lines. Glass subdivisions follow the curved profile independently.
    posts=[path[0],path[1],path[5],path[9],path[13],path[-1]]
    for a,c in zip(path,path[1:]):
        length=(Vector(c)-Vector(a)).length
        if length>2:
            posts.extend(tuple(Vector(a).lerp(Vector(c),i/math.ceil(length/1.8))) for i in range(1,math.ceil(length/1.8)))
    for x,y in posts:b.cylinder(name+' bronze upright',(x,y,(lo+hi)/2),.047,hi-lo,frame,12)
    for z in [lo,hi]:ribbon(name+' perimeter frame',path,z-.045,.09,.10,frame)


def atelier(api):
    """A hollow corner book/record shop under two distinct glazed verandahs."""
    b.collection('02 · Arc corner atelier')
    plan=b.rounded(10.7,7.05,11.5,10.5,1.8,10)
    b.poly('Arc continuous ground floor',plan,.8,.15,'Jade tile',.025)
    # Clear ground-floor volume with a deep arcade, open frontage and real shop.
    b.box('Arc rear structural wall',(10.7,12.08,2.71),(11.15,.27,3.82),'Ochre plaster',.05)
    b.box('Arc west structural wall',(5.1,8.05,2.71),(.28,8.0,3.82),'Ochre plaster',.05)
    b.box('Arc east service wall',(16.3,9.83,2.71),(.28,4.2,3.82),'Ochre plaster',.05)
    for x,y in [(5.35,2.4),(9.65,2.35),(14.4,2.8),(16.05,5.7)]:
        b.cylinder('Arc chamfered arcade pier',(x,y,2.66),.22,3.72,'Ochre plaster',8)
        b.cylinder('Arc stone column shoe',(x,y,1.07),.28,.44,'Jade tile',8)
        b.cylinder('Arc moulded column capital',(x,y,4.40),.29,.18,'Ochre plaster',8)
    api.front_bay(9.1,3.65,2.62,6.35,3.1,'Apricot interior','Burgundy enamel',depth=3.0,mullions=[-1.08,1.08],mullion_width=.13)
    b.box('Arc shop bookcase carcass',(8.6,6.35,2.40),(5.5,.34,2.6),'Wood',.035)
    for z in [1.22,1.88,2.54,3.20]:
        b.box('Arc bookcase shelf',(8.6,6.1,z),(5.3,.5,.09),'Wood',.015)
        for i in range(16):
            h=.30+((i*7)%5)*.048
            b.box('Arc book spine',(6.16+i*.32,6.04,z+.05+h/2),(.22,.28,h),['Burgundy enamel','Awning cream','Deep teal'][i%3],.012,rot=(0,((i%5)-2)*.02,0))
    b.slab('Arc rounded sales counter',(10.1,4.8),2.2,.74,.96,.85,'Jade tile',.3)
    b.slab('Arc polished counter top',(10.1,4.8),2.29,.80,1.81,.09,'Wood',.28)
    b.box('Arc record display',(7.15,4.8,1.37),(1.55,.74,.8),'Wood',.05)
    for i in range(6):b.box('Arc record sleeve',(6.63+i*.2,4.77,1.82),(.035,.44,.38),['Awning cream','Burgundy enamel','Deep teal'][i%3],.008,rot=(.16,0,0))
    # Recessed corner entrance and a side display; continuous ceiling bounce.
    api.side_bay(16.28,6.5,2.67,1.35,2.8,'Apricot interior')
    api.front_bay(13.85,4.0,2.45,1.65,2.9,'Apricot interior','Burgundy enamel',depth=1.6,mullions=[0],mullion_width=.12)
    b.box('Arc entry brass threshold',(13.85,3.91,.87),(1.85,.56,.14),'Copper',.024)
    for x in [13.65,14.05]:b.tube('Arc entry pull handle',[(x,3.79,1.95),(x,3.72,2.03),(x,3.72,2.5),(x,3.79,2.58)],.027,'Copper')
    # First storey has a broad curved verandah and a setback inner wall.
    for z,h in [(4.48,.22),(8.00,.27)]:b.poly('Arc continuous floor plate',plan,z,h,'Ochre plaster',.045)
    lower=frontage();ribbon('Arc curved balcony apron',lower,4.7,.72,.22,'Ochre plaster')
    ribbon('Arc burgundy balcony coping',lower,5.4,.12,.27,'Burgundy enamel')
    glazed_ribbon('Arc lower curved glazing',lower,5.56,7.86)
    b.box('Arc first floor rear',(10.7,12.08,6.35),(11.15,.27,3.3),'Ochre plaster',.045)
    b.box('Arc first floor west',(5.1,8.1,6.35),(.28,8.0,3.3),'Ochre plaster',.045)
    b.room_panel('Arc first floor luminous inner wall',(10.5,5.6,6.33),8.6,2.75,'Apricot interior')
    craft.room_lining('Arc verandah continuous bounce',10.6,2.34,5.59,6.35,9.6,3.3,'Apricot interior')
    for x in [7.3,11.7]:
        b.box('Arc inner glazed partition',(x,5.56,6.33),(2.8,.018,2.65),'Window glass',0)
        for xx in [x-1.5,x+1.5]:b.box('Arc inner structural pier',(xx,5.49,6.35),(.23,.30,3.3),'Ochre plaster',.035)
    # The upper pavilion steps back, opens a terrace and carries a sculpted roof.
    upper_plan=b.rounded(10.7,8.0,9.35,8.0,1.45,10)
    b.poly('Arc upper pavilion floor',upper_plan,8.27,.15,'Jade tile',.02)
    upper=frontage(6.18,15.22,4.1,11.6,1.6)
    ribbon('Arc upper sill',upper,8.42,.38,.18,'Burgundy enamel')
    glazed_ribbon('Arc upper panorama glazing',upper,8.84,11.13,'Copper')
    ribbon('Arc upper curved head',upper,11.12,.26,.20,'Ochre plaster')
    b.box('Arc upper rear wall',(10.7,11.84,9.78),(9.2,.25,3.02),'Ochre plaster',.05)
    b.box('Arc upper west wall',(6.16,8.85,9.78),(.24,5.85,3.02),'Ochre plaster',.045)
    b.room_panel('Arc upper muted studio glow',(10.55,7.0,9.9),7.4,2.25,'Honey interior')
    craft.room_lining('Arc upper continuous bounce',10.6,4.18,6.99,9.83,8.3,2.8,'Honey interior')
    # A low parapet with generous openings keeps the front terrace legible.
    b.railing([(5.5,2.35),(14.15,2.35)],8.27,.87)
    for x in [6.2,12.65]:api.planter(x,3.05,z=8.27,scale=.65)
    # Curved vault, with rolled eaves and standing seams along the slope.
    vertices=[];nx=32
    for y in [3.82,12.22]:
        for i in range(nx+1):
            u=-1+2*i/nx;vertices.append((10.7+u*4.96,y,11.18+.88*(1-u*u)))
    roof=mesh_object('Arc sculpted copper vault',vertices,[(i,i+1,i+nx+2,i+nx+1) for i in range(nx)],'Copper',True)
    roof.modifiers.new('Folded vault thickness','SOLIDIFY').thickness=.16
    for y in [3.82,12.22]:b.tube('Arc rolled vault eave',[(10.7+u*4.96,y,11.18+.88*(1-u*u)) for u in [-1+2*i/nx for i in range(nx+1)]],.075,'Burgundy enamel')
    for u in [-.75,-.25,.25,.75]:b.tube('Arc roof standing seam',[(10.7+u*4.96,3.87,11.21+.88*(1-u*u)),(10.7+u*4.96,12.17,11.21+.88*(1-u*u))],.037,'Copper')
    # Filled arched clerestory ends meet the roof instead of leaving a gap.
    for y in [3.83,12.19]:
        pts=[(5.74,y,11.08),(15.66,y,11.08)]+[(10.7+u*4.96,y,11.18+.88*(1-u*u)) for u in [1-2*i/nx for i in range(nx+1)]]
        obj=mesh_object('Arc vaulted clerestory',pts,[tuple(range(len(pts)))],'Burgundy enamel');obj.modifiers.new('Clerestory depth','SOLIDIFY').thickness=.06
    # Supported side landing and bridge, kept to the lift: the public stair was
    # removed on request, so the mezzanine is reached from inside the building.
    b.box('Workshop external terrace',(17.625,8.2,4.57),(2.85,2.1,.26),'Ochre plaster',.06)
    b.box('Arc landing bridge',(15.75,8.2,4.57),(1.25,2.1,.26),'Ochre plaster',.055)
    b.railing([(16.15,9.25),(19,9.25)],4.7,.92)
    for x in [17,18.65]:b.cylinder('Arc landing round column',(x,8.6,2.62),.16,3.64,'Burgundy enamel',16)
    craft.lift_shaft()
    # Service elevations receive real recessed windows, rainwater plumbing,
    # screened rooftop ventilation and a small delivery entrance.
    for x in [7.1,11.7]:api.service_bay(x,12.23,6.6,2.7,1.9,math.pi,'Honey interior')
    for z in [2.7,6.4]:api.service_bay(4.94,8.0,z,2.25,1.85,-math.pi/2)
    api.pipe([(5.0,11.8,.84),(5.0,11.8,8.15),(6.1,11.8,8.15)],.083,'Copper')
    b.box('Arc delivery timber door',(13.95,12.24,2.04),(1.35,.14,2.4),'Burgundy enamel',.04)
    for z in [1.25,1.7,2.15,2.6]:b.box('Arc door moulding',(13.95,12.33,z),(1.05,.04,.055),'Copper',.008)
    b.slab('Arc roof ventilation cap',(11,10.2),2.3,1.45,12.02,.36,'Burgundy enamel',.22)
    for x in [10.25,10.6,10.95,11.3,11.65]:b.box('Arc ventilation louver',(x,10.2,12.40),(.12,1.08,.045),'Gunmetal',.01)
    api.signed_board('ARC / RECORDS',9.3,2.06,4.34,6.1,.55,'Warm neon',back='Burgundy enamel')
    b.sign_light('Arc amber fascia',(9.3,2.06,4.34),6.1,.55,'#ffd3a5',28)
    # Low-intensity architectural lamps supplement complete emissive interiors.
    b.area('Arc recessed shop ceiling',(9.1,4.0,3.88),'#ffd1ae',100,4,(9.1,5.3,1.4))
    b.status('Arc corner atelier modeled')



def rail_system():
    b.collection('06 · Arc metro station')
    # Embedded slab track, with formed steel rail sections and resilient grooves.
    b.box('New rail embedded concrete',(0,20,.706),(54,2.48,.188),'Patchwork render',0)
    for side in [-1,1]:
        yy=20+side*.7175
        b.box('New rail foot',(0,yy,.659),(54,.24,.04),'Gunmetal',.006)
        b.box('New rail web',(0,yy,.737),(54,.05,.116),'Oxidized metal',.006)
        b.box('Steel running rail',(0,yy,.793),(54,.092,.039),'Aluminium',.006)
        b.box('New rail running groove',(0,yy-side*.072,.789),(54,.05,.018),'Gunmetal',.003)
        b.box('New rail guard lip',(0,yy-side*.117,.785),(54,.047,.03),'Oxidized metal',.005)
    for x in range(-24,25,4):b.box('New track expansion seal',(x,20,.801),(.012,2.44,.005),'Gunmetal',0)
    # Level-boarding platforms are integrated into the station, with long
    # access ramps. The rail itself remains embedded in the quay datum.
    platform_top=RAIL_TOP+.72
    for direction in [-1,1]:
        points=[(3.2,17.3),(12,17.3),(12,16.3),(24.4,16.3),(24.4,18.59),(3.2,18.59)]
        points=[(x*direction,y) for x,y in points]
        if direction<0:points.reverse()
        b.poly('Metro integrated boarding platform',points,.8,platform_top-.8,'Paving stone',.025)
        ramp=[(3.2*direction,.8),(12*direction,.8),(12*direction,platform_top)]
        craft.profile_beam('Metro accessible station ramp',ramp,16.3,17.3,1,'Paving stone')
        b.tube('Metro platform rear handrail',[(12*direction,16.36,platform_top+.93),(24.3*direction,16.36,platform_top+.93)],.047,'Aluminium')
        for x in [12.1,16.1,20.1,24.2]:b.cylinder('Metro platform rear post',(x*direction,16.36,platform_top+.46),.045,.92,'Aluminium',12)
    furniture_before=set(b.GROUP.objects)
    # Tactile studs and shelter columns stay outside the train swept envelope.
    for i in range(48):
        x=10.2+i*.30
        for yy in [18.35,18.48]:b.cylinder('Metro stop flush tactile stud',(x,yy,.806),.032,.012,'Copper',8)
    for x in [11.0,17.3,23.6]:
        b.cylinder('Metro stop tapered column',(x,17.40,2.53),.10,3.46,'Burgundy enamel',16,r2=.075)
        b.cylinder('Metro stop column foot',(x,17.4,.89),.17,.18,'Copper',16)
        b.tube('Metro stop fork bracket',[(x,16.35,4.2),(x,17.4,3.72),(x,18.5,4.2)],.075,'Burgundy enamel')
    # A shallow butterfly roof, with a central gutter and folded metal ends.
    profile=[(16.22,4.32),(17.4,4.04),(18.62,4.32),(18.62,4.45),(17.4,4.17),(16.22,4.45)]
    craft.soften(craft.profile_beam('Metro stop butterfly roof',profile,10.30,24.35,0,'Aluminium'),.045,3)
    for y in [16.24,18.60]:b.tube('Metro stop rolled eave',[(10.3,y,4.40),(24.35,y,4.40)],.065,'Burgundy enamel')
    b.tube('Metro stop concealed gutter',[(10.45,17.4,4.055),(24.2,17.4,4.055)],.055,'Gunmetal')
    b.tube('Metro stop rain pipe',[(23.6,17.4,.82),(23.6,17.4,3.95),(23.6,17.4,4.12)],.047,'Copper')
    for a,c in [(12.15,14.85),(19.35,23.45)]:
        glass_panel('Metro stop wind screen',[(a,16.65,1.1),(c,16.65,1.1),(c,16.65,3.85),(a,16.65,3.85)])
        for z in [1.07,3.88]:b.tube('Metro stop screen frame',[(a,16.65,z),(c,16.65,z)],.042,'Copper')
    # Seats face the track (positive Blender Y), not the road behind them.
    craft.bench(13.0,17.15,.8,2.7,math.pi);craft.bench(21.4,17.15,.8,2.7,math.pi)
    for x in [13,21.4]:b.box('Metro stop ceiling luminaire',(x,17.4,4.025),(2.4,.18,.04),'Warm neon',.016)
    b.box('Metro stop timetable case',(17.2,16.70,2.44),(1.15,.17,2.06),'Burgundy enamel',.07)
    b.box('Metro stop timetable face',(17.2,16.81,2.48),(.98,.03,1.78),'Awning cream',.025)
    for i in range(7):b.box('Metro stop route diagram',(17.2,16.83,3.08-i*.2),(.65 if i%2 else .82,.015,.035),'Deep teal',.006)
    b.text('Metro stop name','ARC QUAY',(17.25,18.63,4.25),.33,'Warm neon',rotation=(math.pi/2,0,math.pi))
    craft.bench(-16,17.25,.8,2.8,math.pi)
    b.cylinder('West halt stop marker',(-20.8,17.5,2.15),.08,2.7,'Burgundy enamel',16)
    b.box('West halt route plate',(-20.8,17.5,3.45),(.85,.14,.94),'Burgundy enamel',.075)
    b.text('West halt route number','08',(-20.8,17.59,3.4),.29,'Awning cream',rotation=(math.pi/2,0,math.pi))
    for x in [-19.3+i*.32 for i in range(28)]:
        for yy in [18.35,18.48]:b.cylinder('West halt flush tactile stud',(x,yy,.806),.032,.012,'Copper',8)
    # Short bollards define the ends only; no wall between the car and platform.
    for x in [3.35,24.25]:b.cylinder('Metro stop end bollard',(x,18.3,1.13),.09,.66,'Burgundy enamel',16)
    for obj in set(b.GROUP.objects)-furniture_before:obj.location.z+=platform_top-.8
    # Three supported spans; real insulators and contact wire directly above rail.
    for x in [-25,0,25]:
        b.cylinder('Overhead tapered mast',(x,22.10,3.87),.12,6.14,'Burgundy enamel',16,r2=.08)
        b.cylinder('Overhead mast shoe',(x,22.10,.95),.24,.3,'Gunmetal',16)
        b.tube('Overhead cantilever',[(x,22.10,6.62),(x,19.88,6.62)],.072,'Oxidized metal')
        b.tube('Overhead diagonal stay',[(x,22.10,6.92),(x,20.15,6.62)],.037,'Gunmetal')
        for y in [21.72,21.82,21.92]:b.cylinder('Overhead porcelain insulator',(x,y,6.62),.115,.06,'Pale ceramic',16,(math.pi/2,0,0))
        b.tube('Overhead registration arm',[(x,20.0,6.62),(x,20.0,6.16),(x+.16,20,6.05)],.036,'Copper')
    b.tube('Metro continuous contact wire',[(-26.0,20,WIRE_Z),(26.0,20,WIRE_Z)],.033,'Copper')
    for a,c in [(-25,0),(0,25)]:
        points=[(a+(c-a)*i/24,20,6.62-.27*math.sin(math.pi*i/24)) for i in range(25)]
        b.tube('Metro messenger catenary',points,.029,'Gunmetal')
        for i in [4,10,16,22]:
            x=a+(c-a)*i/24;z=6.62-.27*math.sin(math.pi*i/24)
            b.tube('Metro catenary dropper',[(x,20,WIRE_Z),(x,20,z)],.018,'Copper')
    for x in [-26,26]:
        for y in [19.2825,20.7175]:
            b.tube('Metro buffer curved brace',[(x-.36,y,.81),(x,y,1.42),(x+.36,y,.81)],.09,'Gunmetal')
        b.box('Metro sprung buffer beam',(x,20,1.45),(.19,1.84,.20),'Burgundy enamel',.045)
        for y in [19.2825,20.7175]:b.box('Metro buffer reflector',(x+.105,y,1.45),(.018,.2,.12),'Awning cream',.009)
    b.status('Integrated railway modeled')
