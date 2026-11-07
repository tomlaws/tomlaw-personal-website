"""Compact framed cockpit, fitted to the shuttle's existing curved shell."""
import math
import bmesh
from mathutils import Vector
import build_city as b
import craftsmanship as craft
from detailed_assets import mesh_object

CAB_START=3.30
HALF_WRAP=.65+math.pi*.85/2+(3.95-CAB_START)


def point(cy,outward,s,z,offset=0):
    """Developed distance across the nose, then around its shoulders."""
    sign=1 if s>=0 else -1;a=abs(s)
    if a<=.65:x=s;y=4.8;normal=Vector((0,outward,0))
    elif a<=.65+math.pi*.85/2:
        angle=(a-.65)/.85;x=sign*(.65+.85*math.sin(angle));y=3.95+.85*math.cos(angle)
        normal=Vector((sign*math.sin(angle),outward*math.cos(angle),0))
    else:x=sign*1.5;y=3.95-(a-.65-math.pi*.85/2);normal=Vector((sign,0,0))
    t=max(0,min(1,(z-1.78)/1.36))
    return Vector((x*(1-.032*t),cy+outward*y*(1-.018*t),z))+normal*offset


def contour(cx,cz,w,h,r):return b.rounded(cx,cz,w,h,r,12)


def surface(name,cy,outward,outer,inner,mat,offset=0,thickness=0):
    """A curved annular surface with a genuine opening, not an opaque decal.

    Subdivide the long spans in developed space before wrapping the mesh so
    horizontal edges follow the nose radius rather than cutting across it.
    """
    rings=[[] for _ in range(5)];n=len(outer)
    for i in range(n):
        a,c=outer[i],outer[(i+1)%n];u,v=inner[i],inner[(i+1)%n]
        steps=max(1,math.ceil(max(abs(a[0]-c[0]),abs(u[0]-v[0]))/.075))
        for j in range(steps):
            t=j/steps;edge=(a[0]*(1-t)+c[0]*t,a[1]*(1-t)+c[1]*t)
            hole=(u[0]*(1-t)+v[0]*t,u[1]*(1-t)+v[1]*t)
            for k in range(5):
                r=k/4;rings[k].append(point(cy,outward,edge[0]*(1-r)+hole[0]*r,edge[1]*(1-r)+hole[1]*r,offset))
    m=len(rings[0]);verts=[p for ring in rings for p in ring]
    faces=[(j*m+i,j*m+(i+1)%m,(j+1)*m+(i+1)%m,(j+1)*m+i) for j in range(4) for i in range(m)]
    obj=mesh_object(name,verts,faces,mat,True)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
    # Developed coordinates wind inward on the positive-Y cab.
    if outward>0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
    if thickness:obj.modifiers.new('Moulded cab panel thickness','SOLIDIFY').thickness=thickness
    obj['cabSurface']=True
    return obj


def disk(name,cy,outward,outline,mat,offset=0):
    centre=(sum(p[0] for p in outline)/len(outline),sum(p[1] for p in outline)/len(outline))
    # The collapsed inner ring is welded by surface(), producing a clean fan.
    return surface(name,cy,outward,outline,[centre]*len(outline),mat,offset)


def build(cy,outward):
    # The window mask is divided only at substantial solid cab pillars.
    # All three panels meet edge-to-edge, including the roof and waist seams.
    regions=[(-1.73,1.73,0,2.455,3.08,1.07,.22,'windscreen'),
             (-HALF_WRAP,-1.73,-2.23,2.47,.59,.87,.10,'left quarter window'),
             (1.73,HALF_WRAP,2.23,2.47,.59,.87,.10,'right quarter window')]
    for lo,hi,s,z,w,h,r,label in regions:
        outer=contour((lo+hi)/2,2.46,hi-lo,1.36,0)
        opening=contour(s,z,w,h,r)
        pane=contour(s,z,w-.075,h-.075,max(.02,r-.035))
        surface('Cab ivory formed '+label+' surround',cy,outward,outer,opening,'Rail cream',0,.036)
        surface('Cab recessed '+label+' gasket',cy,outward,opening,pane,'Rail graphite',-.003,.026)
        glass=disk('Cab inset '+label,cy,outward,pane,'Metro solar glass',-.019)
        glass['hollowCabin']=True
    # One short, parked wiper makes the windscreen legible without a web of lines.
    b.tube('Cab parked windscreen wiper',[point(cy,outward,s,z,.015) for s,z in [(-.47,2.035),(-.12,2.12),(.49,2.12)]],.014,'Rail graphite')
    # Small horizontal optics are nested directly in the painted coachwork.
    for side in [-1,1]:
        s=side*.94;z=1.315
        outer=contour(s,z,.73,.24,.10);inner=contour(s,z,.60,.115,.05)
        bezel=surface('Shuttle recessed lamp bezel',cy,outward,outer,inner,'Rail graphite',.012,.020)
        p=point(cy,outward,s,z);n=(point(cy,outward,s,z,.1)-p).normalized()
        bezel['mountPoint']=list(p);bezel['mountNormal']=list(n)
        disk('Shuttle opal headlamp',cy,outward,inner,'Metro fluorescent',.016)
    # A discreet, dark central service hatch replaces the smiling bumper.
    disk('Cab flush service hatch',cy,outward,contour(0,1.075,.75,.22,.085),'Rail graphite',.003)
    # Cockpit partition behind the driver's seat, clear of the passenger doors.
    y=cy+outward*3.28
    for x in [-.86,.86]:b.box('Cab solid privacy partition',(x,y,2.02),(1.02,.07,2.14),'Rail cream',.025)
    b.box('Cab partition door header',(0,y,2.935),(.70,.07,.31),'Rail cream',.025)
    b.box('Cab access door lower panel',(0,y,1.47),(.70,.06,1.04),'Rail graphite',.025)
    b.box('Cab access door glazed inset',(0,y,2.365),(.66,.035,.73),'Metro solar glass',.025)
    for x in [-.345,.345]:b.box('Cab door jamb',(x,y,2.0),(.035,.085,2.10),'Rail graphite',.012)
    b.box('Cab access handle',(.27,y-outward*.057,1.93),(.035,.045,.15),'Aluminium',.016)
    # Sculpted single seat and sloping console at human scale.
    profile=[(3.48,1.38),(3.94,1.38),(4.03,1.45),(3.99,1.54),(3.62,1.55),
             (3.58,2.17),(3.46,2.19),(3.43,2.12)]
    craft.soften(craft.profile_beam('Cab moulded driver seat',[(cy+outward*u,z) for u,z in profile],-.29,.29,0,'Rail graphite'),.055,4)
    b.cylinder('Cab seat pedestal',(0,cy+outward*3.73,1.18),.13,.46,'Aluminium',20)
    console=[(4.08,1.67),(4.51,1.67),(4.52,1.94),(4.38,2.02),(4.08,1.87)]
    craft.soften(craft.profile_beam('Cab sculpted instrument binnacle',[(cy+outward*u,z) for u,z in console],-.94,.94,0,'Rail graphite'),.055,4)
    b.box('Cab instrument support',(0,cy+outward*4.33,1.32),(.55,.34,.74),'Rail graphite',.06)
    for x in [-.43,.23]:
        panel=b.box('Cab inset display',(x,cy+outward*4.25,1.958),(.43,.20,.012),'Metro solar glass',.023)
        panel.rotation_euler.x=outward*math.atan(.5)
    b.cylinder('Cab traction control',( .72,cy+outward*4.18,1.98),.036,.12,'Aluminium',16)
    b.box('Cab control grip',(.72,cy+outward*4.18,2.05),(.15,.065,.045),'Rail cream',.022)
