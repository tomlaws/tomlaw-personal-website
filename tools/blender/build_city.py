"""Nocturne Harbor — original, metre-scale Blender architecture and asset export.
Run in Blender, directly or through execute_blender_code. No downloaded models.
"""
import bpy, math, json, random, time, traceback
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'; SOURCE=ROOT/'assets/blender'
OUT.mkdir(parents=True,exist_ok=True); SOURCE.mkdir(parents=True,exist_ok=True)
STATUS=SOURCE/'build-status.json'
rng=random.Random(83)
M={}; GROUP=None; LIGHTS=[]; ASSETS=[]; VEGETATION=[]

def status(phase,**values):
    STATUS.write_text(json.dumps({'phase':phase,'time':time.time(),**values}),encoding='utf-8')
    print('CITY_BUILD',phase,flush=True)

def rgb(s):
    a=[int(s[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in a)

def encode_colour(pixels):
    """Store sRGB texels for glTF colour slots; keep data maps in linear space."""
    result=pixels.copy();c=np.clip(result[:,:,:3],0,1)
    result[:,:,:3]=np.where(c<=.0031308,c*12.92,1.055*np.power(c,1/2.4)-.055)
    return result

def material(name,hex,rough=.55,metal=.0,emit=0,alpha=1,texture=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); c=rgb(hex)
    p.inputs['Base Color'].default_value=(*c,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Coat Weight'].default_value=.22 if not emit else .08
    p.inputs['Coat Roughness'].default_value=.3
    p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emit
    p.inputs['Alpha'].default_value=alpha
    if alpha<1:
        m.surface_render_method='DITHERED';p.inputs['Coat Weight'].default_value=.8
    if emit:m['nightEmission']=emit
    m['surfaceRole']='glass' if alpha<1 else 'light' if emit else 'solid'
    m['paletteKey']=name
    if texture:
        # A tileable, fine-grained painted surface, created inside Blender.
        n=256; g=np.random.default_rng(sum(map(ord,name))); y,x=np.mgrid[0:n,0:n]
        grain=g.normal(0,.009,(n,n));patina=.012*np.sin(x*.024)*np.sin(y*.047)+.008*np.cos(x*.071+y*.027)
        pixels=np.ones((n,n,4),dtype=np.float32)
        for k in range(3):pixels[:,:,k]=np.clip(c[k]*(1+grain+patina),0,1)
        im=bpy.data.images.new(name+' · albedo',width=n,height=n);im.colorspace_settings.name='sRGB';im.pixels.foreach_set(encode_colour(pixels).ravel());im.pack()
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
        uv=m.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='DetailUV'
        m.node_tree.links.new(uv.outputs['UV'],tex.inputs['Vector']);m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
        # Exportable tangent-space fine surface normal texture.
        normal=np.ones((n,n,4),dtype=np.float32);normal[:,:,0]=.5+g.normal(0,.008,(n,n));normal[:,:,1]=.5+g.normal(0,.008,(n,n));normal[:,:,2]=1
        ni=bpy.data.images.new(name+' · grain normal',width=n,height=n);ni.colorspace_settings.name='Non-Color';ni.pixels.foreach_set(normal.ravel());ni.pack()
        nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=ni
        nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.16
        m.node_tree.links.new(uv.outputs['UV'],nt.inputs['Vector']);m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    M[name]=m;return m

def room_material(name,color,power):
    """Paint a soft ceiling-to-floor light falloff on an actual recessed wall.
    Dedicated UVs keep the gradient intact through joining and AO unwrapping.
    The reflective glass is separate geometry in front of this interior wall.
    """
    mat=material(name,color,.65,0,power);nodes=mat.node_tree.nodes;links=mat.node_tree.links
    n=128;y,x=np.mgrid[0:n,0:n]/(n-1);c=np.array(rgb(color))
    ceiling=.17+.78*np.power(y,.7)
    edges=.7+.3*np.sin(x*math.pi)**.35
    wash=ceiling*edges
    pixels=np.ones((n,n,4),dtype=np.float32);pixels[:,:,:3]=wash[:,:,None]*c
    im=bpy.data.images.new(name+' · ceiling bounce',width=n,height=n);im.colorspace_settings.name='sRGB';im.pixels.foreach_set(encode_colour(pixels).ravel());im.pack()
    tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.extension='EXTEND'
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='RoomUV';links.new(uv.outputs['UV'],tex.inputs['Vector'])
    p=nodes.get('Principled BSDF');links.new(tex.outputs['Color'],p.inputs['Emission Color']);links.new(tex.outputs['Color'],p.inputs['Base Color'])
    return mat

def glow_surface(name,vertices,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[(0,1,2,3)]);mesh.update()
    uv=mesh.uv_layers.new(name='RoomUV')
    for i,v in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=v
    return link(bpy.data.objects.new(name,mesh),mat)

def room_panel(name,p,w,h,mat,side=False):
    x,y,z=p
    vertices=[(x,y-w/2,z-h/2),(x,y+w/2,z-h/2),(x,y+w/2,z+h/2),(x,y-w/2,z+h/2)] if side else [(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)]
    return glow_surface(name,vertices,mat)
def collection(name):
    global GROUP
    GROUP=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(GROUP)
    return GROUP

def link(o,mat):
    for c in list(o.users_collection):c.objects.unlink(o)
    GROUP.objects.link(o)
    if mat:o.data.materials.append(M[mat] if isinstance(mat,str) else mat)
    return o

def box(name,p,s,mat='Concrete',bevel=.04,rot=None):
    x,y,z=[v/2 for v in s]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    mesh.update();o=bpy.data.objects.new(name,mesh);GROUP.objects.link(o);o.location=p;o.data.materials.append(M[mat])
    if rot:o.rotation_euler=rot
    if bevel and min(s)>.05:
        b=o.modifiers.new('Soft miniature edges','BEVEL');b.width=min(bevel*1.6,min(s)*.32);b.segments=4;b.harden_normals=True
        for f in mesh.polygons:f.use_smooth=True
        o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return o

def poly(name,points,z,h,mat,bevel=.06):
    n=len(points);v=[(x,y,z) for x,y in points]+[(x,y,z+h) for x,y in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);GROUP.objects.link(o);o.data.materials.append(M[mat])
    if bevel:
        b=o.modifiers.new('Soft perimeter','BEVEL');b.width=min(bevel*1.4,h*.32);b.segments=4;b.harden_normals=True
        for f in mesh.polygons:f.use_smooth=True
        o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return o

def rounded(cx,cy,w,d,r=.8,steps=5):
    a=[]
    for x,y,start in [(cx+w/2-r,cy+d/2-r,0),(cx-w/2+r,cy+d/2-r,90),(cx-w/2+r,cy-d/2+r,180),(cx+w/2-r,cy-d/2+r,270)]:
        for i in range(steps+1):
            t=math.radians(start+i*90/steps);a.append((x+r*math.cos(t),y+r*math.sin(t)))
    return a

def slab(name,c,w,d,z,h,mat,r=.6):return poly(name,rounded(*c,w,d,r),z,h,mat)

def tube(name,points,r,mat,closed=False):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1
    curve.bevel_depth=r;curve.bevel_resolution=2
    sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
    for a,p in zip(sp.points,points):a.co=(*p,1)
    sp.use_cyclic_u=closed
    return link(bpy.data.objects.new(name,curve),mat)

def cylinder(name,p,r,h,mat,verts=24,rotation=None,r2=None):
    points=[]
    for z,radius in [(-h/2,r),(h/2,r if r2 is None else r2)]:
        points += [(radius*math.cos(i*math.tau/verts),radius*math.sin(i*math.tau/verts),z) for i in range(verts)]
    faces=[tuple(range(verts-1,-1,-1)),tuple(range(verts,2*verts))]+[(i,(i+1)%verts,(i+1)%verts+verts,i+verts) for i in range(verts)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(points,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);GROUP.objects.link(o);o.location=p;o.data.materials.append(M[mat])
    for f in mesh.polygons:f.use_smooth=len(f.vertices)==4
    if rotation:o.rotation_euler=rotation
    return o

def ring(name,p,r,thickness,mat,axis='z'):
    a=[]
    for i in range(80):
        u,v=math.cos(i*math.tau/80)*r,math.sin(i*math.tau/80)*r
        a.append((p[0]+u,p[1]+v,p[2]) if axis=='z' else (p[0]+u,p[1],p[2]+v))
    return tube(name,a,thickness,mat,True)

def text(name,body,p,size,mat='Warm neon',rotation=(math.pi/2,0,0),font=None):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.align_x='CENTER';c.size=size;c.extrude=.012;c.bevel_depth=.004;c.bevel_resolution=1
    if font:c.font=font
    o=bpy.data.objects.new(name,c);link(o,mat);o.location=p;o.rotation_euler=rotation;return o

def area(name,p,color,power,size,target,dimensions=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=rgb(color);d.shape='DISK';d.size=size
    if dimensions:d.shape='RECTANGLE';d.size,d.size_y=dimensions
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    LIGHTS.append({'name':o.name,'position':[p[0],p[2],-p[1]],'target':[target[0],target[2],-target[1]],'color':color,'power':power,'size':size})
    if dimensions:LIGHTS[-1].update(width=dimensions[0],height=dimensions[1])
    return o

def sign_light(name,center,width,height,color,power,side=False):
    """Soft sign spill parallel to the facade, never bisecting its receiver.

    A tilted, outward-facing area lamp previously sliced the wall into bright
    and dark halves. Keep the entire case behind this facade-facing emitter.
    Its rectangular footprint matches the sign in Blender and in WebGL.
    """
    x,y,z=center;normal=Vector((1,0,0) if side else (0,-1,0))
    p=Vector(center)+normal*.7
    o=area(name,p,color,power,width,center,dimensions=(width,height))
    LIGHTS[-1]['signSurface']={
        'center':[x,z,-y], 'normal':[normal.x,normal.z,-normal.y],
        'width':width,'height':height,'caseDepth':.24,
    }
    return o

def window(x,y,z,w=1.25,h=1.75,warm=True):
    mat='Amber room' if warm else 'Teal room'
    box('Recessed room back',(x,y+.42,z),(w,.07,h),'Dark interior',.015)
    room_panel('Ceiling-lit room wall',(x,y+.378,z),w,h,'Honey interior' if warm else 'Lagoon interior')
    for sx in [-1,1]:box('Window jamb',(x+sx*(w/2+.075),y+.17,z),(.15,.57,h+.2),'Oxidized metal',.035)
    box('Room floor',(x,y+.19,z-h/2),(w,.49,.075),'Stone',.01)
    box('Interior ceiling light',(x,y+.21,z+h/2-.075),(w*.64,.18,.04),mat,0)
    box('Ceiling return',(x,y+.28,z+h/2),(w,.5,.08),'Stone',.01)
    box('Glazing',(x,y-.025,z),(w,.022,h),'Window glass',0)
    # Small windows read as single panes; only wide shopfronts need a divider.
    if w>2:box('Shopfront central frame',(x,y-.045,z),(.12,.1,h),'Gunmetal',.025)
    box('Projecting sill',(x,y-.11,z-h/2-.07),(w+.3,.38,.14),'Stone',.03)

def hvac(x,y,z,s=1):
    box('Condensing unit',(x,y,z+.42*s),(1.4*s,.9*s,.84*s),'Oxidized metal',.06)
    cylinder('Fan housing',(x,y,z+.85*s),.42*s,.07,'Gunmetal')
    ring('Fan rim',(x,y,z+.9*s),.35*s,.055*s,'Aluminium')
    for i in range(4):
        a=i*math.pi/2; tube('Fan blades',[(x,y,z+.92*s),(x+math.cos(a)*.29*s,y+math.sin(a)*.29*s,z+.92*s)],.045*s,'Aluminium')
    for j in range(3):box('Cooling fins',(x,y-.466*s,z+(.19+j*.18)*s),(1.05*s,.035,.065*s),'Dark interior',.01)
    tube('Refrigerant pipe',[(x+.6*s,y,z+.7*s),(x+.9*s,y,z+.7*s),(x+.9*s,y,z+.08)],.065,'Copper')

def railing(points,z,h=1,solid=False):
    # At district scale use broad parapets, or sparse dark posts with a rounded cap.
    if not solid:tube('Rounded handrail',[(x,y,z+h) for x,y in points],.11,'Gunmetal')
    for i in range(len(points)-1):
        a,b=Vector(points[i]),Vector(points[i+1]);length=(b-a).length
        if solid:
            q=(a+b)/2;angle=math.atan2(b.y-a.y,b.x-a.x)
            box('Solid waterfront parapet',(q.x,q.y,z+h*.4),(length,.3,h*.8),'Stone',.07,(0,0,angle))
            box('Rounded parapet coping',(q.x,q.y,z+h*.8),(length+.07,.38,.14),'Pale ceramic',.05,(0,0,angle))
            continue
        n=max(1,math.ceil(length/2.4))
        for j in range(n+1):
            q=a.lerp(b,j/n);tube('Railing post',[(q.x,q.y,z),(q.x,q.y,z+h)],.085,'Gunmetal')

def waterfront_railing(points,z,h=.95):
    """Open maritime rail: round capped posts and two continuous tubular rails."""
    for height,radius in [(h,.08),(h*.48,.06)]:
        tube('Harbor tubular rail',[(x,y,z+height) for x,y in points],radius,'Deep teal')
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b);count=max(1,math.ceil((b-a).length/2.15))
        for i in range(count+1):
            q=a.lerp(b,i/count)
            cylinder('Harbor round post',(q.x,q.y,z+h/2),.09,h,'Gunmetal',12)
            cylinder('Post foot socket',(q.x,q.y,z+.065),.15,.13,'Deep teal',16)
            cylinder('Rounded bronze post cap',(q.x,q.y,z+h+.025),.115,.08,'Copper',16,r2=.085)

def person(x,y,z,color='Cloth',angle=0):
    cylinder('Pedestrian torso',(x,y,z+.98),.18,.66,color,10,r2=.15)
    cylinder('Pedestrian neck',(x,y,z+1.345),.07,.14,'Skin',10)
    cylinder('Head',(x,y,z+1.51),.14,.26,'Skin',12)
    for side in [-1,1]:
        cylinder('Trouser leg',(x+side*.105,y,z+.34),.075,.67,'Gunmetal',8)
        cylinder('Sleeve',(x+side*.195,y,z+.98),.065,.58,color,8,rotation=(0,side*.15,0))

def tree(x,y,z,s=1):
    cylinder('Tree trunk',(x,y,z+1.4*s),.12*s,2.8*s,'Bark',10)
    for i in range(12):
        a=i*2.399;r=(.3+(i%4)*.22)*s
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x+math.cos(a)*r,y+math.sin(a)*r,z+(2.9+math.sin(i)*.45)*s))
        o=link(bpy.context.object,'Leaf' if i%3 else 'Leaf light');o.name='Layered crown';o.scale=(.8*s,.75*s,.63*s)
        for f in o.data.polygons:f.use_smooth=True

def streetlight(x,y,z=.8):
    cylinder('Street lantern base',(x,y,z+.14),.22,.28,'Copper',16)
    cylinder('Street lantern mast',(x,y,z+2.25),.11,4.5,'Gunmetal',16)
    tube('Lantern cantilever',[(x,y,z+4.5),(x+.55,y,z+4.5),(x+.8,y,z+4.3)],.11,'Gunmetal')
    box('Lantern housing',(x+.75,y,z+4.28),(.5,.28,.15),'Gunmetal')
    box('Lantern diffuser',(x+.75,y,z+4.2),(.4,.21,.025),'Warm neon',0)
    d=bpy.data.lights.new('Amber street pool','POINT');d.energy=90;d.color=rgb('#ffc17b');d.shadow_soft_size=.6
    o=bpy.data.objects.new('Amber street pool',d);bpy.context.scene.collection.objects.link(o);o.location=(x+.75,y,z+3.9)
    LIGHTS.append({'name':f'Quay lantern {x} {y}','type':'point','position':[x+.75,z+3.9,-y],'color':'#ffc17b','power':75,'distance':11})

def steps(name,x,y,z,width,rise,count,run=.28):
    for i in range(count):
        h=(i+1)*rise/count;box(name,(x,y+i*run,z+h/2),(width,run+.018,h),'Stone',.014)

def striped_awning(x,y,z,width,projection):
    # A true quarter-round fabric canopy and rounded hanging scallops.
    bands=12;band=width/bands
    for i in range(bands):
        a=x-width/2+i*band;b=a+band
        profile=[(y-projection*math.sin(t),z-.68*(1-math.cos(t))) for t in np.linspace(0,math.pi/2,17)]
        vertices=[(xx,py,pz) for xx in [a,b] for py,pz in profile]
        faces=[(j,j+1,j+18,j+17) for j in range(16)]
        me=bpy.data.meshes.new('Curved fabric stripe');me.from_pydata(vertices,[],faces);me.update()
        color='Awning coral' if i%2==0 else 'Awning cream'
        o=link(bpy.data.objects.new('Striped curved canopy',me),color)
        solid=o.modifiers.new('Woven fabric thickness','SOLIDIFY');solid.thickness=.035
        box('Rounded awning valance',((a+b)/2,y-projection,z-.79),(band-.012,.075,.33),color,.14)
    tube('Canopy wall support',[(x-width/2,y,z),(x+width/2,y,z)],.055,'Copper')

def cafe_table(x,y):
    cylinder('Cafe table top',(x,y,1.56),.48,.12,'Mint enamel',32)
    cylinder('Table pedestal',(x,y,1.15),.055,.75,'Copper')
    cylinder('Pedestal foot',(x,y,.86),.27,.06,'Gunmetal')
    for dx in [-.84,.84]:
        cx=x+dx
        slab('Cafe chair seat',(cx,y),.44,.46,1.23,.12,'Awning coral',.13)
        for xx in [-.15,.15]:
            for yy in [-.16,.16]:tube('Chair legs',[(cx+xx,y+yy,.82),(cx+xx*.8,y+yy*.8,1.25)],.04,'Copper')
        tube('Loop chair back',[(cx-.19,y+.18,1.28),(cx-.19,y+.18,1.7),(cx+.19,y+.18,1.7),(cx+.19,y+.18,1.28)],.055,'Copper')
    cylinder('Teacup',(x-.15,y,1.69),.07,.13,'Awning cream',16)
    ring('Cup rim',(x-.15,y,1.76),.063,.012,'Copper')
    box('Menu',(x+.16,y+.04,1.635),(.17,.23,.018),'Awning cream',.01)

def initialize():
    status('initializing')
    VEGETATION.clear()
    for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
    for c in list(bpy.data.collections):bpy.data.collections.remove(c)
    for m in list(bpy.data.materials):bpy.data.materials.remove(m)
    for im in list(bpy.data.images):
        if im.name not in {'Render Result','Viewer Node'}:bpy.data.images.remove(im)
    for name,c,r,m in [('Concrete','#8284a1',.57,0),('Stone','#b6afbb',.48,0),('Warm plaster','#efb9a7',.59,0),('Terracotta','#c0703f',.5,0),('Deep teal','#439d9a',.4,.06),('Graphite','#7d7a74',.47,.05),('Asphalt','#a7a196',.36,.03),('Copper','#e4a66a',.35,.35),('Pale ceramic','#f0e9d8',.34,.02)]:material(name,c,r,m,texture=True)
    for name,c,r,m in [('Gunmetal','#6f7c8a',.38,.3),('Aluminium','#a9c4d0',.34,.35),('Oxidized metal','#8fb9af',.42,.15),('Dark interior','#4d4a52',.75,0),('Bark','#7f5a70',.7,0),('Leaf','#af67ae',.6,0),('Leaf light','#d68dbf',.55,0),('Wood','#bd9062',.55,0),('Cloth','#e9b064',.7,0),('Skin','#d6ae90',.7,0),('Taxi paint','#d95672',.25,.15),('Awning cream','#ffe6b1',.5,0),('Awning coral','#e0775a',.43,0),('Glazed plum tile','#864678',.3,.08),('Mint enamel','#82c7a7',.33,.05)]:material(name,c,r,m)
    material('Window glass','#b9d7dd',.22,.06,alpha=.18)
    material('Canopy glass','#a8dedb',.22,.12,alpha=.28)
    material('Vehicle glazing','#2b4c58',.12,.55)
    for name,c,e in [('Cyan neon','#38e1e4',5),('Pink neon','#ff439a',5.5),('Warm neon','#ffd594',4),('Amber room','#ffd18b',3.2),('Teal room','#62e7d7',2.2),('Violet neon','#ba7cff',4),('Signal red','#e9616a',2)]:material(name,c,.4,.02,e)
    room_material('Honey interior','#ffd286',2.1)
    room_material('Lagoon interior','#56ebdc',1.5)
    room_material('Apricot interior','#ffb38d',1.65)

def foundation():
    collection('00 · Quay and streets')
    slab('Basalt seawall',(0,0),68,54,-1.6,2,'Graphite',3)
    slab('Stone coping',(0,0),68.3,54.3,.35,.22,'Stone',3)
    slab('City paving',(0,0),66.8,52.8,.56,.24,'Concrete',2.8)
    # Continuous circuit and a cross street; generous shared city blocks.
    for x in [-29,29]:box('Avenue',(x,0,.805),(5.3,46,.05),'Asphalt',.02)
    for y in [-20,21]:box('Avenue',(0,y,.805),(62,5.3,.05),'Asphalt',.02)
    box('Cross street',(0,-.8,.806),(53,4.2,.052),'Asphalt',.02)
    for x in [-25.8,25.8]:box('Continuous pavement',(x,0,.85),(.38,46,.18),'Stone',.035)
    for y in [-16.9,17.9]:box('Continuous pavement',(0,y,.85),(52,.38,.18),'Stone',.035)
    for x in range(-26,28,3):
        for y in [-20,21]:box('Lane dash',(x,y,.838),(1.35,.14,.014),'Pale ceramic',0)
    for y in range(-16,19,3):
        for x in [-29,29]:box('Lane dash',(x,y,.838),(.14,1.35,.014),'Pale ceramic',0)
    for x in [-22,22]:
        for y in [-20,21]:
            for i in range(10):box('Zebra crossing',(x,y-2.1+i*.46,.843),(.95,.23,.012),'Pale ceramic',0)
    for x,y in [(-31,-14),(-31,8),(31,-12),(31,9),(-22,-24),(0,-24),(21,-24),(-18,25),(15,25)]:streetlight(x,y)
    waterfront_railing([(-32,-25.9),(-23,-25.9)],.8)
    waterfront_railing([(1,-25.9),(32,-25.9)],.8)
    for x in [-21,-7,10,23]:
        slab('Planter',(x,-24),2.7,1.2,.8,.42,'Stone',.3);tree(x,-24,1.22,.65)
    # Pier and service moorings.
    box('Pier foundation',(-16,-31,-.2),(7,10,.7),'Graphite',.12)
    for i in range(17):box('Timber pier plank',(-16,-35.34+i*.55,.2),(7,.52,.13),'Wood',.025)
    railing([(-19.3,-35.4),(-19.3,-27.5)],.2,.9);railing([(-12.7,-35.4),(-12.7,-27.5)],.2,.9)
    steps('Pier connection',-16,-29.1,.27,3,.53,4,.37)
    for x in [-18.8,-13.2]:
        for y in [-35,-30]:cylinder('Mooring bollard',(x,y,.45),.13,.5,'Gunmetal')
    # One intentional public courtyard.
    slab('Central shared courtyard',(-3,7),10,12,.81,.17,'Stone',.75)
    for px in [-5.5,-3,-.5]:box('Courtyard tile joint',(px,7,.984),(.045,11,.006),'Concrete',0)
    for py in [4,7,10]:box('Courtyard tile joint',(-3,py,.984),(9,.045,.006),'Concrete',0)
    for x,y in [(-6.8,3),(-6.8,11.5),(.6,13)]:
        slab('Courtyard planter',(x,y),1.7,1.7,.98,.38,'Graphite',.4);tree(x,y,1.36,.85)
    for x,y in [(-3,4),(-2,12)]:
        box('Slatted bench',(x,y,1.45),(2.2,.48,.12),'Wood')
        for dx in [-.75,.75]:box('Bench bracket',(x+dx,y,1.15),(.1,.38,.38),'Gunmetal')
    ring('Public light sculpture',(-2.6,7,3.1),1.8,.11,'Copper','y')
    ring('Sculpture inner light',(-2.6,6.95,3.1),1.55,.045,'Cyan neon','y')
    cylinder('Sculpture plinth',(-2.6,7,1.12),1.3,.28,'Graphite')
    for i,(x,y) in enumerate([(-12,-15),(-10,-14.5),(-3,2),(0,10),(19,-15),(21,-14),(23,4),(-22,2),(-4,-24)]):person(x,y,.9,'Cloth' if i%2 else 'Deep teal')
    status('quay modeled')

def tower():
    collection('01 · Aster Exchange')
    x,y=11,8
    slab('Exchange podium',(x,y),14,12,.8,.6,'Stone',1.7)
    slab('Dark service core',(x,y),6.8,5,1.4,28,'Graphite',1.1)
    # Nine rounded glass levels, visibly narrowing in three unequal stages.
    for f in range(9):
        z=1.4+f*3.1;w=12-(.75 if f>=4 else 0)-(1.05 if f>=7 else 0);d=10-(.7 if f>=5 else 0)
        cx=x-(.35 if f>=4 else 0)
        outline=rounded(cx,y,w,d,1.6,7)
        poly('Sculpted floor plate',outline,z,.32,'Pale ceramic',.065)
        # Individual curved perimeter glazing panels between genuine slabs.
        for i,a in enumerate(outline):
            b=outline[(i+1)%len(outline)]
            mesh=bpy.data.meshes.new('Curved facade pane');mesh.from_pydata([(a[0],a[1],z+.26),(b[0],b[1],z+.26),(b[0],b[1],z+2.92),(a[0],a[1],z+2.92)],[],[(0,1,2,3)])
            o=bpy.data.objects.new('Curved glass',mesh);link(o,'Window glass')
            if f>0 and (i+f*3)%9!=0:
                av=Vector(a).lerp(Vector((cx,y)),.07);bv=Vector(b).lerp(Vector((cx,y)),.07)
                glow_surface('Luminous recessed office wall',[(av.x,av.y,z+.42),(bv.x,bv.y,z+.42),(bv.x,bv.y,z+2.78),(av.x,av.y,z+2.78)],'Apricot interior' if f in [2,6] else 'Lagoon interior')
            if i%8==0:
                tube('Primary corner frame',[(a[0],a[1],z+.3),(a[0],a[1],z+3.06)],.095,'Oxidized metal')
            if i in [7,23] and f%3!=1:
                p=Vector(a).lerp(Vector(b),.5);v=(Vector((cx,y))-p).normalized()*.24
                box('Ceiling luminaire behind glass',(p.x+v.x,p.y+v.y,z+2.79),(1.25,.24,.08),'Teal room',.015)
        if f in [0,4,7]:tube('Recessed cyan belt',[(a,b,z+.2) for a,b in outline],.07,'Cyan neon',True)
        # Wide glass bays and a small number of readable structural frames.
        for px in np.linspace(cx-w/2+2.35,cx+w/2-2.35,3):
            for py in [y-d/2,y+d/2]:
                cylinder('Round facade column',(px,py,z+1.56),.095,2.7,'Oxidized metal',12)
        for py in [y-1.6,y+1.6]:
            for px in [cx-w/2,cx+w/2]:cylinder('Round return column',(px,py,z+1.56),.095,2.7,'Oxidized metal',12)
    roof=29.3
    slab('Overhanging crown',(10.2,8),11.7,10.6,roof,.48,'Graphite',1.7)
    tube('Crown perimeter',[(a,b,roof+.5) for a,b in rounded(10.2,8,11.85,10.75,1.7)],.11,'Violet neon',True)
    # Rooftop machinery and a stepped communication spire.
    for px in [8,10.3,12.6]:hvac(px,8.5,29.82,.8)
    for px in [7.6,8.25]:tube('Roof chilled-water pipe',[(px,6,29.91),(px,10,29.91),(px+.32,10.4,30.25),(px+1.6,10.4,30.25)],.13,'Copper')
    box('Rooftop service screen',(13.8,10.5,30.6),(.15,2.3,1.5),'Graphite',.035)
    for zz in [30.1,30.5,30.9]:box('Service screen louvers',(13.95,10.5,zz),(.35,2.35,.17),'Oxidized metal',.03)
    for j in range(3):cylinder('Aerial stage',(8,11,30.2+j*1.1),.21-j*.05,1.55,'Aluminium',12)
    ring('Signal beacon',(8,11,33.1),.24,.03,'Pink neon')
    # Recessed entrance, framed doors and lobby desks.
    for px in [7.7,10.4,13.1]:window(px,2.96,2.8,2.15,2.8,False)
    box('Reception desk',(10.4,3.7,1.98),(2.4,.7,1.1),'Stone',.15)
    text('Exchange identity','ASTER',(11,2.7,4.85),.7,'Cyan neon')
    area('Exchange cyan wash',(11,1.6,5),'#59c9ec',550,8,(11,4,1))
    area('Tower edge magenta',(17,12,29),'#be83ff',850,9,(10,7,19))
    status('Aster Exchange modeled')

def hotel():
    collection('02 · Lantern Hotel')
    x,y=-12.7,10
    slab('Hotel foundation',(x,y),10.6,10.9,.8,.4,'Stone',.9)
    slab('Hotel ground plinth',(x,y),10,10.4,1.2,3.5,'Graphite',.9)
    for f in range(4):
        z=4.7+f*3;shift=.5 if f>=2 else 0
        w=9.9-f*.28;depth=10.1-f*.23;cx=x-shift;front=y+.2-depth/2-.015
        # Open window bays, with real wall thickness and rooms behind the glass.
        box('Hotel rear masonry',(cx,y+.2+depth/2-.18,z+1.47),(w,.36,2.95),'Warm plaster',.08)
        for sx in [-1,1]:box('Hotel return wall',(cx+sx*(w/2-.15),y+.2,z+1.47),(.3,depth,2.95),'Warm plaster',.08)
        for zz,hh in [(z+.27,.54),(z+2.62,.64)]:box('Facade spandrel',(cx,front+.16,zz),(w,.34,hh),'Warm plaster',.04)
        for px in [cx-4.4,cx-2.65,cx-.95,cx+.75,cx+2.45,cx+4.3]:box('Masonry window pier',(px,front+.17,z+1.5),(.38,.35,2.75),'Warm plaster',.025)
        box('Hotel floor',(cx,y+.2,z+.04),(w,depth,.12),'Wood',.01)
        slab('Terrace cornice',(x-shift,y+.06),10.5-f*.28,10.65-f*.23,z+2.85,.18,'Copper',1.12)
        front=y+.2-(10.1-f*.23)/2-.015
        for j in range(5):window(x-shift-3.5+j*1.7,front,z+1.45,1.22,1.85,True)
        # Vertical brick-colored ribs and service pipes on the east return.
        for sy in [7,9.1,11.2,13.3]:
            box('East elevation inset',(x+4.96-f*.14-shift,sy,z+1.4),(.025,1.3,1.65),'Vehicle glazing',0)
            room_panel('East hotel illuminated recess',(x+4.981-f*.14-shift,sy,z+1.4),1.26,1.61,'Honey interior',True)
            box('East hotel glass',(x+5.01-f*.14-shift,sy,z+1.4),(.018,1.3,1.65),'Window glass',0)
            box('East transom light',(x+4.979-f*.14-shift,sy,z+2.14),(.02,1.16,.1),'Amber room',0)
    slab('Rooftop terrace',(x-.6,y+.25),9.65,10.15,16.65,.3,'Stone',1)
    railing([(-17.4,5.7),(-8.8,5.7),(-8.8,13.8)],16.95)
    slab('Penthouse',(x-1,11.6),5.3,4.4,16.95,2.1,'Deep teal',.6)
    hvac(-10.8,12,19.05,.75)
    cylinder('Water tank',(-16,11.7,18),.75,2.1,'Aluminium',24)
    for z in [17.3,18.6]:ring('Tank band',(-16,11.7,z),.755,.075,'Copper')
    for px in [-15.5,-12.7,-9.8]:window(px,4.76,2.76,2.1,2.8,True)
    # Cantilevered sign is a modeled assembly, with real depth and brackets.
    box('Hotel sign case',(-7.1,5.3,10.4),(.6,1.15,8.2),'Graphite',.16)
    text('Hotel vertical neon','H\nO\nT\nE\nL',(-7.1,4.7,12.9),.87,'Pink neon')
    for z in [7.3,13.4]:tube('Sign bracket',[(-8,6.1,z),(-7.1,6.1,z),(-7.1,5.3,z)],.065,'Aluminium')
    box('Ground canopy',(x,4.45,4.6),(9.9,1.6,.23),'Terracotta',.12)
    for px in [-16,-14.3,-12.6,-10.9,-9.2]:
        cylinder('Lantern',(px,3.9,3.85),.21,.48,'Warm neon',16)
        tube('Lantern suspension',[(px,3.9,4.4),(px,3.9,4.1)],.055,'Gunmetal')
    area('Hotel lantern wash',(-12.8,3.9,5.5),'#f1a660',700,8,(-12.8,5,1))
    area('Hotel rose facade',(-6.5,4.3,11),'#ff5299',480,4,(-12,6,8))
    status('Lantern Hotel modeled')

def market():
    collection('03 · Yue Market')
    x,y=-15,-9
    slab('Market sidewalk',(x,y),12.3,9.3,.8,.28,'Stone',.5)
    box('Market rear wall',(x,y+3.8,5.45),(11.3,.34,8.75),'Terracotta',.07)
    box('Market side wall',(x-5.5,y,5.45),(.3,8,8.75),'Warm plaster',.08)
    for z in [1.08,4.45,7.42,9.85]:box('Concrete floor',(x,y,z),(11.7,8.4,.24),'Stone',.055)
    # Arched street arcade, modeled as a swept arch profile.
    for px in [-19.15,-15,-10.85]:
        for dx in [-1.7,1.7]:box('Arcade column',(px+dx,-13.2,2.36),(.25,.5,2.55),'Warm plaster',.045)
        arc=[(px+math.cos(math.pi-i*math.pi/28)*1.7,-13.2,3.61+math.sin(math.pi-i*math.pi/28)*.58) for i in range(29)]
        tube('Cast arcade arch',arc,.135,'Warm plaster')
        window(px,-12.65,2.68,2.85,2.85,True)
        box('Shop counter',(px,-12.05,1.6),(2.3,.6,1.02),'Wood',.08)
    for f,z in enumerate([5.84,8.6]):
        for px in [-19.5,-17.25,-15,-12.75,-10.5]:
            window(px,-13.16,z,1.58,1.8,warm=(f==0 or px>-15))
            if int(px*4)%3==0:hvac(px,-13.7,z-.75,.43)
        tube('Balcony rail',[(-20.7,-13.8,z-.56),(-9.3,-13.8,z-.56)],.085,'Gunmetal')
        for px in np.arange(-20.5,-9.2,1.6):tube('Balcony post',[(px,-13.8,z-1.05),(px,-13.8,z-.56)],.065,'Gunmetal')
        # Return facade: glazed bay windows, masonry piers and horizontal shades.
        for yy in [-11.65,-9.35,-7.05]:
            box('Market side reveal',(-9.19,yy,z),(.28,1.87,2.0),'Terracotta',.035)
            box('Market side pane',(-9.035,yy,z),(.025,1.6,1.58),'Vehicle glazing',0)
            room_panel('Market return interior',(-9.012,yy,z),1.56,1.54,'Apricot interior' if f==0 else 'Lagoon interior',True)
            box('Market return glazing',(-8.992,yy,z),(.018,1.6,1.58),'Window glass',0)
            box('Return ceiling light',(-9.005,yy,z+.64),(.018,1.38,.085),'Amber room' if f==0 else 'Teal room',0)
            box('Side projecting sill',(-8.94,yy,z-.88),(.52,1.98,.12),'Stone',.025)
        for yy in [-12.9,-10.5,-8.2,-5.7]:box('Return brick pier',(-9.35,yy,z),(.28,.27,2.6),'Warm plaster',.035)
    # Roof service area, skylights and an open timber pergola.
    box('Roof stair head',(-18.5,-6.7,10.65),(3.2,3,1.5),'Deep teal',.08)
    for px in [-16.2,-13.8]:hvac(px,-6.2,9.98,.85)
    for px in [-12,-9.9]:
        for py in [-12,-8.5]:cylinder('Pergola round post',(px,py,11),.115,2,'Copper',12)
    for py in np.linspace(-12,-8.5,5):box('Pergola slat',(-10.95,py,12.04),(2.8,.32,.23),'Wood')
    railing([(-20.7,-12.7),(-20.7,-5.3),(-9.3,-5.3)],10.02,.86)
    box('Market sign fascia',(-15,-13.68,4.22),(9.8,.26,.72),'Graphite',.055)
    text('Market sign','Y U E   M A R K E T',(-15,-13.85,4.02),.48,'Warm neon')
    box('Vertical turquoise sign',(-20.7,-13.5,6.65),(.94,.3,3.2),'Deep teal',.08)
    text('Market glyphs','夜\n市',(-20.7,-13.69,7.22),.85,'Cyan neon',font=CJK)
    # Layered ceramic tiles give this arcade its own silhouette and highlights.
    for i in range(27):
        for j in range(4):
            px=-20.65+i*.435;py=-13.1-j*.39;pz=3.92-j*.205
            box('Glazed rounded arcade tile',(px,py,pz),(.46,.48,.12),'Glazed plum tile',.07,(.48,0,0))
    tube('Curved tile fascia',[(-20.9,-14.4,3.26),(-9.1,-14.4,3.26)],.075,'Terracotta')
    tube('Facade conduit',[(-20.8,-13.6,1.2),(-20.8,-13.6,8.2),(-18.8,-13.6,8.2),(-18.8,-13.6,10.2)],.095,'Copper')
    area('Market warm arcade',(-15,-14.1,4.1),'#ffb56d',850,10,(-15,-11.8,1.2))
    area('Market cyan spill',(-21,-14,7),'#30dce7',300,3,(-23,-15,1))
    status('Yue Market modeled')

def noodle_bar():
    collection('04 · Orbit noodle bar')
    x,y=-1,-10.2
    slab('Noodle shop foundation',(x,y),7.8,7.6,.8,.25,'Stone',1.1)
    slab('Service core',(x,y+1),6.8,4.1,1.05,5.65,'Terracotta',1.2)
    room_panel('Warm shop rear wall',(-1,-11.28,3.28),5.9,3.55,'Honey interior')
    slab('Floating curved roof',(x,y),8.25,7.9,5.7,.35,'Graphite',1.7)
    tube('Magenta fascia',[(a,b,5.82) for a,b in rounded(x,y,8.3,7.95,1.7)],.095,'Pink neon',True)
    striped_awning(-1,-13.1,4.94,6.9,1.25)
    for py in [-10.2,-7.5]:cafe_table(-6.9,py)
    for px in [-3.8,1.9]:
        cylinder('Cafe ceramic pot',(px,-14.65,1.13),.27,.62,'Mint enamel',24,r2=.35)
        tree(px,-14.65,1.42,.37)
    # Shelves, bowls, bottles and pendants remain visible through the storefront.
    for zz in [2.95,3.75]:
        box('Kitchen shelf',(-1,-11.53,zz),(5.3,.44,.1),'Wood',.04)
        for i in range(7):
            px=-3.15+i*.7
            cylinder('Kitchen bowl',(px,-11.58,zz+.14),.11,.14,'Awning cream',16,r2=.17)
    for px in [-3.2,-1,1.2]:
        tube('Pendant stem',[(px,-12.6,5.5),(px,-12.6,4.8)],.05,'Gunmetal')
        cylinder('Pendant shade',(px,-12.6,4.65),.24,.28,'Copper',24,r2=.12)
        cylinder('Pendant diffuser',(px,-12.6,4.5),.21,.035,'Warm neon',24)
    for px in [-3.8,-1,1.8]:
        box('Glass storefront',(px,-13.7,2.92),(2.55,.025,3.5),'Window glass',0)
        box('Shopfront upright',(px-1.35,-13.73,2.92),(.15,.16,3.8),'Copper',.035)
    box('Noodle counter',(x,-12.9,1.6),(5.8,.62,1.1),'Wood',.08)
    box('Counter steel top',(x,-12.9,2.17),(5.94,.73,.06),'Aluminium')
    for px in [-3.25,-1.75,-.25,1.25]:
        cylinder('Counter stool stem',(px,-14.5,1.22),.035,.8,'Gunmetal',12)
        cylinder('Stool seat',(px,-14.5,1.64),.23,.08,'Terracotta',20)
        cylinder('Bowl',(px,-12.9,2.29),.14,.13,'Pale ceramic',16,r2=.2)
    ring('ORBIT outer sign',(-1,-10,8.35),1.6,.11,'Copper','y')
    ring('ORBIT neon ring',(-1,-10.08,8.35),1.4,.055,'Pink neon','y')
    text('Orbit wordmark','ORBIT',(-1,-10.17,8.11),.63,'Warm neon')
    box('Sign mounting plinth',(-1,-9.9,6.5),(.2,.4,1.3),'Gunmetal')
    hvac(1,-8.5,6.06,.6)
    railing([(-3.8,-7.1),(-3.8,-11.9),(1.6,-11.9)],6.05,.65)
    area('Noodle bar warm interior',(-1,-13.1,4.6),'#ffc681',420,5,(-1,-12,1))
    area('Orbit pink pavement',(-1,-14.5,6),'#ff478d',350,5,(-1,-16,1))
    area('Orbit terrace pink bounce',(-4.8,-9.5,4.6),'#ee5aad',240,4,(-8,-9.5,1))
    status('Orbit modeled')

def station():
    collection('05 · Harbor transit hall')
    slab('Station platform',(13,-10),18,9,.8,.8,'Stone',1.7)
    box('Station back wall',(13,-6.1,3),(16.2,.25,3.2),'Deep teal',.08)
    # Six substantial arches replace the ten hairline ribs of the glass vault.
    for i in range(6):
        x=4.5+i*3.42
        arc=[(x,-10+math.cos(t)*3.95,4.25+math.sin(t)*2.15) for t in np.linspace(0,math.pi,33)]
        tube('Elliptical roof rib',arc,.16,'Pale ceramic')
        for y in [-13.9,-6.1]:cylinder('Vault round column',(x,y,2.9),.16,2.6,'Oxidized metal',16)
        if i<5:
            verts=arc+[(p[0]+3.42,p[1],p[2]) for p in arc];faces=[(j,j+1,j+34,j+33) for j in range(32)]
            me=bpy.data.meshes.new('Glazed barrel roof');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Vault glazing',me);link(o,'Canopy glass')
    for x in [7,11,15,19]:
        box('Ticket gates',(x,-10.5,2.1),(.45,1.3,1),'Aluminium',.1)
        box('Gate scanner',(x,-11.1,2.66),(.25,.15,.04),'Cyan neon',0)
    tube('Station luminous canopy edge',[(4.6,-13.99,4.15),(21.4,-13.99,4.15)],.1,'Cyan neon')
    text('Station identity','H A R B O R  /  0 7',(13,-14.02,3.56),.54,'Cyan neon')
    # Platform seating and travelers are enclosed by the actual glass vault.
    for x in [7,12,17]:box('Platform bench',(x,-8.2,2.08),(2.3,.5,.11),'Wood')
    for x in [6,10,18,20]:person(x,-9.1,1.64,'Deep teal' if x%3 else 'Cloth')
    for o in list(GROUP.objects):o.location.z+=3.1;o.location.y+=1.8
    # The elevated concourse opens directly onto a full-length boarding platform.
    box('Boarding platform',(13,-13.425,4.55),(19,4.45,.3),'Stone',.12)
    box('Platform safety marking',(13,-15.35,4.72),(18.6,.22,.018),'Awning cream',0)
    for xx in [5,13,21]:
        for yy in [-13,-5]:cylinder('Station support',(xx,yy,2.5),.19,3.4,'Concrete')
    steps('Station approach staircase',24,-13.45,.8,2.25,3.9,26,.29)
    box('Stair landing',(23,-5.67,4.55),(4.2,1.65,.3),'Stone',.1)
    for xx in [22.77,25.23]:
        tube('Station stair handrail',[(xx,-13.7,1.9),(xx,-6.05,5.8),(xx,-4.9,5.8)],.09,'Gunmetal')
        for t in [0,.5,1]:
            yy=-13.7+7.65*t;top=1.9+3.9*t
            tube('Stair rail support',[(xx,yy,top-1.05),(xx,yy,top)],.07,'Gunmetal')
    railing([(22.65,-13.5),(22.65,-15.35)],4.7,.95)
    # Clear lift shaft, with a separate animated cabin exported below.
    for xx in [1.7,3.7]:
        for yy in [-13.5,-11.5]:cylinder('Lift shaft round column',(xx,yy,4.2),.12,6.8,'Oxidized metal',12)
    for xx in [1.7,3.7]:box('Lift shaft glass',(xx,-12.5,4.2),(.024,2,6.65),'Canopy glass',0)
    box('Lift headhouse',(2.7,-12.5,7.72),(2.4,2.4,.25),'Graphite',.16)
    box('Lift bridge',(3.5,-12.5,4.6),(2.2,2.1,.2),'Stone',.08)
    area('Station cool canopy',(13,-9.2,8.7),'#74d9ee',800,13,(13,-8.2,4.7))
    status('Transit hall modeled')

def utilities():
    collection('06 · Stacked service habitat')
    slab('Habitat plinth',(-22,9),5.6,10,.8,.3,'Stone',.35)
    for f in range(4):
        z=1.1+f*2.9;x=-22+(0 if f%2 else .35)
        slab('Stepped blue habitat',(x,9),5.2,9.2,z,2.75,'Deep teal',.48)
        for px in [x-1.25,x+1.2]:window(px,4.35,z+1.4,1.7,1.75,warm=f%2==0)
        slab('Deep ledge',(x,9),5.65,9.6,z+2.73,.19,'Graphite',.55)
    for x in [-23.5,-21]:hvac(x,10,12.75,.65)
    tube('Habitat antenna',[(-22,12,12.9),(-22,12,16)],.1,'Oxidized metal')
    ring('Antenna collar',(-22,12,15),.45,.07,'Cyan neon')
    box('Teal blade sign',(-24.6,4.12,7.6),(.85,.24,4.5),'Graphite',.06)
    text('Habitat number','2\n4',(-24.6,3.95,8.3),.92,'Cyan neon')
    collection('07 · Thermal exchange')
    slab('Plant plinth',(-1,20),8,5.3,.8,.25,'Stone',.35)
    box('Thermal housing',(-1,20,4.65),(7.4,4.8,7.2),'Graphite',.12)
    for x in [-3.4,-1,1.4]:
        cylinder('Pressure tower',(x,20,9.1),.8,4.3,'Aluminium',24)
        for z in [7.5,9,10.5]:ring('Pressure collar',(x,20,z),.84,.05,'Copper')
        tube('Elbow service pipe',[(x,19.95,10.5),(x,18.3,10.5),(x,17.65,9.9),(x,17.65,6.3)],.2,'Copper')
    for i in range(5):box('Plant louver',(-1,17.56,2.35+i*.95),(6.9,.26,.35),'Oxidized metal',.05)
    text('Plant marker','N-09',(-1,17.41,6.25),.65,'Violet neon')
    for o in list(GROUP.objects):o.location.y-=4.7
    status('Utility buildings modeled')

def bridges():
    collection('08 · Connections')
    # Suspended enclosed skybridge between hotel and tower, offset from the plaza.
    box('Skybridge deck',(-1.3,12.4,11),(12.7,2.2,.28),'Aluminium',.06)
    box('Skybridge roof',(-1.3,12.4,13.5),(13.2,2.6,.23),'Graphite',.1)
    for y in [11.35,13.45]:
        box('Skybridge glass',(-1.3,y,12.25),(12.7,.025,2.2),'Window glass',0)
        for x in np.linspace(-7.35,4.75,6):cylinder('Skybridge round column',(x,y,12.25),.11,2.4,'Copper',12)
        box('Skybridge lower fascia',(-1.3,y,11.26),(12.7,.17,.22),'Oxidized metal',.045)
    # A dedicated elevated tram line crosses the waterfront, with supported track.
    for x in [-26,-18,-8,2,12,22,27]:
        cylinder('Viaduct round pier',(x,-17,2.6),.33,3.6,'Concrete',16)
        box('Viaduct cap',(x,-17,4.45),(1.4,2.3,.3),'Concrete',.1)
    box('Viaduct deck',(0,-17,4.48),(58,3.2,.46),'Graphite',.1)
    for x in np.arange(-28.7,29,.95):box('Rail sleeper',(x,-17,4.78),(.29,1.6,.1),'Wood',.025)
    for y in [-17.58,-16.42]:box('Steel rail',(0,y,4.89),(58,.14,.12),'Oxidized metal',.025)
    box('Viaduct front parapet',(0,-18.55,5.02),(58,.24,.6),'Deep teal',.06)
    for a,b in [(-29,3.3),(22.7,29)]:box('Viaduct rear parapet',((a+b)/2,-15.45,5.02),(b-a,.24,.6),'Deep teal',.06)
    # Battery trams keep the view clear of suspended contact wires and gantries.
    for x in [-28.4,28.4]:
        box('Rail buffer stop',(x,-17,5.3),(.22,1.6,.58),'Gunmetal',.06)
        box('Buffer reflector',(x,-17,5.58),(.26,1.62,.095),'Signal red',.02)
    status('Bridges and tram infrastructure modeled')

def vehicles():
    import craftsmanship
    craftsmanship.lift_cabin();craftsmanship.taxi()
    import detailed_assets
    import metro_train
    metro_train.train();detailed_assets.ferry()
    status('Vehicles modeled')

def prepare_collection(c):
    objects=[o for o in c.objects if o.type in {'MESH','CURVE','FONT'}]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.convert(target='MESH')
    objects=list(bpy.context.selected_objects)
    for o in objects:
        if o.get('preserveDetailUV') and o.data.uv_layers.get('DetailUV'):continue
        uv=o.data.uv_layers.get('DetailUV') or o.data.uv_layers.new(name='DetailUV')
        normal_matrix=o.matrix_world.inverted().transposed().to_3x3()
        for p in o.data.polygons:
            n=normal_matrix@p.normal;axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
            for li in p.loop_indices:
                v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
                uv.data[li].uv=(v[axes[0]]*.35,v[axes[1]]*.35)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    o=bpy.context.object;o.name=c.name;o['asset']=c.name;o['authoredIn']='Blender 5.2.2 / original procedural modeling'
    return o

def export_assets():
    status('consolidating geometry')
    static=[];manifest=[]
    animated=['Taxi','Metro','Ferry','Lift','Signals','Mall lift','Mall doors']
    groups=[c for c in bpy.data.collections if c.name[0:2].isdigit() or c.name in animated]
    for c in groups:
        if not len(c.objects):continue
        o=prepare_collection(c);moving=c.name in animated
        slug=c.name.split(' · ')[-1].lower().replace(' ','-')
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        path=OUT/(slug+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,
            export_vertex_color='MATERIAL')
        manifest.append({'name':c.name,'file':path.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'moving':moving})
        if not moving:static.append(o)
        else:o.hide_render=True;o.hide_set(True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in static:o.select_set(True)
    bpy.context.view_layer.objects.active=static[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/'nocturne-city.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    (OUT/'manifest.json').write_text(json.dumps({'version':1,'units':'metres','source':'assets/blender/nocturne-harbor.blend','assets':manifest,'lights':LIGHTS,'vegetation':VEGETATION},indent=2),encoding='utf-8')
    return static

def presentation():
    s=bpy.context.scene
    s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        for d in prefs.devices:d.use=d.type!='CPU'
        s.cycles.device='GPU'
    except Exception:pass
    s.world.use_nodes=True;s.world.node_tree.nodes.get('Background').inputs[0].default_value=(*rgb('#393760'),1);s.world.node_tree.nodes.get('Background').inputs[1].default_value=.4
    area('Soft moon key',(-20,-12,45),'#aeb7ff',20000,40,(0,0,0))
    area('Warm back rim',(10,25,35),'#c885db',15000,32,(0,0,7))
    area('Front bounce',(15,-38,20),'#99d9df',6500,34,(0,0,5))
    d=bpy.data.cameras.new('Isometric camera');cam=bpy.data.objects.new('Isometric camera',d);s.collection.objects.link(cam)
    cam.location=(72,-92,76);target=Vector((0,-1,7));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=99;s.camera=cam
    s.render.resolution_x=1600;s.render.resolution_y=1200;s.render.resolution_percentage=100
    s.view_settings.view_transform='AgX'
    collection('Preview water')
    material('Preview sea','#102a3a',.25,.48)
    box('Preview ocean',(0,0,-2.1),(2000,2000,.1),'Preview sea',0)
    for screen in bpy.data.screens:
        for a in screen.areas:
            if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
    s.render.filepath=str(SOURCE/'nocturne-preview.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'nocturne-harbor.blend'))
    status('assets exported',models=13)

def build():
    global CJK
    initialize()
    font=Path('C:/Windows/Fonts/msyh.ttc');CJK=bpy.data.fonts.load(str(font)) if font.exists() else None
    foundation();tower();hotel();market();noodle_bar();station();utilities();bridges();vehicles()
    # Preserve every separate mesh/curve before merging render geometry.
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'nocturne-source.blend'))
    export_assets();presentation();status('complete')

if __name__=='__main__':
    try:build()
    except Exception:
        status('failed',error=traceback.format_exc());raise
