"""Harbor Galleria: a compact three-storey corner emporium below a planted roof.

Shrunk from the original four-storey 28 x 26 m department store to a 17 x 15 m
block under a 13.42 m roof, so the eastern quarter reads as part of the harbour
neighbourhood instead of one dominant shed. The approved south entrance bay,
canopy, threshold and lift cabin keep their authored geometry; the interior was
re-laid inside the smaller plan. Original Blender geometry informed by KPF's
K11 MUSEA and Safdie's Jewel. Dimensions are metres.
"""
import math
import random
import json
from pathlib import Path
import bpy
from mathutils import Vector
import build_city as b
import craftsmanship as craft
import public_realm as realm
from detailed_assets import mesh_object, glass_panel
from mall_plan import (CONFIG,PLAN,CX,CY,HALF_X,HALF_Y,WEST,EAST,SOUTH,NORTH,CORNER,FACE,
    FLOORS,GROUND,GALLERY,LIBRARY,ROOF,CEILING,ATRIUM,BRIDGE,ESC,LIFT,SCREENS,
    FRONT_Y,REAR_Y,WEST_X,EAST_X)


def ellipse(cx, cy, rx, ry, count=96):
    return [(cx+rx*math.cos(i*math.tau/count),cy+ry*math.sin(i*math.tau/count)) for i in range(count)]


def guard(name, points, height=1.12):
    """Continuous bronze cap and laminated infill, including curved returns."""
    b.tube(name+' rounded cap',[(x,y,z+height) for x,y,z in points],.045,'Copper')
    verts=[];faces=[]
    for i,(x,y,z) in enumerate(points):
        verts += [(x,y,z+.06),(x,y,z+height-.045)]
        if i:faces.append((2*i-2,2*i,2*i+1,2*i-1))
    pane=mesh_object(name+' glass infill',verts,faces,'Window glass')
    pane.modifiers.new('Laminated infill thickness','SOLIDIFY').thickness=.018
    travelled=2.0
    for i,p in enumerate(points):
        if i:travelled+=(Vector(p)-Vector(points[i-1])).length
        if travelled>=1.5 or i==len(points)-1:
            b.cylinder(name+' clamped post',(p[0],p[1],p[2]+height/2),.036,height,'Copper',12)
            travelled=0
    b.tube(name+' continuous shoe',[(x,y,z+.045) for x,y,z in points],.032,'Copper')


def framed_window(name, a, c, z0, z1, bays):
    """Actual glazing between substantial, gently rounded bronze extrusions."""
    ax,ay=a;cx,cy=c
    for i in range(bays+1):
        t=i/bays;x=ax+(cx-ax)*t;y=ay+(cy-ay)*t
        b.box(name+' mullion',(x,y,(z0+z1)/2),(.085,.085,z1-z0+.12),'Copper',.016)
    for z in [z0,z1]:
        b.tube(name+' perimeter transom',[(ax,ay,z),(cx,cy,z)],.055,'Copper')
    for i in range(bays):
        u=(i+.025)/bays;v=(i+.975)/bays
        x0=ax+(cx-ax)*u;y0=ay+(cy-ay)*u
        x1=ax+(cx-ax)*v;y1=ay+(cy-ay)*v
        glass_panel(name+' recessed pane',[(x0,y0,z0+.04),(x1,y1,z0+.04),(x1,y1,z1-.04),(x0,y0,z1-.04)])


def escalator(x, direction, lower=GROUND, upper=GALLERY):
    """Formed closed truss, inset treads, combs and curved glass balustrades."""
    start,end=ESC['start'],ESC['end']
    rise=upper-lower
    profile=[(start-.9,lower-.14),(start-.9,lower-.04),(start,lower-.04),
             (end,upper-.10),(end+.8,upper-.10),(end+.8,upper-.22),
             (end-.25,upper-.45),(start-.2,lower-.14)]
    craft.soften(craft.profile_beam('Galleria escalator enclosed truss',profile,x-.69,x+.69,0,'Aluminium'),.055,3)
    for i in range(24):
        yy=start+(i+.5)*.3;zz=lower+(i+1)*rise/24
        b.box('Galleria escalator recessed tread',(x,yy,zz-.06),(1.10,.296,.12),'Gunmetal',.012)
        b.box('Galleria escalator nosing',(x,yy-.14,zz+.002),(1.05,.022,.014),'Copper',.004)
    for yy,zz in [(start-.44,lower),(end+.40,upper)]:
        b.box('Galleria escalator comb plate',(x,yy,zz+.012),(1.10,.84,.026),'Aluminium',.008)
    for xx in [x-.66,x+.66]:
        # The complete side follows the slope; rounded ends protect the return.
        path=[(xx,start-.78,lower+.23),(xx,start-.93,lower+.53),
              (xx,start-.84,lower+.83),(xx,start-.61,lower+1.02),
              (xx,start-.18,lower+1.06),(xx,end+.10,upper+1.06),
              (xx,end+.65,upper+1.06),(xx,end+.91,upper+.89),
              (xx,end+.99,upper+.60),(xx,end+.84,upper+.31)]
        b.tube('Galleria escalator moulded moving handrail',path,.060,'Gunmetal')
        side=[(xx,start-.72,lower-.04),(xx,end+.78,upper-.10),
              (xx,end+.78,upper+.90),(xx,end+.08,upper+.98),
              (xx,start-.20,lower+.98),(xx,start-.72,lower+.90)]
        pane=mesh_object('Galleria escalator curved glass skirt',side,[tuple(range(len(side)))],'Window glass')
        pane.modifiers.new('Toughened side glass','SOLIDIFY').thickness=.025
    # Small direction arrow, no labels or people.
    yy=start-.5
    z=lower+.03
    pts=[(x-.16,yy,z),(x+.16,yy,z),(x,yy+.25*direction,z)]
    mesh_object('Galleria escalator direction inlay',pts,[(0,1,2)],'Pale ceramic')


def roof_lantern():
    """One softly curved, elliptical glass roof over the reduced atrium."""
    rx,ry=3.30,4.60
    lx,ly=ATRIUM['cx'],ATRIUM['cy']
    ring=b.poly('Galleria fitted rooflight upstand',ellipse(lx,ly,rx+.18,ry+.18),ROOF-.15,.33,'Copper',0)
    realm.apply_difference(ring,[b.poly('Temporary rooflight ring void',ellipse(lx,ly,rx-.05,ry-.05),ROOF-.3,.7,'Copper',0)])
    craft.soften(ring,.025,3)
    sides,rings=72,12;vertices=[];faces=[]
    for j in range(rings):
        theta=(math.pi/2)*(j/rings)
        for i in range(sides):
            a=i*math.tau/sides
            vertices.append((lx+rx*math.cos(theta)*math.cos(a),ly+ry*math.cos(theta)*math.sin(a),ROOF+.13+2.35*math.sin(theta)))
    for j in range(rings-1):
        for i in range(sides):
            k=j*sides+i;n=j*sides+(i+1)%sides
            faces.append((k,n,n+sides,k+sides))
    vertices.append((lx,ly,ROOF+2.48));apex=len(vertices)-1
    for i in range(sides):faces.append(((rings-1)*sides+i,(rings-1)*sides+(i+1)%sides,apex))
    mesh_object('Galleria continuous glass lantern',vertices,faces,'Window glass',True)
    for i in range(12):
        a=i*math.tau/12
        points=[(lx+rx*math.cos(t)*math.cos(a),ly+ry*math.cos(t)*math.sin(a),ROOF+.15+2.35*math.sin(t)) for t in [j*math.pi/48 for j in range(25)]]
        b.tube('Galleria formed lantern rib',points,.060,'Copper')
    for theta in [.35,.75,1.13]:
        points=[(lx+rx*math.cos(theta)*math.cos(a),ly+ry*math.cos(theta)*math.sin(a),ROOF+.15+2.35*math.sin(theta)) for a in [i*math.tau/72 for i in range(72)]]
        b.tube('Galleria lantern ring beam',points,.045,'Copper',True)


def interiors():
    import mall_interior
    mall_interior.build()
    # One broad emitter per storey keeps the compact rooms directly lit without
    # adding global real-time lights; the ground emitter may spill onto the quay.
    mall_interior.ceiling_light('Galleria ground ceiling',(CX,CY,CEILING[GROUND]-.10),5200,(15.0,13.0),(CX,CY,GROUND),.35)
    mall_interior.ceiling_light('Galleria gallery ceiling',(CX,CY,CEILING[GALLERY]-.10),4500,(15.0,13.0),(CX,CY,GALLERY),.40)
    mall_interior.ceiling_light('Galleria library ceiling',(CX,CY,CEILING[LIBRARY]-.10),4500,(15.0,13.0),(CX,CY,LIBRARY),.40)
    pair_x=ESC['x'];half=BRIDGE['bridgeHalf'];ay=BRIDGE['arrivalY'];dy=BRIDGE['departureY']
    for index,(lower,upper) in enumerate(zip(FLOORS,FLOORS[1:])):
        for x,direction in zip(pair_x,(1,-1)):escalator(x,direction,lower,upper)
        onwards=index==0
        # Real annular floors and protected bridges serve every escalator pair.
        b.box('Galleria upper arrival bridge',(CX,ay,upper-.14),(half*2,1.05,.28),'Ochre plaster',.025)
        guard('Galleria bridge rear',[(CX-half,ay+.53,upper),(CX+half,ay+.53,upper)])
        for a,c in [(CX-half,pair_x[0]-.73),(pair_x[1]+.73,CX+half)]:
            guard('Galleria bridge arrival',[(a,ay-.53,upper),(c,ay-.53,upper)])
        guard('Galleria bridge centre protection',[(pair_x[0]+.73,ay-.53,upper),(pair_x[1]-.73,ay-.53,upper)])
        if onwards:
            b.box('Galleria upper departure bridge',(CX,dy,upper-.14),(half*2,1.05,.28),'Ochre plaster',.025)
            guard('Galleria departure front',[(CX-half,dy-.53,upper),(CX+half,dy-.53,upper)])
            for a,c in [(CX-half,pair_x[0]-.73),(pair_x[1]+.73,CX+half)]:
                guard('Galleria departure protected return',[(a,dy+.53,upper),(c,dy+.53,upper)])
            guard('Galleria departure centre protection',[(pair_x[0]+.73,dy+.53,upper),(pair_x[1]-.73,dy+.53,upper)])
        # The atrium guard follows the void perimeter and breaks only at the two
        # bridge crossings, so no railing ever crosses a moving stair.
        path=[]
        for i in range(145):
            a=i*math.tau/144;x=ATRIUM['cx']+ATRIUM['rx']*math.cos(a);y=ATRIUM['cy']+ATRIUM['ry']*math.sin(a)
            if abs(y-ay)<.60 or (onwards and abs(y-dy)<.60):
                if len(path)>1:guard('Galleria atrium gallery',path)
                path=[]
            else:path.append((x,y,upper))
        if len(path)>1:guard('Galleria atrium gallery',path)
    guard('Galleria double height foyer guard',[(42.15,FRONT_Y+.30,GALLERY),(42.15,-5.85,GALLERY),
        (49.85,-5.85,GALLERY),(49.85,FRONT_Y+.30,GALLERY)])
    # Continuous warm ceiling washes keep the wings and the rear gallery legible.
    for x,y0,y1,top in [(39.32,-.4,2.30,8.95),(52.68,-.4,3.70,8.95),
                        (39.32,-.4,2.30,12.95),(52.68,-.4,3.70,12.95)]:
        craft.lit_lining('Galleria upper ceiling bounce',[(x-1.25,y0,top),(x-1.25,y1,top),(x+1.25,y1,top),(x+1.25,y0,top)],'Honey interior',[.60,.60,.65,.65])
        b.tube('Galleria upper recessed light',[(x,y0+.55,top-.05),(x,y1-.55,top-.05)],.033,'Warm neon')
    for z,floor in [(8.95,GALLERY),(12.95,LIBRARY)]:
        craft.lit_lining('Galleria end ceiling bounce',[(40.35,4.35,z),(40.35,5.65,z),(51.65,5.65,z),(51.65,4.35,z)],'Honey interior',[.65]*4)
        b.tube('Galleria end recessed light',[(41.20,5.00,z-.05),(50.80,5.00,z-.05)],.033,'Warm neon')
    mall_interior.ceiling_light('Galleria entrance ceiling',(CX,-7.2,CEILING[GALLERY]-.32),300,(6.4,2.6),(CX,-7.2,GROUND))
    import mall_levels
    mall_levels.library(LIBRARY)
    mall_interior.ceiling_light('Galleria library rear ceiling',(CX,4.9,CEILING[LIBRARY]-.10),600,(11.0,1.6),(CX,4.9,LIBRARY))


def promenade_guard():
    # Follow the eased shoreline return without generating a post at every
    # curve sample. The first support is the existing promenade's end post.
    path=[(18,-21),(18.35,-21),(18.65,-20.95),(18.90,-20.7),
          (19.0,-20.35),(19.2,-19.8),(19.6,-19.4),(20,-19.35),(59,-19.35)]
    for height,radius in [(.93,.08),(.93*.48,.06)]:
        b.tube('Mall promenade continuous rail',[(x,y,.8+height) for x,y in path],radius,'Deep teal')
    supports=[(18.65,-20.95),(20,-19.35)]+[(20+39*i/19,-19.35) for i in range(1,20)]
    for x,y in supports:
        b.cylinder('Mall promenade round post',(x,y,1.265),.09,.93,'Gunmetal',12)
        b.cylinder('Mall promenade foot socket',(x,y,.865),.15,.13,'Deep teal',16)
        b.cylinder('Mall promenade bronze cap',(x,y,1.755),.115,.08,'Copper',16,r2=.085)


def build():
    b.collection('07 · Harbor galleria')
    outline=b.rounded(CX,CY,HALF_X*2,HALF_Y*2,CORNER,18)
    b.poly('Galleria continuous terrazzo floor',outline,.8,.14,'Paving stone',.015)
    shell=b.poly('Galleria continuous limestone envelope',outline,.8,ROOF-.8,'Ochre plaster',0)
    cutters=[b.poly('Temporary mall interior',b.rounded(CX,CY,HALF_X*2-.7,HALF_Y*2-.7,CORNER-.3,18),.90,ROOF-1.35,'Gunmetal',0)]
    # Two retail storeys of real apertures on every face. Each cut matches the
    # extent of the glazing that fills it, so no unglazed gap is left open.
    for z,h in [(2.73,3.48),(6.93,3.06)]:
        cutters.append(b.box('Temporary mall front aperture',(CX,SOUTH,z),(11.96,1.4,h),'Gunmetal',0))
        cutters.append(b.box('Temporary mall rear aperture',(CX,NORTH,z),(11.76,1.4,h),'Gunmetal',0))
        cutters.append(b.box('Temporary mall west aperture',(WEST,CY,z),(1.4,6.96,h),'Gunmetal',0))
        cutters.append(b.box('Temporary mall east aperture',(EAST,CY-.60,z),(1.4,8.96,h),'Gunmetal',0))
    cutters.append(b.box('Temporary double height entrance',(CX,SOUTH,4.94),(7.6,1.6,8.28),'Gunmetal',0))
    # The library storey has solid media bays; adverts never cover shop windows.
    for x in [41.00,51.00]:cutters.append(b.box('Temporary library front window',(x,SOUTH,11.09),(1.96,1.4,3.06),'Gunmetal',0))
    cutters.append(b.box('Temporary library rear window',(CX,NORTH,11.09),(9.16,1.4,3.06),'Gunmetal',0))
    cutters.append(b.box('Temporary library east window',(EAST,-2.40,11.09),(1.4,4.16,3.06),'Gunmetal',0))
    cutters.append(b.poly('Temporary mall skylight',ellipse(ATRIUM['cx'],ATRIUM['cy'],3.30,4.60),ROOF-.7,2,'Gunmetal',0))
    cutters.append(b.box('Temporary roof lift opening',(LIFT['x'],LIFT['y'],ROOF),(2.9,2.9,1.2),'Gunmetal',0))
    realm.apply_difference(shell,cutters);craft.soften(shell,.045,3)
    for face in shell.data.polygons:face.use_smooth=True
    shell['continuousEnvelope']=True
    for level,floor in enumerate(FLOORS[1:],2):
        gallery=b.poly('Galleria continuous upper gallery',b.rounded(CX,CY,HALF_X*2-.6,HALF_Y*2-.6,CORNER-.25,18),floor-.30,.30,'Ochre plaster',0)
        cuts=[b.poly('Temporary gallery atrium',ellipse(ATRIUM['cx'],ATRIUM['cy'],ATRIUM['rx'],ATRIUM['ry']),floor-.5,.9,'Gunmetal',0),
              b.box('Temporary gallery lift void',(LIFT['x'],LIFT['y'],floor),(2.9,2.9,1),'Gunmetal',0)]
        if level==2:cuts.append(b.box('Temporary gallery entrance void',(CX,-7.30,floor-.30),(7.7,2.80,.9),'Gunmetal',0))
        realm.apply_difference(gallery,cuts);craft.soften(gallery,.025,3)
        gallery['mallFloor']=level
    # Continuous formed belts and crown, fitted to the same rounded footprint.
    for name,z,h,w,d,r in [('Galleria continuous floor cornice',4.62,.50,HALF_X*2+.24,HALF_Y*2+.24,CORNER+.12),
                          ('Galleria library cornice',8.91,.35,HALF_X*2+.24,HALF_Y*2+.24,CORNER+.12),
                          ('Galleria continuous crown',ROOF-.18,.30,HALF_X*2+.30,HALF_Y*2+.30,CORNER+.15)]:
        ring=b.poly(name,b.rounded(CX,CY,w,d,r,18),z,h,'Awning cream',0)
        cuts=[b.poly('Temporary ring inside',b.rounded(CX,CY,HALF_X*2-1.5,HALF_Y*2-1.5,CORNER-.63,18),z-.1,h+.2,'Gunmetal',0)]
        if z<5:cuts.append(b.box('Temporary entrance belt opening',(CX,SOUTH,z+.2),(7.6,2,1),'Gunmetal',0))
        realm.apply_difference(ring,cuts);craft.soften(ring,.065,4)
    for z0,z1 in [(1.02,4.42),(5.40,8.46)]:
        framed_window('Galleria front west shop',(40.10,FRONT_Y),(41.90,FRONT_Y),z0,z1,1)
        framed_window('Galleria front east shop',(50.10,FRONT_Y),(51.90,FRONT_Y),z0,z1,1)
        framed_window('Galleria rear curtainwall',(39.90,REAR_Y),(51.50,REAR_Y),z0,z1,4)
        framed_window('Galleria east curtainwall',(EAST_X,-5.00),(EAST_X,3.80),z0,z1,4)
        framed_window('Galleria west curtainwall',(WEST_X,-5.00),(WEST_X,1.80),z0,z1,3)
    for a,c in [(40.10,41.90),(50.10,51.90)]:framed_window('Galleria library front glazing',(a,FRONT_Y),(c,FRONT_Y),9.56,12.62,1)
    framed_window('Galleria library rear glazing',(41.50,REAR_Y),(50.50,REAR_Y),9.56,12.62,3)
    framed_window('Galleria library east glazing',(EAST_X,-4.40),(EAST_X,-.40),9.56,12.62,2)
    # The tall entrance has separate glazed doors and transoms, not a lit decal.
    framed_window('Galleria entrance doors',(42.26,-8.78),(49.74,-8.78),.94,3.62,4)
    framed_window('Galleria atrium entrance glass',(42.26,-8.78),(49.74,-8.78),3.68,9.01,3)
    for x in [45.7,46.3]:b.tube('Galleria entrance pull',[(x,-8.89,1.75),(x,-8.98,1.84),(x,-8.98,2.46),(x,-8.89,2.55)],.032,'Copper')
    # Wide threshold ramps from the 140 mm internal floor to continuous paving.
    craft.profile_beam('Galleria flush accessible threshold',[(-10.3,.8),(-9.0,.94),(-9.0,.79),(-10.3,.79)],42.2,49.8,0,'Paving stone')
    canopy=b.rounded(46,-9.85,11.4,4.0,1.5,16)
    b.poly('Galleria floating formed entrance canopy',canopy,3.82,.27,'Copper',.04)
    b.poly('Galleria canopy ivory surface',canopy,4.09,.09,'Awning cream',.028)
    for x in [42.8,46,49.2]:b.tube('Galleria canopy recessed strip',[(x,-11.15,3.795),(x,-8.70,3.795)],.035,'Warm neon')
    b.area('Galleria canopy wash',(46,-10,3.74),'#ffe0bc',64,8,(46,-10,.8),dimensions=(9,2.8))
    b.text('Galleria brass entrance lettering','G A L L E R I A',(46,-9.065,9.30),.34,'Warm neon')
    roof_lantern();interiors()
    import mall_levels
    mall_levels.rooftop(ROOF,guard)
    mall_levels.lift(CONFIG)
    mall_levels.advertisements(CONFIG)
    # Deliberately open forecourt and an extended, water-facing promenade.
    for x in [34,55]:craft.bench(x,-16.9,.8,2.8,0)
    promenade_guard()
    for x in [30,58]:
        b.streetlight(x,-14.8)
    # No extra paving plates: paths use the same flush island surface.
    b.status('Harbor galleria modeled')
