"""A brick-and-timber toy emporium, in the harbor's physical miniature style.

Original Blender architecture with a continuous envelope, recessed shopfront,
clerestory roof lantern and stocked, ceiling-lit interior. See asset-references.
"""
import math
import bpy
import bmesh
from mathutils import Vector
import build_city as b
import craftsmanship as craft
import public_realm as realm
from detailed_assets import mesh_object
from mall_interior import lathe, ceiling_light
from craftsmanship import opening_frame as frame, opening_profile

CX,CY=-38.0,-6.0
FRONT,BACK=-10.8,-1.2
FLOOR=.84
BRICK,INK,CREAM,GOLD='Toyshop tobacco brick','Toyshop ink enamel','Toyshop limestone','Toyshop ochre'


def palette(surface):
    for name,color,rough,kind in [(BRICK,'#ddcdb0',.84,'brick'),(INK,'#514653',.46,'plaster'),
                                  (CREAM,'#eee6d4',.74,'plaster'),(GOLD,'#c19c58',.58,'plaster')]:
        surface(name,color,rough,kind)


def ellipsoid(name,p,scale,material):
    # Direct mesh construction avoids reevaluating the entire city for every
    # small plush fitting through Blender's interactive add-object operator.
    sides,rings=20,11;vertices=[(0,0,1)];faces=[]
    for j in range(1,rings+1):
        theta=math.pi*j/(rings+1)
        for i in range(sides):
            phi=math.tau*i/sides
            vertices.append((math.sin(theta)*math.cos(phi),math.sin(theta)*math.sin(phi),math.cos(theta)))
    vertices.append((0,0,-1));south=len(vertices)-1
    for i in range(sides):
        nxt=(i+1)%sides
        faces.append((0,1+i,1+nxt))
        for j in range(rings-1):
            a=1+j*sides+i;c=1+j*sides+nxt
            faces.append((a,a+sides,c+sides,c))
        faces.append((south,1+(rings-1)*sides+nxt,1+(rings-1)*sides+i))
    obj=mesh_object(name,vertices,faces,material,True);obj.location=p;obj.scale=scale
    return obj


def teddy(x,y,z,size=1.0,material=BRICK):
    """Original sewn sitting bear, with muzzle, paw pads and button features."""
    before=set(b.GROUP.objects)
    def ball(label,offset,scale,mat=material):
        return ellipsoid('Toyshop plush '+label,(x+offset[0]*size,y+offset[1]*size,z+offset[2]*size),
            tuple(v*size for v in scale),mat)
    body=ball('pear body',(0,0,.38),(.28,.22,.37));body['toyshopToy']=True
    ball('round head',(0,-.018,.86),(.32,.25,.29))
    for side in [-1,1]:
        ball('sewn ear',(side*.245,0,1.07),(.12,.082,.14))
        ball('ear inset',(side*.245,-.071,1.07),(.072,.018,.084),CREAM)
        ball('padded arm',(side*.28,-.03,.40),(.13,.14,.23))
        ball('sitting foot',(side*.175,-.16,.115),(.15,.21,.115))
        ball('paw pad',(side*.175,-.339,.12),(.092,.021,.065),CREAM)
        ball('button eye',(side*.112,-.246,.91),(.026,.018,.029),'Gunmetal')
    ball('muzzle',(0,-.244,.785),(.14,.055,.10),CREAM)
    ball('nose',(0,-.299,.815),(.038,.019,.027),'Gunmetal')
    # A substantial fabric bow gives a readable gift-toy silhouette.
    for side in [-1,1]:
        wing=ball('bow wing',(side*.09,-.213,.59),(.11,.035,.065),INK)
        wing.rotation_euler.y=side*.32
    ball('bow knot',(0,-.245,.59),(.048,.03,.048),INK)
    for obj in set(b.GROUP.objects)-before:obj['toyAnchor']=[x,y,z]


def present(x,y,z,size=.5,material=GOLD):
    b.slab('Toyshop gift box',(x,y),size,size*.82,z,size*.73,material,size*.15)
    b.slab('Toyshop fitted gift lid',(x,y),size*1.05,size*.87,z+size*.70,size*.10,material,size*.15)
    b.box('Toyshop satin gift ribbon',(x,y,z+size*.39),(size*.16,size*.84,size*.78),CREAM,.022)
    b.box('Toyshop crossing ribbon',(x,y,z+size*.82),(size*1.04,size*.14,.023),CREAM,.009)
    for side in [-1,1]:
        points=[(x+side*size*(.02+.24*math.sin(a)),y+size*.12*math.sin(2*a),z+size*(.84+.15*math.sin(a)))
            for a in [math.pi*j/16 for j in range(17)]]
        b.tube('Toyshop tied ribbon loop',points,.025,CREAM)


def shop_window(label,center,bottom,width,height,depth,axis=1,door=False):
    inner=opening_profile(center,bottom,width,height)
    outer=opening_profile(center,.81 if door else bottom-.12,width+.24,height+.15 if door else height+.24,.24)
    frame('Toyshop '+label+' timber surround',outer,inner,depth-.08,depth+.14,axis,INK)
    pane=craft.profile_beam('Toyshop '+label+' fitted glass',inner,depth+.015,depth+.033,axis,'Window glass')
    pane['toyshopGlazing']=True
    if door:
        facing=1 if depth>CY else -1
        leaf=opening_profile(center,bottom+.09,width-.18,height-.18,.08)
        frame('Toyshop '+label+' door leaf',inner,leaf,depth-.025,depth+.075,axis,'Wood')
        b.box('Toyshop '+label+' bronze kickplate',(center,depth+facing*.08,bottom+.20),(width-.20,.035,.24),'Copper',.012)
        b.tube('Toyshop '+label+' returned pull',[(center+width*.30,depth+facing*.075,bottom+1.0),
            (center+width*.30,depth+facing*.20,bottom+1.06),(center+width*.30,depth+facing*.20,bottom+1.50),
            (center+width*.30,depth+facing*.075,bottom+1.56)],.035,'Copper')
    elif width>3:
        # Just one generous division: no dense, repetitive grid over the toys.
        if axis==1:b.box('Toyshop '+label+' timber mullion',(center,depth+.006,bottom+height/2),(.11,.15,height),INK,.018)
        else:b.box('Toyshop '+label+' timber mullion',(depth+.006,center,bottom+height/2),(.15,.11,height),INK,.018)
    if not door and bottom<2:
        if axis==1:b.slab('Toyshop '+label+' stone sill',(center,depth),width+.42,.50,bottom-.21,.12,CREAM,.09)
        else:b.slab('Toyshop '+label+' stone sill',(depth,center),.50,width+.42,bottom-.21,.12,CREAM,.09)


def rocket(x,y,z,size=.8):
    body=lathe('Toyshop carved rocket',x,y,z,[(.16*size,0),(.26*size,.22*size),(.27*size,.62*size),
        (.22*size,.87*size),(.12*size,1.08*size),(.018*size,1.23*size)],CREAM,28)
    body['toyshopToy']=True
    for side in [-1,1]:
        profile=[(x+side*.17*size,z+.10*size),(x+side*.44*size,z-.01*size),
            (x+side*.40*size,z+.30*size),(x+side*.23*size,z+.49*size)]
        fin=craft.profile_beam('Toyshop rocket carved fin',profile,y-.07*size,y+.07*size,1,GOLD)
        craft.soften(fin,.025,3)
    b.ring('Toyshop rocket porthole rim',(x,y-.26*size,z+.64*size),.11*size,.026*size,'Copper','y')
    ellipsoid('Toyshop rocket porthole',(x,y-.265*size,z+.64*size),(.095*size,.023*size,.095*size),INK)


def rocking_horse(x,y,z):
    # A shaped, solid timber silhouette with joined rockers; no human characters.
    outline=[(-.64,.28),(-.52,.36),(-.54,.65),(-.40,.75),(.08,.72),(.27,1.16),
        (.26,1.37),(.36,1.29),(.53,1.31),(.69,1.18),(.68,1.02),(.52,.98),
        (.38,.64),(.36,.26),(.23,.25),(.17,.53),(-.25,.52),(-.38,.25)]
    body=craft.profile_beam('Toyshop carved rocking horse',[(x+u,z+v) for u,v in outline],y-.12,y+.12,1,'Wood')
    craft.soften(body,.055,4);body['toyshopToy']=True
    for side in [-1,1]:
        points=[(x-.77+i*1.54/32,y+side*.22,z+.10+.20*((i-16)/16)**2) for i in range(33)]
        b.tube('Toyshop curved horse rocker',points,.065,INK)
        for dx in [-.34,.29]:b.tube('Toyshop horse leg tenon',[(x+dx,y+side*.06,z+.32),(x+dx,y+side*.22,z+.15)],.066,'Wood')
    b.slab('Toyshop leather saddle',(x-.07,y),.43,.39,z+.72,.055,INK,.10)
    for side in [-1,1]:ellipsoid('Toyshop horse inset eye',(x+.48,y+side*.126,z+1.21),(.025,.015,.025),'Gunmetal')
    b.tube('Toyshop horse handle',[(x+.35,y-.29,z+1.03),(x+.35,y+.29,z+1.03)],.034,'Copper')


def interior():
    b.slab('Toyshop flush oak floor',(CX,CY),10.58,8.98,.80,.04,'Wood',.28)
    shelf=b.slab('Toyshop continuous oak display joinery',(CX-1.30,-2.10),5.60,.87,FLOOR,3.32,'Wood',.18)
    cutters=[]
    for z in [1.16,2.16,3.16]:
        cutters.append(b.box('Temporary toy display recess',(CX-1.30,-2.31,z+.29),(5.23,.83,.78),'Gunmetal',.04))
    realm.apply_difference(shelf,cutters);craft.soften(shelf,.028,3)
    for j,x in enumerate([CX-3.40,CX-2.05,CX-.70,CX+.65]):
        teddy(x,-2.30,1.06,.57,[BRICK,CREAM,INK,GOLD][j])
        present(x,-2.30,2.06,.56,[INK,GOLD,BRICK,CREAM][j])
        if j%2==0:teddy(x,-2.30,3.06,.57,CREAM if j==0 else GOLD)
        else:
            for k in range(3):b.box('Toyshop gift book',(x-.22+k*.18,-2.30,3.36),(.15,.38,.57),[INK,GOLD,BRICK][k],.018)
    # Low, stocked showcases leave a generous route through the shop.
    b.slab('Toyshop front oak display cabinet',(CX-2.25,-9.79),4.88,.87,FLOOR,.30,INK,.15)
    b.slab('Toyshop front polished display top',(CX-2.25,-9.79),4.98,.91,1.14,.075,'Wood',.17)
    rocking_horse(CX-3.27,-9.72,1.215)
    rocket(CX-1.35,-9.75,1.23,.93)
    present(CX-.39,-9.72,1.215,.44,GOLD)
    b.slab('Toyshop oval merchandise island',(CX-.40,CY-.20),2.68,1.50,FLOOR,.76,INK,.68)
    b.slab('Toyshop oak island counter',(CX-.40,CY-.20),2.80,1.60,1.60,.09,'Wood',.72)
    teddy(CX-1.08,CY-.12,1.69,.78,CREAM)
    rocket(CX+.20,CY-.04,1.70,.66)
    present(CX-.13,CY-.62,1.69,.44,BRICK)
    b.slab('Toyshop rounded checkout',(CX+3.28,-3.50),1.74,1.04,FLOOR,.94,INK,.30)
    b.slab('Toyshop oak checkout top',(CX+3.28,-3.50),1.86,1.16,1.78,.095,'Wood',.34)
    b.box('Toyshop compact register',(CX+3.50,-3.51,2.04),(.34,.30,.30),CREAM,.04,rot=(-.2,0,0))
    b.box('Toyshop register screen',(CX+3.50,-3.67,2.08),(.25,.018,.14),'Gunmetal',.01,rot=(-.2,0,0))
    present(CX+2.84,-3.55,1.875,.38,GOLD)
    b.slab('Toyshop east display cabinet',(CX+4.59,-6.25),.83,3.62,FLOOR,.40,INK,.16)
    b.slab('Toyshop east oak display cap',(CX+4.59,-6.25),.90,3.70,1.24,.075,'Wood',.18)
    for j,y in enumerate([-7.35,-6.25,-5.15]):
        present(CX+4.57,y,1.315,.52,[GOLD,BRICK,INK][j])
    # Emitters sit above every ground-floor opening, outside their receiver plane.
    for x in [CX-4.0,CX+4.0]:
        b.box('Toyshop inset ceiling diffuser',(x,CY-.25,5.18),(.24,4.80,.035),'Warm neon',0)
        ceiling_light('Toyshop broad ceiling light',(x,CY-.25,5.15),125,(1.15,5.6),(x,CY-.25,1.0),.30)
    ceiling_light('Toyshop lantern ceiling light',(CX,CY+.6,6.72),150,(5.15,3.2),(CX,CY+.6,1.0),.35)
    for x in [CX-1.60,CX+1.60]:
        b.cylinder('Toyshop pendant ceiling socket',(x,CY+.6,6.74),.12,.055,'Copper',20)
        b.cylinder('Toyshop pendant short stem',(x,CY+.6,6.25),.028,.96,'Copper',12)
        lathe('Toyshop spun metal pendant',x,CY+.6,5.64,[(.35,0),(.36,.05),(.30,.20),(.10,.30)],INK,28)
        b.cylinder('Toyshop pendant opal diffuser',(x,CY+.6,5.646),.30,.025,'Warm neon',24)


def roof():
    # A real open lightwell connects the clerestory to the room below.
    lx,ly=CX,CY+.65
    # Build the annulus explicitly. A smoothed boolean ngon spread the edge
    # normals across diagonal triangles on this large, perfectly flat surface.
    lightwell=b.rounded(lx,ly,6.20,4.20,.20,8)
    deck=frame('Toyshop continuous roof deck',b.rounded(CX,CY,11.60,10.00,.57,8),lightwell,5.20,5.48,2,CREAM)
    weather=frame('Toyshop roof membrane',b.rounded(CX,CY,11.33,9.73,.45,8),lightwell,5.48,5.545,2,'Rail graphite')
    outer=b.rounded(CX,CY,11.61,10.01,.57,8);inner=b.rounded(CX,CY,11.32,9.72,.43,8)
    frame('Toyshop continuous low roof upstand',outer,inner,5.45,5.71,2,INK)
    lantern=b.slab('Toyshop continuous roof lantern',(lx,ly),6.65,4.65,5.43,1.37,CREAM,.28)
    cutters=[b.slab('Temporary toyshop lantern void',(lx,ly),6.20,4.20,5.30,1.80,'Gunmetal',.08)]
    apertures=[('lantern front',lx,5.69,5.55,.86,ly-2.325,1),('lantern rear',lx,5.69,5.55,.86,ly+2.325,1),
        ('lantern east',ly,5.69,3.55,.86,lx+3.325,0),('lantern west',ly,5.69,3.55,.86,lx-3.325,0)]
    for label,c,z,w,h,depth,axis in apertures:
        cutters.append(craft.profile_beam('Temporary '+label,opening_profile(c,z,w,h,.08),depth-.4,depth+.4,axis,'Gunmetal'))
    realm.apply_difference(lantern,cutters);craft.soften(lantern,.022,3)
    for label,c,z,w,h,depth,axis in apertures:shop_window(label,c,z,w,h,depth,axis)
    # Shallow folded hip roof: one watertight shaped mesh, with integrated eaves.
    loops=[(7.10,5.10,6.76),(7.10,5.10,6.90),(5.96,3.96,7.35),(5.96,3.96,7.40)]
    vertices=[]
    for w,d,z in loops:vertices.extend((x,y,z) for x,y in b.rounded(lx,ly,w,d,.23,8))
    n=len(vertices)//4;faces=[tuple(range(n-1,-1,-1)),tuple(range(3*n,4*n))]
    for k in range(3):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    cap=mesh_object('Toyshop folded lantern roof',vertices,faces,'Rail graphite');craft.soften(cap,.035,3)
    # Only a handful of properly seated standing seams, scaled for a miniature.
    for dx in [-2.2,-1.1,0,1.1,2.2]:
        b.tube('Toyshop roof standing seam',[(lx+dx,ly-2.52,6.915),(lx+dx,ly-1.97,7.417),
            (lx+dx,ly+1.97,7.417),(lx+dx,ly+2.52,6.915)],.027,'Rail graphite')
    # Paired rear rainwater pipes actually terminate at paving level.
    for x in [CX-5.10,CX+5.10]:
        b.tube('Toyshop fitted downpipe',[(x,BACK+.08,5.48),(x,BACK+.25,5.29),(x,BACK+.25,1.07),(x,BACK+.38,.92)],.065,INK)
        for z in [1.28,3.0,4.75]:b.box('Toyshop downpipe clip',(x,BACK+.14,z),(.20,.25,.055),'Copper',.01)


def build(surface):
    palette(surface);b.collection('08 · Cloudberry toyshop')
    b.status('Toyshop brick envelope')
    shell=b.poly('Toyshop continuous masonry envelope',b.rounded(CX,CY,11.2,9.6,.38,12),.80,4.46,BRICK,0)
    cutters=[b.poly('Temporary toyshop room',b.rounded(CX,CY,10.54,8.94,.15,12),.79,4.60,'Gunmetal',0)]
    openings=[('south display',CX-2.25,1.25,5.15,3.22,FRONT,1,False),
        ('recessed entrance',CX+3.16,FLOOR,1.90,3.64,FRONT+.34,1,True),
        ('east display',CY-.10,1.25,6.05,3.22,CX+5.60,0,False),
        ('west window',CY-.60,1.65,3.50,2.82,CX-5.60,0,False),
        ('rear transom',CX-1.40,4.36,5.20,.53,BACK,1,False),
        ('rear service door',CX+3.28,FLOOR,1.40,2.60,BACK-.03,1,True)]
    for label,c,z,w,h,depth,axis,door in openings:
        cutters.append(craft.profile_beam('Temporary toyshop '+label,opening_profile(c,z,w,h),depth-.75,depth+.65,axis,'Gunmetal'))
    realm.apply_difference(shell,cutters);craft.soften(shell,.045,4)
    shell['continuousEnvelope']=True
    for label,c,z,w,h,depth,axis,door in openings:shop_window(label,c,z,w,h,depth,axis,door)
    # Fitted timber fascia and metal canopy belong to the entrance bay.
    b.slab('Toyshop continuous fascia',(CX,FRONT+.075),10.80,.42,4.62,.48,INK,.15)
    b.slab('Toyshop fascia top cornice',(CX,FRONT+.04),10.96,.54,5.06,.105,CREAM,.15)
    canopy=b.slab('Toyshop entrance folded canopy',(CX+3.16,FRONT-.43),2.92,1.20,4.50,.13,'Copper',.25)
    canopy['joinedCanopy']=True
    for x in [CX+2.0,CX+4.32]:
        b.tube('Toyshop canopy returned bracket',[(x,FRONT+.08,3.93),(x,FRONT-.84,4.48),(x,FRONT+.08,4.52)],.045,INK)
    # A quiet toy-wheel relief identifies the shop, without any lettering.
    badge=b.cylinder('Toyshop brass toy wheel emblem',(CX-2.25,FRONT-.158,4.86),.155,.045,'Copper',32,(math.pi/2,0,0))
    for dx in [-.55,.55]:b.cylinder('Toyshop small emblem wheel',(CX-2.25+dx,FRONT-.158,4.86),.085,.045,'Copper',24,(math.pi/2,0,0))
    b.box('Toyshop emblem axle',(CX-2.25,FRONT-.175,4.86),(1.14,.035,.040),'Copper',.01)
    roof();interior()
    b.status('Harbor toy emporium modeled')


def verify(graph):
    collection=bpy.data.collections['08 · Cloudberry toyshop']
    shell=bpy.data.objects['Toyshop continuous masonry envelope'].evaluated_get(graph)
    mesh=shell.to_mesh();bm=bmesh.new();bm.from_mesh(mesh)
    assert all(e.is_manifold for e in bm.edges),'Toyshop masonry must be closed and manifold'
    pending=set(bm.verts);components=0
    while pending:
        components+=1;todo=[pending.pop()]
        while todo:
            for e in todo.pop().link_edges:
                for v in e.verts:
                    if v in pending:pending.remove(v);todo.append(v)
    bm.free();shell.to_mesh_clear()
    assert components==1,'Toyshop must have one joined architectural envelope'
    for origin,direction in [((CX-3.3,FRONT-1,2.5),(0,1,0)),((CX+3.16,FRONT-1,2.0),(0,1,0)),
                              ((CX+6.6,CY-1,2.5),(-1,0,0)),((CX-2,BACK+1,4.6),(0,-1,0))]:
        hit,_,_,_=shell.ray_cast(Vector(origin),Vector(direction),distance=2.5)
        assert not hit,'Masonry obstructs a display, door or rear transom'
    panes=[o for o in collection.objects if o.get('toyshopGlazing')]
    assert len(panes)==10 and all(o.data.materials[0].get('surfaceRole')=='glass' for o in panes)
    # The roof lantern must illuminate the actual room, not a sealed rooftop box.
    for name in ['Toyshop continuous roof deck','Toyshop roof membrane','Toyshop continuous roof lantern']:
        obj=bpy.data.objects[name].evaluated_get(graph)
        assert not obj.ray_cast(Vector((CX,CY+.65,8)),Vector((0,0,-1)))[0],'Roof lightwell is capped shut'
    for name in ['Toyshop continuous roof deck','Toyshop roof membrane']:
        original=bpy.data.objects[name]
        assert all(not p.use_smooth for p in original.data.polygons if p.normal.z>.999),'Keep broad roof faces planar, without diagonal smoothing'
        evaluated=original.evaluated_get(graph);mesh=evaluated.to_mesh()
        for face in mesh.polygons:
            if face.normal.z>.999:
                assert all(mesh.corner_normals[i].vector.z>.999 for i in face.loop_indices),'Roof corner normals must stay perpendicular to its flat surface'
        evaluated.to_mesh_clear()
    lamps=[light for light in b.LIGHTS if light['name'].startswith('Toyshop')]
    assert len(lamps)==3 and min(l['position'][1] for l in lamps)>5.1
    assert all(l['target'][1]<l['position'][1] and l['width']>1 for l in lamps),'Use broad downward ceiling light'
    toys=[o for o in collection.objects if o.get('toyshopToy')]
    assert len(toys)>=10,'Display needs varied, modeled merchandise'
    ground=bpy.data.objects['Continuous neighbourhood ground'].evaluated_get(graph)
    for x,y in [(CX-5.6,CY),(CX+5.6,CY),(CX,FRONT),(CX,BACK),(CX+3.16,FRONT-1.6),(-28,-4.8)]:
        hit,p,_,_=ground.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        assert hit and abs(p.z-.8)<.01,'Shop footprint needs flush supported paving'
    points=[]
    for obj in collection.objects:
        if obj.type not in {'MESH','CURVE'}:continue
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        vertices=[obj.matrix_world@v.co for v in mesh.vertices];evaluated.to_mesh_clear();points+=vertices
        assert min(p.z for p in vertices)>=.79,'Toyshop fixture penetrates paving'
        anchor=obj.get('toyAnchor')
        if anchor and anchor[1]>-3:
            ceiling=1.99 if anchor[2]<2 else 3.99
            assert max(p.z for p in vertices)<ceiling,'Shelf toy hits the shelf above'
    assert max(p.x for p in points)<-27.8 and max(p.z for p in points)<8
    for name in [BRICK,INK,CREAM,GOLD]:
        p=b.M[name].node_tree.nodes.get('Principled BSDF')
        assert all(p.inputs[k].is_linked for k in ['Base Color','Roughness','Normal'])
    assert not collection.get('renderStyle') and all(o.visible_shadow for o in collection.objects)
    assert not any(o.get('renderStyle') for o in collection.objects)
    return {'connectedClosedShell':True,'clearGlazedOpenings':len(panes),'displayToys':len(toys),
        'openRoofLightwell':True,'planarRoofNormals':True,'ceilingLightsAboveWindows':True,'physicalMaterialsAndShadows':True,
        'continuousPavingAndClearApproach':True,'texturedFinishes':4,'lowRetailProportions':True}


