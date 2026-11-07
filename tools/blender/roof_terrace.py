"""Restrained viewing terrace: shaped timber seating and a harbour viewer.

Original Blender meshes in metres. Construction references are recorded in
reference/asset-references.md; the dome and continuous paving are untouched.
"""
import math
import random
import bpy
import bmesh
from mathutils import Matrix, Vector
import build_city as b
import craftsmanship as craft
import mall_interior as mi
import public_realm as realm
from detailed_assets import mesh_object

BENCHES=[(41.00,-7.30,0),(51.00,-7.30,0),(52.20,-1.60,math.pi/2),(39.90,-1.60,-math.pi/2)]
WIDTH=3.15
# One lamp beside an end of each bench: 1.2 m clear at floor level, 3.0 m from
# the bench centre so the measured gap matches the original terrace. The south
# east viewer keeps its eyepieces clear of every lamp and bench.
LAMPS=[(44.00,-7.30),(48.00,-7.30),(52.20,1.40),(39.90,-4.60)]
VIEWER=(53.30,-5.00,math.pi/4)
LITTER=(42.40,5.05)
TROUGHS=[(45.20,5.15),(49.40,5.15)]
# Furniture stays outside the lantern upstand, not just outside its glazing.
DOME_CX,DOME_CY,DOME_RX,DOME_RY=46.0,-1.0,4.15,5.45


def transform(objects,x,y,z,yaw):
    # Resolve freshly created object locations/rotations before composing the
    # assembly transform; otherwise cylinders lose their local fitting offsets.
    bpy.context.view_layer.update()
    matrix=Matrix.Translation((x,y,z))@Matrix.Rotation(yaw,4,'Z')
    for obj in objects:obj.matrix_world=matrix@obj.matrix_world


def curved_plank(name,profile,width,material):
    """Sweep an ergonomic closed section along a gentle curved plan."""
    vertices=[];faces=[];n=len(profile);segments=32
    for i in range(segments+1):
        x=width*(i/segments-.5);bow=.12*(2*x/width)**2
        vertices.extend((x,y+bow,z) for y,z in profile)
    for i in range(segments):
        for j in range(n):
            a=i*n+j;c=i*n+(j+1)%n
            faces.append((a,c,c+n,a+n))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(range(segments*n,(segments+1)*n))])
    obj=mesh_object(name,vertices,faces,material)
    mesh=bmesh.new();mesh.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(mesh,faces=list(mesh.faces));mesh.to_mesh(obj.data);mesh.free()
    craft.soften(obj,.015,3)
    # Follow the plank rather than projecting wood grain in world space.
    uv=obj.data.uv_layers.new(name='DetailUV')
    for loop in obj.data.loops:
        p=obj.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(p.x*.65,(p.y+p.z)*2.6)
    obj['preserveDetailUV']=True
    return obj


def bench(x,y,z,yaw,index):
    before=set(b.GROUP.objects)
    for row,cy in enumerate([-.255,-.085,.085]):
        top=.465+(0.008 if row==1 else 0)
        seat=curved_plank('Galleria terrace sculpted seat',[(cy-.077,top-.065),
            (cy+.077,top-.065),(cy+.077,top),(cy-.077,top)],WIDTH,'Wood')
        if row==1:seat['terraceBench']=index+1;seat['seawardYaw']=yaw
    for low in [.58,.77]:
        profile=[(.27+(h-.58)*.23,h) for h in [low,low+.165]]
        a,c=profile
        curved_plank('Galleria terrace inclined timber back',[a,c,(c[0]+.064,c[1]),(a[0]+.064,a[1])],WIDTH,'Wood')
    # The cast side frames carry both seat and back, with real feet on the roof.
    for xx in [-1.16,1.16]:
        bow=.12*(2*xx/WIDTH)**2
        profile=[(-.29,.025),(-.215,.025),(-.18,.405),(.245,.405),
            (.295,.59),(.36,.94),(.425,.94),(.36,.57),(.315,.39),
            (.36,.025),(.28,.025),(.20,.30),(-.11,.30)]
        side=craft.profile_beam('Galleria terrace cast support',[(a+bow,c) for a,c in profile],xx-.045,xx+.045,0,'Copper')
        craft.soften(side,.017,3)
        for yy in [-.25,.32]:
            shoe=b.slab('Galleria terrace recessed fixing shoe',(xx,yy+bow),.23,.19,0,.032,'Copper',.055)
            shoe['terraceFoot']=True
            for dx in [-.075,.075]:b.cylinder('Galleria terrace stainless anchor',(xx+dx,yy+bow,.037),.019,.013,'Aluminium',10)
        # Arm supports return into the cast frame, not into unsupported timber.
        b.tube('Galleria terrace swept armrest',[(xx,-.21+bow,.37),(xx,-.23+bow,.65),
            (xx,-.17+bow,.70),(xx,.22+bow,.70),(xx,.315+bow,.64)],.038,'Copper')
    curved_plank('Galleria terrace continuous underseat bearer',[(-.09,.325),(.015,.325),(.015,.405),(-.09,.405)],2.62,'Copper')
    # Recessed warm diffuser, screened by a downward-facing metal hood.
    curved_plank('Galleria terrace light shielding',[(-.20,.33),(-.10,.33),(-.10,.37),(-.20,.37)],2.42,'Copper')
    curved_plank('Galleria terrace underseat diffuser',[(-.192,.32),(-.125,.32),(-.125,.332),(-.192,.332)],2.30,'Honey interior')
    new=set(b.GROUP.objects)-before
    for obj in new:obj['terraceAssembly']='bench';obj['terraceIndex']=index
    transform(new,x,y,z,yaw)


def viewer(x,y,z,yaw):
    """Weatherproof binocular head with recessed optics and a pivoting yoke."""
    before=set(b.GROUP.objects)
    mi.lathe('Galleria terrace viewer anchored base',0,0,0,[(.26,0),(.29,.035),(.26,.09),(.13,.15),(.115,.23)],'Copper',32)
    mi.lathe('Galleria terrace viewer tapered pedestal',0,0,.17,[(.11,0),(.09,.84),(.12,.91),(.12,.96)],'Copper',32)
    for a in [0,math.pi/2,math.pi,math.pi*1.5]:b.cylinder('Galleria terrace viewer fixing',(math.cos(a)*.20,math.sin(a)*.20,.074),.024,.018,'Aluminium',10)
    profile=[(-.11,1.05),(.11,1.05),(.11,1.22),(.31,1.28),(.37,1.59),
        (.29,1.59),(.25,1.34),(-.25,1.34),(-.29,1.59),(-.37,1.59),(-.31,1.28),(-.11,1.22)]
    yoke=craft.profile_beam('Galleria terrace viewer cast yoke',profile,-.065,.065,1,'Aluminium');craft.soften(yoke,.025,3)
    housing=b.slab('Galleria terrace viewer weatherproof head',(0,-.015),.60,.51,1.34,.27,'Mineral blue',.13)
    housing['terraceViewer']=True
    # Twin flared lens barrels are hollow, with the front glass recessed inside.
    for xx in [-.155,.155]:
        tube=mi.lathe('Galleria terrace viewer sealed optical barrel',xx,0,0,
            [(.108,0),(.124,.12),(.124,.25),(.102,.25),(.102,.21)],'Mineral blue',32)
        tube.matrix_world=Matrix.Translation((0,-.14,1.48))@Matrix.Rotation(math.pi/2,4,'X')@tube.matrix_world
        b.cylinder('Galleria terrace viewer optical recess',(xx,-.352,1.48),.100,.014,'Gunmetal',32,(math.pi/2,0,0))
        b.cylinder('Galleria terrace viewer coated lens',(xx,-.362,1.48),.091,.014,'Window glass',32,(math.pi/2,0,0))
        b.cylinder('Galleria terrace viewer rubber eyecup',(xx,.29,1.48),.064,.13,'Gunmetal',24,(math.pi/2,0,0))
        b.cylinder('Galleria terrace viewer eyepiece',(xx,.356,1.48),.043,.014,'Window glass',24,(math.pi/2,0,0))
    for xx in [-.34,.34]:
        b.cylinder('Galleria terrace viewer pivot',(xx,0,1.49),.065,.10,'Copper',24,(0,math.pi/2,0))
        b.tube('Galleria terrace viewer moulded handgrip',[(xx,-.10,1.43),(xx*1.30,-.14,1.37),(xx*1.34,-.11,1.23)],.035,'Gunmetal')
    new=set(b.GROUP.objects)-before
    for obj in new:obj['terraceAssembly']='viewer'
    transform(new,x,y,z,yaw)


def litter(x,y,z):
    """Small lift-side litter cabinet, with a hollow opening and folded lid."""
    case=b.slab('Galleria terrace litter enclosure',(x,y),.63,.48,z,.91,'Mineral blue',.12)
    realm.apply_difference(case,[b.slab('Temporary terrace litter pocket',(x,y),.51,.36,z+.06,1.0,'Gunmetal',.075),
        b.box('Temporary terrace litter opening',(x,y-.23,z+.74),(.35,.20,.17),'Gunmetal',.04)])
    craft.soften(case,.012,3)
    b.slab('Galleria terrace litter lid',(x,y),.66,.51,z+.91,.055,'Copper',.13)
    b.box('Galleria terrace litter removable liner',(x,y,z+.52),(.45,.31,.38),'Gunmetal',.05)
    b.box('Galleria terrace litter folded rim',(x,y-.254,z+.64),(.38,.055,.04),'Aluminium',.012)


def trough(x,y,z,index):
    """Ribbed planter trough with clipped, irregular shrubs, not rows of balls."""
    body=b.slab('Galleria terrace planting trough',(x,y),1.60,.52,z,.46,'Mineral blue',.11)
    realm.apply_difference(body,[b.slab('Temporary trough soil pocket',(x,y),1.44,.36,z+.10,.60,'Gunmetal',.08)])
    craft.soften(body,.012,3)
    b.slab('Galleria terrace trough cap',(x,y),1.66,.58,z+.46,.045,'Copper',.13)
    b.slab('Galleria terrace trough soil',(x,y),1.46,.38,z+.42,.05,'Tree soil',.10)
    rng=random.Random(int(x*97+index*13))
    foliage={name:([],[]) for name in ['Leaf','Leaf light']}
    for i in range(5):
        root=Vector((x+rng.uniform(-.52,.52),y+rng.uniform(-.09,.09),z+.46))
        crown=root+Vector((rng.uniform(-.10,.10),rng.uniform(-.06,.06),rng.uniform(.26,.44)))
        b.tube('Galleria trough woody stem',[tuple(root),tuple(crown)],.022,'Bark')
        for j in range(22):
            a=rng.uniform(0,math.tau);r=rng.uniform(.05,.34)
            center=crown+Vector((math.cos(a)*r,math.sin(a)*r,rng.uniform(-.16,.12)))
            along=Vector((math.cos(a),math.sin(a),rng.uniform(-.10,.45))).normalized()
            across=Vector((-math.sin(a),math.cos(a),0))
            length=rng.uniform(.11,.20);width=length*.46
            vertices,faces=foliage['Leaf light' if j%3==0 else 'Leaf'];offset=len(vertices)
            for u,v,dz in [(-1,0,0),(-.3,-1,0),(.55,-.75,.01),(1,0,.04),(.55,.75,.01),(-.3,1,0),(0,0,.035)]:
                vertices.append(tuple(center+along*(u*length)+across*(v*width)+Vector((0,0,dz))))
            for k in range(6):faces.append((offset+6,offset+k,offset+(k+1)%6))
    for name,(vertices,faces) in foliage.items():
        obj=mesh_object('Galleria terrace trough foliage',vertices,faces,name,True)
        obj['terraceAssembly']='trough'


def lamp(x,y,z,index):
    """Shielded terrace lantern: spun cap, cast stem and sealed downlight."""
    before=set(b.GROUP.objects)
    base=mi.lathe('Galleria terrace lamp anchored shoe',x,y,z,
        [(.19,0),(.20,.025),(.18,.065),(.11,.10),(.09,.16)],'Copper',32)
    base['terraceFoot']=True
    stem=mi.lathe('Galleria terrace lamp tapered stem',x,y,z+.08,
        [(.089,0),(.076,.14),(.054,1.45),(.068,1.62)],'Mineral blue',32)
    stem['terraceLamp']=index+1
    for a in [0,math.tau/3,math.tau*2/3]:
        b.cylinder('Galleria terrace lamp fixing',(x+.135*math.cos(a),y+.135*math.sin(a),z+.062),.018,.014,'Aluminium',10)
        # Curved cast branches join the head outside the recessed optical lens.
        points=[]
        for j in range(13):
            t=j/12;r=.035+.355*(t*t*(3-2*t))
            points.append((x+r*math.cos(a),y+r*math.sin(a),z+1.60+.58*t))
        b.tube('Galleria terrace lamp swept head support',points,.028,'Copper')
    mi.lathe('Galleria terrace lamp formed cap',x,y,z,
        [(.35,2.13),(.445,2.13),(.47,2.17),(.455,2.22),(.36,2.275),(.20,2.31),(.025,2.325)],'Mineral blue',48)
    mi.lathe('Galleria terrace lamp inset bronze bezel',x,y,z,
        [(.317,2.115),(.357,2.115),(.365,2.15),(.317,2.15)],'Copper',40)
    b.cylinder('Galleria terrace lamp sealed opal diffuser',(x,y,z+2.126),.317,.025,'Warm neon',40)
    for obj in set(b.GROUP.objects)-before:
        obj['terraceAssembly']='lamp';obj['terraceIndex']=index
    # Emit just below the diffuser, with a soft cutoff and no upward spill.
    name=f'Galleria rooftop lantern {index+1}'
    data=bpy.data.lights.new(name,'SPOT');data.energy=55;data.color=b.rgb('#ffdab0')
    data.spot_size=2.10;data.spot_blend=.85;data.shadow_soft_size=.24
    obj=bpy.data.objects.new(name,data);b.GROUP.objects.link(obj)
    obj.location=(x,y,z+2.10)
    obj.rotation_euler=(Vector((x,y,z))-obj.location).to_track_quat('-Z','Y').to_euler()
    b.LIGHTS.append({'name':name,'type':'spot','position':[x,z+2.10,-y],
        'target':[x,z,-y],'color':'#ffdab0','power':55,'distance':5.5,
        'angle':1.05,'penumbra':.85,'daylightFactor':0,'roofOnly':True})


def build(z):
    for i,(x,y,yaw) in enumerate(BENCHES):bench(x,y,z,yaw,i)
    viewer(*VIEWER[:2],z,VIEWER[2])
    litter(LITTER[0],LITTER[1],z)
    for i,(x,y) in enumerate(LAMPS):lamp(x,y,z,i)
    for i,(x,y) in enumerate(TROUGHS):trough(x,y,z,i)


def verify(graph,z):
    """Seated views, grounded furniture, real clear routes and dome clearance."""
    collection=bpy.data.collections['07 · Harbor galleria']
    seats=[o for o in collection.objects if o.get('terraceBench')]
    assert len(seats)==4 and len([o for o in collection.objects if o.get('terraceViewer')])==1
    assert len([o for o in collection.objects if o.get('terraceLamp')])==4
    bench_points=[[] for _ in BENCHES];viewer_points=[]
    for obj in collection.objects:
        if not obj.get('terraceAssembly'):continue
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        points=[obj.matrix_world@p.co for p in mesh.vertices];evaluated.to_mesh_clear()
        if obj.get('terraceAssembly')=='bench':bench_points[obj['terraceIndex']].extend(points)
        if obj.get('terraceAssembly')=='viewer':viewer_points.extend(points)
        assert min(p.z for p in points)>=z-.001,f'Terrace furniture penetrates paving: {obj.name}, {min(p.z for p in points):.5f} < {z}'
        assert all(((p.x-DOME_CX)/DOME_RX)**2+((p.y-DOME_CY)/DOME_RY)**2>1.0 for p in points),'Furniture intersects the approved dome'
        if obj.get('terraceFoot'):assert abs(min(p.z for p in points)-z)<.001,'Terrace feet float above the roof'
    for seat,(x,y,yaw) in zip(sorted(seats,key=lambda o:o['terraceBench']),BENCHES):
        forward=(math.sin(yaw),-math.cos(yaw))
        assert forward[0]*(x-DOME_CX)+forward[1]*(y-DOME_CY)>0,'Bench faces inward instead of toward the harbour'
    bench_gaps=[];viewer_gaps=[]
    for (lx,ly),(x,y,yaw),points in zip(LAMPS,BENCHES,bench_points):
        # Measure each bench's evaluated footprint in its own axes, including
        # armrests and bevels. Leave a usable gap beside it, not in front of it.
        local=[((p.x-x)*math.cos(yaw)+(p.y-y)*math.sin(yaw),
            -(p.x-x)*math.sin(yaw)+(p.y-y)*math.cos(yaw)) for p in points]
        lamp_local=((lx-x)*math.cos(yaw)+(ly-y)*math.sin(yaw),
            -(lx-x)*math.sin(yaw)+(ly-y)*math.cos(yaw))
        dx=max(min(p[0] for p in local)-lamp_local[0],0,lamp_local[0]-max(p[0] for p in local))
        dy=max(min(p[1] for p in local)-lamp_local[1],0,lamp_local[1]-max(p[1] for p in local))
        gap=math.hypot(dx,dy)-.20  # Widest part of the grounded lamp shoe.
        assert 1.10<gap<1.40 and abs(lamp_local[1])<.1,'Lamp must sit beside its bench with a comfortable clear gap'
        bench_gaps.append(round(gap,3))
        vx=max(min(p.x for p in viewer_points)-lx,0,lx-max(p.x for p in viewer_points))
        vy=max(min(p.y for p in viewer_points)-ly,0,ly-max(p.y for p in viewer_points))
        viewer_gap=math.hypot(vx,vy)-.47  # Include the complete lamp head.
        assert viewer_gap>3.0,'Rooftop lamp crowds the binocular viewer'
        viewer_gaps.append(viewer_gap)
    return {'outwardFacingBenches':len(seats),'binocularViewer':True,'groundedFeet':True,'domeClearance':True,
        'rooftopLamps':len(LAMPS),'lampBenchGaps':bench_gaps,'lampViewerClearance':round(min(viewer_gaps),3)}
