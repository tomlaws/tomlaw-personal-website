"""Soft elevated railway: petal canopies, a sculpted viaduct and clear access."""
import math
import build_city as b
import craftsmanship as craft
from detailed_assets import mesh_object, glass_panel
from metro_train import CONFIG, RAIL_TOP, TRACK_Y, FLOOR, CAR_CENTRES, DOORS, loft

PLATFORM=RAIL_TOP+FLOOR
EDGE=TRACK_Y-CONFIG['carWidth']/2-.13
FRONT=21.2
CANOPY=PLATFORM+3.05
GUARD_HEIGHT=1.16
_guard_posts=set()


def guard_path(name,points,height=GUARD_HEIGHT):
    """Joined round rails with supported glass bays along a 3D floor datum.

    Keep the original path bends inside each glass bay. Subdivision by travelled
    distance gives curved corners real infill without a forest of corner posts.
    A registry shares posts where independently authored guard runs meet.
    """
    from mathutils import Vector
    points=[Vector(p) for p in points]
    lengths=[0.0]
    for a,c in zip(points,points[1:]):lengths.append(lengths[-1]+(c-a).length)
    length=lengths[-1];bays=max(1,math.ceil(length/1.45))
    def sample(distance):
        for i in range(len(points)-1):
            if distance<=lengths[i+1]+.000001:
                return points[i].lerp(points[i+1],(distance-lengths[i])/(lengths[i+1]-lengths[i]))
        return points[-1].copy()
    def mark(obj,part):
        obj['stationGuard']=True;obj['guardPart']=part
        return obj
    for offset,radius,part in [(height,.055,'cap'),(.075,.034,'shoe')]:
        mark(b.tube(name+' '+part,[(p.x,p.y,p.z+offset) for p in points],radius,'Deep teal'),part)
    for i in range(bays+1):
        p=sample(length*i/bays);key=tuple(round(v,4) for v in p)+(round(height,4),)
        if key not in _guard_posts:
            _guard_posts.add(key)
            mark(b.cylinder(name+' post',(p.x,p.y,p.z+height/2),.05,height,'Deep teal',16),'post')
            mark(b.cylinder(name+' fitted socket',(p.x,p.y,p.z+.035),.079,.07,'Deep teal',16),'socket')
        if i==bays:continue
        start=length*i/bays;end=length*(i+1)/bays
        path=[sample(start)]+[p for p,d in zip(points,lengths) if start+.00001<d<end-.00001]+[sample(end)]
        verts=[];faces=[]
        for j,q in enumerate(path):
            verts.extend([(q.x,q.y,q.z+.07),(q.x,q.y,q.z+height-.035)])
            if j:faces.append((2*j-2,2*j,2*j+1,2*j-1))
        pane=mark(mesh_object(name+' fitted glass bay',verts,faces,'Lift solar glass'),'infill')
        pane.modifiers.new('Laminated infill thickness','SOLIDIFY').thickness=.016


def screen(name,a,c,z,height=GUARD_HEIGHT):
    guard_path(name,[(*a,z),(*c,z)],height)


def plan_arc(cx,cy,r,start,end,z):
    return [(cx+r*math.cos(math.radians(start+(end-start)*i/12)),
             cy+r*math.sin(math.radians(start+(end-start)*i/12)),z) for i in range(13)]


def eased_corners(points,r=.12):
    """Small continuous bends on level landing returns; slopes stay exact."""
    from mathutils import Vector
    points=[Vector(p) for p in points];result=[tuple(points[0])]
    for a,p,c in zip(points,points[1:],points[2:]):
        if abs(a.z-p.z)>.001 or abs(c.z-p.z)>.001:
            result.append(tuple(p));continue
        u=p-a;v=c-p;reach=min(r,u.length*.35,v.length*.35)
        if u.normalized().dot(v.normalized())>.999:
            result.append(tuple(p));continue
        left=p-u.normalized()*reach;right=p+v.normalized()*reach
        for i in range(7):
            t=i/6;result.append(tuple((1-t)**2*left+2*(1-t)*t*p+t*t*right))
    result.append(tuple(points[-1]));return result


def access_stair():
    count=20;going=.31;rise=(PLATFORM-.8)/(2*count);mid=(PLATFORM+.8)/2
    for flight in [0,1]:
        y=18.6 if flight==0 else 20.5
        start=-13.9 if flight==0 else -20.1;direction=-1 if flight==0 else 1
        base=.8 if flight==0 else mid;end=start+direction*count*going
        profile=[(start,base-.2),(end,base+count*rise-.2),(end,base+count*rise-.04),(start,base-.04)]
        craft.soften(craft.profile_beam('Shuttle stair folded waist',profile,y-.78,y+.78,1,'Paving stone'),.035,3)
        for i in range(count):
            z=base+(i+1)*rise;x=start+direction*(i+.5)*going
            obj=b.box('Shuttle access stair tread',(x,y,z-rise/2),(going,1.56,rise),'Paving stone',.018)
            obj['accessFlight']=flight;obj['rise']=rise
    b.box('Shuttle stair half landing',(-20.8,19.55,mid-.14),(1.4,3.52,.28),'Paving stone',.04)
    # The arrival slab follows the union with the rounded platform. Its west
    # edge gently meets the platform side instead of leaving a narrow overhang.
    b.poly('Shuttle stair upper landing',[(-13.9,19.69),(-12.5,19.69),(-12.5,22.51),
        (-13.8,22.51),(-13.8,22.0),(-13.9,21.31)],PLATFORM-.28,.28,'Paving stone',.025)
    for x,y,z in [(-20.8,19.55,mid),(-13.2,20.5,PLATFORM)]:
        b.cylinder('Shuttle stair landing support',(x,y,(.8+z-.28)/2),.22,z-.28-.8,'Paving stone',24)
    guard_path('Shuttle stair outer guard',eased_corners([
        (-13.9,17.85,.8),(-20.1,17.85,mid),(-21.44,17.85,mid),
        (-21.44,21.25,mid),(-20.1,21.25,mid),(-13.9,21.25,PLATFORM)]))
    guard_path('Shuttle stair inner guard',[
        (-13.9,19.35,.8),(-20.1,19.35,mid),(-20.1,19.75,mid),(-13.9,19.75,PLATFORM)])
    # Only the lower entrance is open. Both upper rails continue into the
    # platform boundary, at exactly the same height and shared end posts.
    guard_path('Shuttle upper landing and town guard',eased_corners([
        (-13.9,19.75,PLATFORM),(-12.56,19.75,PLATFORM),(-12.56,FRONT+.08,PLATFORM),
        (8.56,FRONT+.08,PLATFORM),(8.56,FRONT,PLATFORM)]))
    guard_path('Shuttle platform west return',[
        (-13.9,21.25,PLATFORM),(-13.84,21.31,PLATFORM),(-13.72,22.04,PLATFORM),
        *plan_arc(-13,EDGE-.8,.72,180,90,PLATFORM)])


def lift():
    # A compact enclosed core with a glazed front and through doors at each end.
    x=9.5;y=19.8;top=PLATFORM+2.6
    b.slab('Shuttle lift enclosed shaft',(x,y),2.55,2.75,.8,top-.8,'Pale ceramic',.36)
    # Genuine recess cut through the shell; otherwise glass would sit on a box.
    import bpy
    core=bpy.data.objects['Shuttle lift enclosed shaft']
    cutter=b.box('Shuttle temporary lift void',(x,y,(.8+top)/2),(1.99,3.1,top-.8-.18),'Gunmetal',0)
    bpy.context.view_layer.objects.active=core
    mod=core.modifiers.new('Hollow lift well','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    # Side walls enclose machinery; continuous panes close the two open faces.
    for yy in [y-1.381,y+1.381]:
        glass_panel('Shuttle lift weather glass',[(x-.97,yy,.9),(x+.97,yy,.9),(x+.97,yy,top-.1),(x-.97,yy,top-.1)])
    for xx in [x-.9,x+.9]:b.box('Shuttle protected lift guide',(xx,y+.96,(.9+PLATFORM+2.3)/2),(.07,.10,PLATFORM+2.3-.9),'Gunmetal',.02)
    for level,yy in [(.8,y-1.40),(PLATFORM,y+1.40)]:
        b.box('Shuttle lift aligned threshold',(x,yy,level-.025),(1.88,.24,.05),'Aluminium',.01)
        for xx in [x-.94,x+.94]:b.box('Shuttle lift rounded jamb',(xx,yy,level+1.1),(.10,.12,2.2),'Deep teal',.04)
        b.box('Shuttle lift door head',(x,yy,level+2.23),(1.99,.14,.16),'Deep teal',.04)
        b.box('Shuttle lift meeting rail',(x,yy,level+1.1),(.035,.05,2.2),'Aluminium',.006)
    b.slab('Shuttle lift cabin floor',(x,y),1.88,2.48,PLATFORM-.12,.12,'Wood',.15)
    b.slab('Shuttle lift cabin ceiling',(x,y),1.90,2.50,PLATFORM+2.25,.10,'Pale ceramic',.15)
    b.box('Shuttle lift opal ceiling',(x,y,PLATFORM+2.235),(1.35,1.7,.03),'Warm neon',.06)
    b.slab('Shuttle lift enamel cap',(x,y),2.68,2.88,top,.22,'Paving stone',.4)


def petal(cx,width):
    # A thin curved shell, lifted in the middle and scalloped in plan. End faces
    # are closed by Solidify. The underside and fittings follow the same equation.
    nx,ny=32,12;verts=[];faces=[]
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx;x=cx+(u-.5)*width
            end=max(0,abs(x-cx)-(width/2-.90))
            inset=.90-math.sqrt(max(0,.90**2-end**2))
            y=21.05+inset+v*(3.15-2*inset)
            z=CANOPY+.48*(1-(2*u-1)**2)+.16*math.sin(math.pi*v)
            verts.append((x,y,z))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    obj=mesh_object('Shuttle scalloped canopy shell',verts,faces,'Paving stone',True)
    obj.modifiers.new('Continuous shell thickness','SOLIDIFY').thickness=.18
    craft.soften(obj,.06,3)
    # Two slightly flared supports support the shell, leaving the train in view.
    for x in [cx-width*.29,cx+width*.29]:
        u=(x-cx)/width+.5;v=(21.9-21.05)/3.15
        roof=CANOPY+.48*(1-(2*u-1)**2)+.16*math.sin(math.pi*v)
        rings=[[(xx,yy,z) for xx,yy in b.rounded(x,21.9,w,d,r,8)] for z,w,d,r in
               [(PLATFORM,.22,.28,.10),(roof-.48,.22,.28,.10),(roof-.14,.68,.9,.20)]]
        loft('Shuttle canopy tulip support',rings,'Pale ceramic')
    # One broad downlight per petal; no string of tiny glowing pieces.
    # A curved diffuser is inset into the actual soffit, instead of a flat bar
    # floating below it or cutting through the arched shell at its ends.
    verts=[];faces=[]
    for i in range(25):
        u=.2+.6*i/24
        for y in [22.165,22.435]:
            v=(y-21.05)/3.15
            z=CANOPY+.48*(1-(2*u-1)**2)+.16*math.sin(math.pi*v)-.182
            verts.append((cx+(u-.5)*width,y,z))
        if i:faces.append((2*i-2,2*i-1,2*i+1,2*i))
    mesh_object('Shuttle canopy fitted diffuser',verts,faces,'Warm neon',True)
    b.area('Shuttle canopy soft downlight',(cx,22.3,CANOPY+.40),'#ffe5b5',36,4,(cx,22.3,PLATFORM),dimensions=(width*.60,1.25))


def station():
    b.slab('Shuttle integrated boarding platform',(0,(FRONT+EDGE)/2),27.6,EDGE-FRONT,PLATFORM-.36,.36,'Paving stone',.8)
    b.box('Shuttle flush boarding line',(0,EDGE-.28,PLATFORM+.006),(25.6,.15,.012),'Awning cream',0)
    centers=sorted(-cy-dy for cy in CAR_CENTRES for dy in DOORS)
    cursor=-13.0
    for center in centers:
        a,c=center-.74,center+.74
        screen('Shuttle platform fixed screen',(cursor,EDGE-.08),(a,EDGE-.08),PLATFORM)
        screen('Shuttle platform sliding gate',(a,EDGE-.08),(c,EDGE-.08),PLATFORM)
        obj=b.box('Shuttle boarding marker',(center,EDGE-.06,PLATFORM+.01),(1.48,.10,.02),'Gunmetal',0)
        obj['gateCenter']=center;cursor=c
    screen('Shuttle platform fixed screen',(cursor,EDGE-.08),(13,EDGE-.08),PLATFORM)
    guard_path('Shuttle platform east return',[
        *plan_arc(13,EDGE-.8,.72,90,0,PLATFORM),
        *plan_arc(13,FRONT+.8,.72,0,-90,PLATFORM),
        (10.44,FRONT+.08,PLATFORM),(10.44,FRONT,PLATFORM)])
    petal(-6.8,9.7);petal(5.4,8.3)
    for x in [-7.0,4.5]:
        profile=[(21.66,PLATFORM+.48),(22.15,PLATFORM+.48),(22.15,PLATFORM+.55),
            (21.75,PLATFORM+.59),(21.64,PLATFORM+.97),(21.55,PLATFORM+.95)]
        craft.soften(craft.profile_beam('Shuttle sculpted timber seat',profile,x-1.45,x+1.45,0,'Wood'),.06,4)
        for dx in [-1.1,1.1]:b.cylinder('Shuttle bench support',(x+dx,21.84,PLATFORM+.23),.095,.46,'Deep teal',16)
    # A single round station clock replaces the advertising boards.
    b.cylinder('Shuttle clock case',(-.8,21.46,PLATFORM+2.3),.41,.12,'Deep teal',48,(math.pi/2,0,0))
    b.cylinder('Shuttle clock face',(-.8,21.39,PLATFORM+2.3),.34,.025,'Pale ceramic',48,(math.pi/2,0,0))
    b.tube('Shuttle clock hands',[(-1.03,21.367,PLATFORM+2.3),(-.8,21.367,PLATFORM+2.3),(-.8,21.367,PLATFORM+2.55)],.025,'Deep teal')
    b.cylinder('Shuttle clock stem',(-.8,21.46,PLATFORM+.98),.065,1.96,'Deep teal',16)
    access_stair();lift()


def build():
    _guard_posts.clear()
    b.collection('06 · Arc metro station')
    # A slim, softly profiled beam and three flared piers replace the heavy girder.
    bottom=RAIL_TOP-1.24;deck=RAIL_TOP-.23
    profile=[(24.78,deck),(29.22,deck),(29.20,deck-.22),(28.67,deck-.41),
             (28.12,bottom),(25.88,bottom),(25.33,deck-.41),(24.80,deck-.22)]
    craft.soften(craft.profile_beam('Shuttle sculpted viaduct',profile,-30.5,30.5,0,'Paving stone'),.12,5)
    for x in [-23,0,23]:
        rings=[[(xx,yy,z) for xx,yy in b.rounded(x,TRACK_Y,w,d,r,12)] for z,w,d,r in
            [(.8,1.18,1.58,.47),(bottom-.9,1.12,1.50,.47),(bottom-.18,2.22,2.95,.65)]]
        loft('Shuttle flared viaduct pier',rings,'Paving stone')
        b.slab('Shuttle pier bearing',(x,TRACK_Y),1.92,2.62,bottom-.18,.18,'Gunmetal',.4)
    # The central platform is supported by two branches from its own lower pier.
    for x in [-9,9]:
        profile=[(21.35,PLATFORM-.36),(26.40,PLATFORM-.36),(27.8,5.45),(27.8,4.60),
                 (25.90,4.60),(24.60,PLATFORM-1.15),(21.35,PLATFORM-1.15)]
        craft.soften(craft.profile_beam('Shuttle platform swept bracket',profile,x-.30,x+.30,0,'Paving stone'),.13,5)
        b.cylinder('Shuttle platform support',(x,27,2.70),.43,3.8,'Paving stone',32)
    # Rails lie directly in a smooth bed. A covered conductor removes wire clutter.
    b.box('Shuttle flush track bed',(0,27,RAIL_TOP-.20),(61,2.5,.08),'Soot concrete',.015)
    for i in range(62):
        b.box('Shuttle inset sleeper',(-30+i*.984,27,RAIL_TOP-.136),(.22,1.98,.048),'Gunmetal',.015)
    for y in [26.2825,27.7175]:
        b.box('Shuttle rail web',(0,y,RAIL_TOP-.079),(61,.095,.105),'Gunmetal',.02)
        b.box('Steel running rail',(0,y,RAIL_TOP-.026),(61,.14,.052),'Aluminium',.01)
    b.box('Shuttle covered conductor',(0,28.42,RAIL_TOP+.015),(60,.25,.21),'Pale ceramic',.07)
    # Compact opaque bases carry clear guards; no dense picket or wire grid.
    for y in [24.85,29.15]:
        b.box('Shuttle low edge upstand',(0,y,deck+.14),(61,.18,.32),'Paving stone',.05)
        segments=[(-30,30)] if y>27 else [(-30,-13.9),(13.9,30)]
        for a,c in segments:
            for i in range(math.ceil((c-a)/6)):
                left=a+i*6;right=min(c,left+6)
                screen('Shuttle viaduct clear guard',(left,y),(right,y),deck+.30,.93)
    station()
    for x in [-29.6,29.6]:
        b.box('Shuttle sculpted buffer shoe',(x,27,RAIL_TOP+.28),(.72,2.0,.56),'Deep teal',.18)
        b.box('Shuttle buffer cushion',(x-math.copysign(.39,x),27,RAIL_TOP+.57),(.16,1.60,.42),'Gunmetal',.12)
    b.status('Cartoon elevated railway modeled')
