"""Original soft miniature shuttle. Hollow, glazed coaches, local Y travel."""
import json, math
from pathlib import Path
import build_city as b
import craftsmanship as craft
from detailed_assets import mesh_object
from mathutils import Vector

CONFIG=json.loads((Path(__file__).resolve().parents[2]/'src/railConfig.json').read_text())
RAIL_TOP=CONFIG['railTop']; TRACK_Y=CONFIG['trackY']; FLOOR=CONFIG['floorAboveRail']
CAR_CENTRES=CONFIG['carCentres']; DOORS=CONFIG['doorOffsets']
HALF_LENGTH=CONFIG['trainHalfLength']; BODY_HALF=CONFIG['bodyHalfLength']


def loft(name,rings,mat,cap=True):
    n=len(rings[0]);verts=[p for ring in rings for p in ring]
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))] if cap else []
    for j in range(len(rings)-1):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    return mesh_object(name,verts,faces,mat,True)


def car_plan(w,d,r,outward,cuts=False):
    # Cab corners remain generous; the mating end has a flatter bulkhead so
    # its gangway can seal against a real opening instead of curved windows.
    outline=[]
    for sx,sy,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
        radius=r if sy==outward else r*(.22/.85)
        for i in range(19):
            theta=math.radians(start+i*90/18)
            outline.append((sx*(w/2-radius)+radius*math.cos(theta),
                            sy*(d/2-radius)+radius*math.sin(theta)))
    if not cuts:return outline
    plan=[]
    for a,c in zip(outline,outline[1:]+outline[:1]):
        plan.append(a)
        axis=1 if abs(a[0]-c[0])<.00001 else 0
        values=[*[v for dy in DOORS for v in [dy-.65,dy+.65]],outward*3.30] if axis==1 else [-1.02,1.02]
        if abs(a[axis]-c[axis])<1:continue
        inside=sorted([v for v in values if min(a[axis],c[axis])+.00001<v<max(a[axis],c[axis])-.00001],reverse=c[axis]<a[axis])
        for v in inside:plan.append((a[0],v) if axis==1 else (v,a[1]))
    return plan


def is_door(a,c):
    return abs(a[0]-c[0])<.00001 and any(abs((a[1]+c[1])/2-dy)<.65 for dy in DOORS)


def pill_band(name,cy,spec,mat,cap=True,openings=False):
    outward=1 if cy>0 else -1
    plans=[car_plan(w,d,r,outward,openings) for z,w,d,r in spec]
    rings=[[(x,cy+y,z) for x,y in plan] for (z,w,d,r),plan in zip(spec,plans)]
    if not openings:
        obj=loft(name,rings,mat,cap)
        if cap:
            # A cap is planar; smoothing its normal across the shoulder creates
            # visible dimples on the otherwise smooth compound roof.
            obj.data.polygons[0].use_smooth=False;obj.data.polygons[1].use_smooth=False
            n=len(rings[0]);last=(len(rings)-1)*n
            for edge in obj.data.edges:
                a,c=edge.vertices
                if (a<n and c<n) or (a>=last and c>=last):edge.use_edge_sharp=True
        return obj
    n=len(plans[0]);assert all(len(p)==n for p in plans)
    faces=[]
    for j in range(len(rings)-1):
        for i in range(n):
            a,c=plans[j][i],plans[j][(i+1)%n]
            rear=abs(a[1]-c[1])<.00001 and (a[1]+c[1])*outward<0 and abs((a[0]+c[0])/2)<1.02
            if spec[j][0]>=FLOOR-.001 and (rear or is_door(a,c)):continue
            faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    return mesh_object(name,[v for ring in rings for v in ring],faces,mat,True)


def flank_point(side,cy,y,z,offset=0):
    """One shared surface for glass, door leaves, seals, buttons and surrounds."""
    if z<1.14:x=1.46+.04*max(0,z-.82)/.32
    else:x=1.5
    t=max(0,min(1,(z-1.78)/1.36))
    return (side*(x-.048*t+offset),cy+y*(1-.018*t),z)


def door_surround(side,cy,dy):
    outer=b.rounded(dy,2.035,1.44,2.17,.18,10)
    inner=b.rounded(dy,2.035,1.30,2.03,.11,10)
    rings=[[flank_point(side,cy,y,z,offset) for y,z in outline]
           for offset,outline in [(-.010,outer),(.022,outer),(.022,inner),(-.010,inner)]]
    n=len(outer);faces=[]
    for j in range(4):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,((j+1)%4)*n+(i+1)%n,((j+1)%4)*n+i))
    obj=mesh_object('Shuttle fitted door surround',[v for ring in rings for v in ring],faces,'Rail cream',True)
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    obj['surfaceFitted']=True


def glazing(cy):
    # Insert door boundaries in the straight sides of the rounded plan. This
    # partitions real glass, instead of sticking dark rectangles on solid walls.
    outward=1 if cy>0 else -1;plan=car_plan(3,9.6,.85,outward,True)
    groups={'Metro passenger glazing':[], 'Metro glazed plug door':[], 'Shuttle mating bulkhead':[]}
    for a,c in zip(plan,plan[1:]+plan[:1]):
        # The front now has a separate framed cockpit, not passenger glass
        # wrapped around the nose. Its edge shares this exact 3.30 m station.
        if (a[1]+c[1])/2*outward>3.30:continue
        rear=(a[1]+c[1])/2*outward<-4.57
        if rear and abs((a[0]+c[0])/2)<1.02:continue
        groups['Shuttle mating bulkhead' if rear else 'Metro glazed plug door' if is_door(a,c) else 'Metro passenger glazing'].append((a,c))
    for name,segments in groups.items():
        vertices=[];faces=[]
        for a,c in segments:
            i=len(vertices)
            vertices.extend([(a[0],cy+a[1],1.78),(c[0],cy+c[1],1.78),
                             (c[0]*.968,cy+c[1]*.982,3.14),(a[0]*.968,cy+a[1]*.982,3.14)])
            faces.append((i,i+1,i+2,i+3))
        obj=mesh_object(name,vertices,faces,'Rail slate' if name=='Shuttle mating bulkhead' else 'Metro solar glass',True)
        obj['hollowCabin']=True
    # A shaped header closes the bulkhead above the actual gangway opening.
    y=-outward*4.8
    mesh_object('Shuttle gangway opening head',[(-1.02,cy+y*.9836,3.02),(1.02,cy+y*.9836,3.02),
        (1.02,cy+y*.982,3.14),(-1.02,cy+y*.982,3.14)],[(0,1,2,3)],'Rail slate')
    # The lower door skins replace cut-out shell faces. Surrounds conform to
    # both the lower tumblehome and the rake of the glazing, including Y taper.
    for side in [-1,1]:
        for dy in DOORS:
            door_surround(side,cy,dy)
            for lo,hi in [(dy-.65,dy-.009),(dy+.009,dy+.65)]:
                verts=[];faces=[]
                for j,z in enumerate([.95,1.14,1.59,1.78]):
                    verts.extend([flank_point(side,cy,lo,z,-.002),flank_point(side,cy,hi,z,-.002)])
                    if j:faces.append((2*j-2,2*j-1,2*j+1,2*j))
                mesh_object('Shuttle formed lower door leaf',verts,faces,'Rail slate',True)
            b.tube('Shuttle door central seal',[flank_point(side,cy,dy,z,.010) for z in [1.0,1.14,1.78,3.075]],.016,'Rail graphite')
            obj=b.box('Metro level door threshold',(side*1.505,cy+dy,FLOOR-.024),(.08,1.30,.048),'Aluminium',.012)
            obj['doorCenter']=cy+dy
            b.cylinder('Shuttle inset door button bezel',flank_point(side,cy,dy+.39,1.46,.009),.059,.020,'Rail graphite',20,(0,math.pi/2,0))
            b.cylinder('Shuttle accessible door button',flank_point(side,cy,dy+.39,1.46,.022),.035,.014,'Rail cream',20,(0,math.pi/2,0))
        for yy in [-outward*3.50,0]:
            b.tube('Shuttle soft window pillar',[flank_point(side,cy,yy,z,.002) for z in [1.78,3.12]],.042,'Rail cream')
    # A continuous gasket closes the roof/glass seam, with no floating border.
    outline=car_plan(3*.968,9.6*.982,.85*.97,outward)
    b.tube('Shuttle continuous roof gasket',[(x,cy+y,3.135) for x,y in outline],.025,'Rail graphite',True)


def bogie(cy):
    b.slab('Shuttle tucked bogie frame',(0,cy),1.95,1.85,.26,.28,'Gunmetal',.24)
    b.slab('Shuttle connected bogie bolster',(0,cy),1.65,.90,.50,.38,'Gunmetal',.20)
    for dy in [-.58,.58]:
        for side in [-1,1]:
            b.cylinder('Metro steel wheel',(side*.7175,cy+dy,.34),.34,.16,'Gunmetal',24,(0,math.pi/2,0))
            b.cylinder('Shuttle inset wheel hub',(side*.808,cy+dy,.34),.17,.018,'Aluminium',20,(0,math.pi/2,0))
    for side in [-1,1]:
        b.box('Shuttle smooth bogie cheek',(side*1.04,cy,.43),(.12,1.78,.24),'Gunmetal',.12)


def saloon(cy,outward):
    body=pill_band('Shuttle hollow rounded shell',cy,[(.66,2.64,9.26,.82),(.82,2.92,9.53,.85),
        (.95,2.9525,9.55844,.85),(1.14,3.0,9.6,.85),(1.76,3.0,9.6,.85)],'Rail slate',False,True)
    body['bodyLength']=9.6;body['bodyWidth']=3;body['doorPairsPerSide']=2;body['hollowCabin']=True
    b.poly('Shuttle passenger floor',[(x,cy+y) for x,y in car_plan(2.86,9.4,.75,outward)],FLOOR-.1,.1,'Paving stone',.015)
    pill_band('Shuttle cream waist ribbon',cy,[(1.59,3.012,9.612,.856),(1.78,3.012,9.612,.856)],'Rail cream',False,True)
    glazing(cy)
    # An elliptical shoulder meets a narrow, planar crown. Dense analytic
    # stations remove the old five-ring roof's broad cap shading dimples.
    roof=[]
    for degrees in [*range(0,89,8),89.3]:
        angle=math.radians(degrees);width=2.918*math.cos(angle)
        roof.append((3.14+.63*math.sin(angle),width,8.44+1.005*math.cos(angle),.84*math.cos(angle)))
    pill_band('Shuttle moulded roof',cy,roof,'Rail cream')
    for dy in [-2.9,2.9]:bogie(cy+dy)
    # Minimal upholstered benches, sensibly sized below the panoramic glazing.
    for side in [-1,1]:
        profile=[(.80,1.36),(1.21,1.36),(1.37,1.48),(1.39,1.94),(1.28,1.99),
                 (1.26,1.54),(1.17,1.48),(.80,1.48)]
        craft.soften(craft.profile_beam('Shuttle upholstered bench',[(side*x,z) for x,z in profile],cy-1.56,cy+1.56,1,'Rail slate'),.07,4)
        for yy in [cy-1.2,cy+1.2]:b.box('Shuttle seat pedestal',(side*1.18,yy,1.16),(.12,.15,.43),'Gunmetal',.04)
    # The complete lit envelope remains below the window and inside the roof.
    a,c=cy-4.0,cy+4.0
    ceiling=[(x,cy+y,3.128) for x,y in car_plan(2.82,9.26,.74,outward)]
    floor=[(x,cy+y,.956) for x,y in car_plan(2.80,9.26,.72,outward)]
    for name,verts,levels in [
        ('ceiling',list(reversed(ceiling)),[.60]*len(ceiling)),
        ('floor',floor,[.16]*len(floor)),
        ('left',[(-1.43,a,.96),(-1.43,c,.96),(-1.43,c,1.71),(-1.43,a,1.71)],[.12,.12,.28,.28]),
        ('right',[(1.43,c,.96),(1.43,a,.96),(1.43,a,1.71),(1.43,c,1.71)],[.12,.12,.28,.28])]:
        if len(verts)==4:
            craft.lit_lining('Metro cabin continuous bounce '+name,verts,'Metro interior',levels)
        else:
            obj=mesh_object('Metro cabin continuous bounce '+name,verts,[tuple(range(len(verts)))],'Metro interior')
            uv=obj.data.uv_layers.new(name='RoomUV')
            for i,level in enumerate(levels):uv.data[i].uv=(.2 if i%3==0 else .8,level)
            obj['interiorBounce']=True
    for x in [-.95,.95]:b.box('Shuttle recessed ceiling diffuser',(x,cy,3.112),(.12,7.6,.024),'Metro fluorescent',.008)
    import train_cab
    train_cab.build(cy,outward)


def gangway():
    # A continuous folded membrane replaces the disconnected glossy hoops.
    rings=[]
    for i in range(33):
        y=-.44+.88*i/32;wave=.5-.5*math.cos(i/32*math.tau*4)
        rings.append([(x,y,z) for x,z in b.rounded(0,2.06,2.18+.12*wave,2.34+.12*wave,.25,12)])
    membrane=loft('Shuttle sealed accordion membrane',rings,'Rail graphite',False)
    import bmesh
    bm=bmesh.new();bm.from_mesh(membrane.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(membrane.data);bm.free()
    membrane.modifiers.new('Flexible membrane thickness','SOLIDIFY').thickness=.025
    membrane['continuousGangway']=True
    for y in [-.425,.425]:
        ring=b.rounded(0,2.06,2.18,2.34,.25,12)
        b.tube('Shuttle fitted gangway collar',[(x,y,z) for x,z in ring],.052,'Rail graphite',True)
    inner=[[(x,y,z) for x,z in b.rounded(0,2.005,2.02,2.11,.16,12)] for y in [-.48,.48]]
    loft('Shuttle gangway inner lining',inner,'Rail graphite',False)
    b.box('Shuttle gangway floor',(0,0,.91),(2.04,1.0,.08),'Aluminium',.018)


def train():
    b.room_material('Metro interior','#ffe8bb',.85)
    b.material('Metro fluorescent','#fff0cf',.36,0,1.8)
    b.material('Metro solar glass','#343c47',.19,.08,alpha=.65)
    b.collection('Metro')
    for cy in CAR_CENTRES:saloon(cy,-1 if cy<0 else 1)
    gangway()
    b.status('Cartoon shuttle modeled')
