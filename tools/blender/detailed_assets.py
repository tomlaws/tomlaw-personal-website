"""Authored Blender foliage and hollow transport models, in metres."""
import math, random
import bpy
from mathutils import Vector
import build_city as b


def mesh_object(name,vertices,faces,material,smooth=False):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=b.link(bpy.data.objects.new(name,mesh),material)
    for polygon in mesh.polygons:polygon.use_smooth=smooth
    return obj


def branch(name,points,radii,material='Bark',sides=9):
    vertices=[]
    for i,(point,radius) in enumerate(zip(points,radii)):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        rotation=tangent.to_track_quat('Z','Y')
        for k in range(sides):
            v=rotation@Vector((radius*math.cos(k*math.tau/sides),radius*math.sin(k*math.tau/sides),0))
            vertices.append(Vector(point)+v)
    faces=[tuple(range(sides-1,-1,-1))]
    for i in range(len(points)-1):
        for k in range(sides):
            a=i*sides+k;c=i*sides+(k+1)%sides;faces.append((a,c,c+sides,a+sides))
    faces.append(tuple(range((len(points)-1)*sides,len(points)*sides)))
    return mesh_object(name,vertices,faces,material,True)


def foliage_materials():
    """Local leaf-vein maps, rather than flat painted foliage."""
    import numpy as np
    n=128;y,x=np.mgrid[0:n,0:n]/(n-1)
    for name,colour in [('Leaf','#4a8030'),('Leaf light','#93b83f')]:
        mat=b.material(name,colour,.72,0)
        ribs=np.exp(-((x-.5)/.018)**2)*.11
        ribs+=np.exp(-(np.sin((y-abs(x-.5)*.6)*math.pi*7)/.11)**2)*.045
        grain=np.random.default_rng(24).normal(0,.012,(n,n))
        var=.11*np.sin(y*math.pi)+ribs+grain
        uv=mat.node_tree.nodes.new('ShaderNodeUVMap');uv.uv_map='DetailUV'
        p=mat.node_tree.nodes.get('Principled BSDF')
        for label,is_colour in [('Leaf vein colour',True),('Leaf wax roughness',False),('Leaf vein normal',False)]:
            pixels=np.ones((n,n,4),np.float32)
            if is_colour:pixels[:,:,:3]=np.array(b.rgb(colour))*(1+var[:,:,None])
            elif 'roughness' in label:pixels[:,:,:3]=(.71+grain)[:,:,None]
            else:
                pixels[:,:,0]=.5+(np.roll(ribs,1,1)-np.roll(ribs,-1,1))*.8
                pixels[:,:,1]=.5+(np.roll(ribs,1,0)-np.roll(ribs,-1,0))*.8
                pixels[:,:,2]=1
            im=bpy.data.images.new(name+' / '+label,width=n,height=n);im.colorspace_settings.name='sRGB' if is_colour else 'Non-Color'
            im.pixels.foreach_set((b.encode_colour(pixels) if is_colour else pixels).ravel());im.pack()
            tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im
            mat.node_tree.links.new(uv.outputs[0],tex.inputs[0])
            if 'normal' in label:
                normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.3
                mat.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs[0],p.inputs['Normal'])
            else:mat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color' if is_colour else 'Roughness'])


def tree(x,y,z,tag='',seed=902):
    """Asymmetric orchid-tree miniature: fused trunk, open boughs, broad bifid leaves."""
    from mathutils import Quaternion
    rng=random.Random(seed)
    suffix=' '+tag if tag else ''
    origin=Vector((x,y,z));woody=[]
    def curved(name,points,radii):
        obj=branch(name+suffix,[origin+Vector(p) for p in points],radii,sides=12);woody.append(obj);return obj
    curved('Tree sculpted trunk',[(0,0,-.09),(.04,.02,.35),(-.10,.08,1.1),(-.16,.09,1.8),(.04,.12,2.55),(.26,.2,3.2)],[.34,.29,.235,.185,.13,.055])
    for i in range(6):
        a=i*math.tau/6+.3;r=.58+rng.random()*.25
        curved('Tree root flare',[(math.cos(a)*r,math.sin(a)*r,-.025),(math.cos(a)*.36,math.sin(a)*.36,.06),(.02,0,.43)],[.016,.065,.17])
    crowns=[(-1.5,-.65,3.38),(1.25,-.9,3.7),(-1.35,1.04,3.87),(1.45,.95,4.05),(-.35,-1.4,4.35),(.30,.7,4.95),(-.9,.05,4.65),(.95,-.05,4.7)]
    twigs=[]
    for i,end in enumerate(crowns):
        end=Vector(end);fork=Vector((-.08,.1,1.7+i*.14));mid=fork.lerp(end,.48)+Vector((0,0,.35))
        curved('Tree spreading bough',[fork,fork.lerp(mid,.5),mid,mid.lerp(end,.6),end],[.13,.115,.085,.052,.025])
        yaw=math.atan2(end.y,end.x)
        for j in range(4):
            a=yaw+(j-1.5)*.82
            tip=end+Vector((math.cos(a)*(.55+rng.random()*.25),math.sin(a)*(.55+rng.random()*.25),rng.uniform(-.1,.55)))
            start=mid.lerp(end,.5+j*.12)
            curved('Tree fine branch',[start,start.lerp(tip,.6)+Vector((0,0,.12)),tip],[.043,.025,.009])
            for k in range(4):
                aa=a+(k-1.5)*.95
                base=start.lerp(tip,.40+k*.18)
                shoot=base+Vector((math.cos(aa)*.42,math.sin(aa)*.42,rng.uniform(-.06,.30)))
                twigs.append((origin+base,origin+shoot))
    # Remesh connected woody parts into one softly sculpted branching surface.
    bpy.ops.object.select_all(action='DESELECT')
    for o in woody:o.select_set(True)
    bpy.context.view_layer.objects.active=woody[0];bpy.ops.object.join();trunk=bpy.context.object
    trunk.name='Tree unified sculpted trunk'+suffix
    remesh=trunk.modifiers.new('Joined living branch unions','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.045
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=trunk.modifiers.new('Soft bark silhouette','SMOOTH');smooth.factor=.65;smooth.iterations=3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate=trunk.modifiers.new('Tree mesh budget','DECIMATE');decimate.ratio=.42
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for p in trunk.data.polygons:p.use_smooth=True
    trunk['primaryBoughs']=len(crowns)
    leaves=[];faces=[];uvs=[];shades=[]
    # The rounded two-lobed tip is characteristic of Bauhinia foliage.
    outline=[(0,0),(-.34,.13),(-.52,.40),(-.47,.72),(-.29,.95),(-.10,.96),(0,.75),(.10,.96),(.29,.95),(.47,.72),(.52,.40),(.34,.13)]
    for a,c in twigs:
        branch('Tree attached leafy shoot',[a,c],[.011,.003],sides=6)
        axis=(c-a).normalized()
        for j in range(6):
            base=a.lerp(c,.22+j*.14)
            yaw=math.atan2(axis.y,axis.x)+(1 if j%2 else -1)*rng.uniform(.6,1.65)
            tilt=rng.uniform(-.3,.55);forward=Vector((math.cos(yaw)*math.cos(tilt),math.sin(yaw)*math.cos(tilt),math.sin(tilt)))
            across=Vector((-math.sin(yaw),math.cos(yaw),0));up=across.cross(forward)
            if up.z<0:up=-up
            length=rng.uniform(.43,.65);width=rng.uniform(.70,1.04);start=len(leaves)
            coords=[(0,.48)]+outline
            for u,v in coords:
                curve=.075*math.sin(v*math.pi)-.14*u*u
                leaves.append(base+forward*(v*length)+across*(u*length*width)+up*curve)
                uvs.append((u+.5,v))
            shade=1 if rng.random()<.32 else 0
            for k in range(len(outline)):
                face=(start,start+1+k,start+1+(k+1)%len(outline));faces.append(face);shades.append(shade)
    foliage=mesh_object('Tree broad veined leaves'+suffix,leaves,faces,'Leaf',True)
    foliage.data.materials.append(b.M['Leaf light'])
    for p,shade in zip(foliage.data.polygons,shades):p.material_index=shade
    uv=foliage.data.uv_layers.new(name='DetailUV')
    for loop in foliage.data.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
    foliage['preserveDetailUV']=True;foliage['leafCount']=len(twigs)*6
    # Runtime sway uses the authored root and canopy envelope. DetailUV.y is
    # zero at each leaf's petiole, so flutter never detaches it from its shoot.
    wind={'root':[x,z,-y], 'height':max(p.z for p in leaves)-z,
          'radius':max(math.hypot(p.x-x,p.y-y) for p in leaves)+.12}
    trunk['windRoot']=wind['root'];foliage['windLeafTipUV']='DetailUV.y'
    b.VEGETATION.append(wind)
    # A few small orchid flowers mark the species without turning the crown pink.
    for i in [4,19,33,49,68,86,103,121]:
        center=twigs[i][1]+Vector((0,0,.04))
        petal_vertices=[];petal_faces=[]
        for k in range(5):
            a=k*math.tau/5;direction=Vector((math.cos(a),math.sin(a),.3));cross=Vector((-math.sin(a),math.cos(a),0))
            offset=len(petal_vertices)
            for u,v in [(0,0),(-.09,.09),(-.08,.20),(0,.24),(.08,.20),(.09,.09)]:petal_vertices.append(center+direction*v+cross*u)
            petal_faces.append(tuple(range(offset,offset+6)))
        mesh_object('Sparse orchid blossom'+suffix,petal_vertices,petal_faces,'Awning coral',True)


def glass_panel(name,points):
    obj=mesh_object(name,points,[(0,1,2,3)],'Window glass')
    obj.modifiers.new('Glass thickness','SOLIDIFY').thickness=.012
    return obj


def arch_roof(name,width,length,y,z,rise,material):
    vertices=[];steps=16;stations=[(-.5,.77),(-.46,.97),(-.39,1),(.39,1),(.46,.97),(.5,.77)]
    for along,scale in stations:
        for i in range(steps+1):
            u=-1+2*i/steps
            vertices.append((u*width*.5*scale,y+along*length,z+rise*(1-u*u)))
    faces=[]
    for j in range(len(stations)-1):
        for i in range(steps):
            a=j*(steps+1)+i;faces.append((a,a+1,a+steps+2,a+steps+1))
    roof=mesh_object(name,vertices,faces,material,True)
    roof.modifiers.new('Rolled roof thickness','SOLIDIFY').thickness=.1
    return roof


def roof_underside(width,length,cy,z,rise,x,y):
    stations=[(-.5,.77),(-.46,.97),(-.39,1),(.39,1),(.46,.97),(.5,.77)]
    along=max(-.5,min(.5,(y-cy)/length));scale=1
    for (a,sa),(c,sc) in zip(stations,stations[1:]):
        if a<=along<=c:scale=sa+(sc-sa)*(along-a)/(c-a);break
    return z+rise*(1-(x/(width*.5*scale))**2)-.075


def cab_header(name,profile,base,roof,material,reverse=False):
    for a,c in zip(profile,profile[1:]):
        for i in range(4):
            p=Vector(a).lerp(Vector(c),i/4);q=Vector(a).lerp(Vector(c),(i+1)/4)
            mesh_object(name,[(p.x,p.y,base),(q.x,q.y,base),(q.x,q.y,roof(q.x,q.y)),(p.x,p.y,roof(p.x,p.y))],[(3,2,1,0) if reverse else (0,1,2,3)],material)



def ferry():
    b.collection('Ferry')
    # Lofted sections make a rounded bilge, flared topsides and a rising bow.
    sections=[(-5.35,1.62,.13,1.20),(-4.8,2.04,-.06,1.20),(-2.8,2.25,-.22,1.20),
              (0,2.28,-.24,1.20),(2.35,2.07,-.12,1.20),(3.65,1.55,.07,1.35),(4.65,.78,.33,1.56),(5.4,.08,.66,1.72)]
    vertices=[]
    for y,width,keel,sheer in sections:
        chine=max(.39,keel+.12);shoulder=max(.86,chine+.2)
        profile=[(-width,sheer),(-width*.99,shoulder),(-width*.87,chine),(-width*.52,keel+.08),(0,keel),
                 (width*.52,keel+.08),(width*.87,chine),(width*.99,shoulder),(width,sheer)]
        vertices.extend((x,y,z) for x,z in profile)
    faces=[tuple(range(8,-1,-1))];mats=[0]
    for j in range(len(sections)-1):
        for i in range(9):
            a=j*9+i;c=j*9+(i+1)%9;faces.append((a,c,c+9,a+9));mats.append(2 if i==8 else 1 if i in [2,3,4,5] else 0)
    faces.append(tuple(range((len(sections)-1)*9,len(sections)*9)));mats.append(0)
    hull=mesh_object('Ferry sculpted displacement hull',vertices,[tuple(reversed(f)) for f in faces],'Deep teal',True)
    hull.data.materials.append(b.M['Gunmetal']);hull.data.materials.append(b.M['Wood'])
    for polygon,index in zip(hull.data.polygons,mats):polygon.material_index=index;polygon.use_smooth=index!=2
    # A broad rubbing strake follows both sides and wraps the stem.
    for side in [-1,1]:
        b.tube('Ferry rubber rubbing strake',[(side*w,y,sheer-.13) for y,w,k,sheer in sections],.10,'Gunmetal')
        b.tube('Ferry cream gunwale',[(side*w,y,sheer+.045) for y,w,k,sheer in sections],.072,'Pale ceramic')
        for yy in [-3.7,-1.5,.7]:
            beam=2.25 if yy> -3 else 2.17
            b.cylinder('Ferry hanging fender',(side*(beam+.07),yy,.78),.15,.7,'Gunmetal',16,rotation=(0,side*.12,0))
            b.tube('Ferry fender lashing',[(side*beam,yy,1.31),(side*(beam+.09),yy,1.05)],.025,'Copper')
    b.slab('Ferry cabin floor',(0,-.65),3.48,7.3,1.20,.10,'Wood',.4)
    # Empty cabin volume between a low sill and the curved roof; separate panes.
    for side in [-1,1]:
        xx=side*1.69
        b.box('Ferry cabin lower sill',(xx,-.65,1.57),(.13,6.92,.63),'Pale ceramic',.07)
        b.box('Ferry cabin top beam',(side*1.59,-.65,3.18),(.16,7,.14),'Pale ceramic',.055)
        for a,c in [(-4.06,-2.84),(-2.71,-1.46),(-1.33,-.08),(.05,1.3),(1.43,2.68)]:
            glass_panel('Ferry transparent side glazing',[(xx,a,1.93),(xx,c,1.93),(side*1.59,c,3.10),(side*1.59,a,3.10)])
        for yy in [-4.13,-2.78,-1.40,-.015,1.36,2.75]:
            b.tube('Ferry swept window pillar',[(xx,yy,1.25),(xx,yy,1.89),(side*1.59,yy,3.23)],.055,'Deep teal')
        b.box('Ferry passenger bench',(side*1.14,-1,1.72),(.55,4.5,.14),'Wood',.07)
        b.box('Ferry upholstered back',(side*1.41,-1,2.02),(.12,4.5,.56),'Deep teal',.065)
        for yy in [-2.6,.6]:b.box('Ferry bench pedestal',(side*1.14,yy,1.5),(.28,.3,.36),'Gunmetal',.03)
        b.room_panel('Ferry inner ceiling wash',(side*1.6,-.9,1.72),5.2,.39,'Honey interior',side=True)
    for sign in [-1,1]:
        yy=2.8 if sign>0 else -4.16
        if sign>0:
            profile=[(-1.69,yy),(-.95,yy+.25),(.95,yy+.25),(1.69,yy)]
            for a,c in zip(profile,profile[1:]):
                mesh_object('Ferry wheelhouse apron',[(*a,1.3),(*c,1.3),(*c,1.95),(*a,1.95)],[(3,2,1,0)],'Pale ceramic')
                glass_panel('Ferry wheelhouse windscreen',[(*a,1.99),(*c,1.99),(c[0]*.94,c[1]-.12,3.1),(a[0]*.94,a[1]-.12,3.1)])
            for xx in [-.96,.96]:b.tube('Ferry windscreen mullion',[(xx,yy+.25,1.95),(xx*.94,yy+.13,3.17)],.05,'Deep teal')
            upper_profile=[(x*.94,y-.12) for x,y in profile]
            cab_header('Ferry curved windscreen header',upper_profile,3.09,lambda x,y:roof_underside(3.9,7.9,-.6,3.23,.27,x,y),'Pale ceramic',True)
            b.box('Ferry navigation console',(0,2.25,1.93),(2.2,.55,.36),'Deep teal',.08)
            b.box('Ferry chart screen',(.35,2.23,2.13),(.55,.34,.04),'Cyan neon',.03)
            b.ring('Ferry helm wheel',(-.52,2.03,2.17),.22,.032,'Copper','y')
        else:
            for xx in [-1.24,1.24]:
                b.box('Ferry aft lower panel',(xx,yy,1.66),(.88,.13,.68),'Pale ceramic',.035)
                b.box('Ferry aft upper panel',(xx,yy,3.045),(.88,.13,.27),'Pale ceramic',.025)
                for dx in [-.38,.38]:b.box('Ferry aft window jamb',(xx+dx,yy,2.45),(.12,.13,.98),'Pale ceramic',.02)
                glass_panel('Ferry aft glazing',[(xx-.31,yy,2.02),(xx+.31,yy,2.02),(xx+.31,yy,2.89),(xx-.31,yy,2.89)])
            for xx in [-.63,.63]:b.box('Ferry entry jamb',(xx,yy,2.23),(.1,.2,1.98),'Deep teal',.03)
            glass_panel('Ferry rear glass door',[(-.55,yy,1.48),(.55,yy,1.48),(.55,yy,3.1),(-.55,yy,3.1)])
            b.tube('Ferry door pull',[(.39,yy-.05,2),(.39,yy-.05,2.42)],.035,'Copper')
            cab_header('Ferry aft curved header',[(-1.69,yy),(1.69,yy)],3.09,lambda x,y:roof_underside(3.9,7.9,-.6,3.23,.27,x,y),'Pale ceramic')
    arch_roof('Ferry rolled cabin roof',3.9,7.9,-.6,3.23,.27,'Pale ceramic')
    for xx in [-.68,.68]:b.box('Ferry overhead luminaire',(xx,-.7,3.16),(.14,4.9,.055),'Warm neon',.025)
    # Roof ventilators, a short signal mast and readable navigation lights.
    for yy in [-2.3,.3]:
        b.cylinder('Ferry mushroom vent',(0,yy,3.63),.17,.35,'Oxidized metal',20)
        b.slab('Ferry vent cap',(0,yy),.64,.64,3.77,.12,'Pale ceramic',.27)
    b.cylinder('Ferry signal mast',(0,1.15,4.12),.065,1.45,'Oxidized metal',16)
    b.tube('Ferry mast spreader',[(-.55,1.15,4.48),(.55,1.15,4.48)],.045,'Oxidized metal')
    b.cylinder('Ferry mast lantern',(0,1.15,4.89),.1,.16,'Warm neon',16)
    for xx,material in [(-1.8,'Signal red'),(1.8,'Cyan neon')]:b.box('Ferry navigation lamp',(xx,1.9,3.32),(.12,.22,.11),material,.035)
    for side in [-1,1]:
        points=[(side*1.75,-5,1.21),(side*2.04,-4.65,1.23)]
        b.railing([(x,y) for x,y,z in points],1.24,.72)
        for yy in [-4.7,3.7]:
            xx=side*(1.38 if yy>0 else 1.65)
            b.cylinder('Ferry mooring bollard',(xx,yy,1.43 if yy<0 else 1.57),.075,.3,'Gunmetal',12)
            b.tube('Ferry cleat crosspiece',[(xx-.17,yy,1.56 if yy<0 else 1.7),(xx+.17,yy,1.56 if yy<0 else 1.7)],.047,'Gunmetal')
    for side in [-1,1]:
        xx=side*1.78
        b.tube('Ferry lifebuoy',[(xx,-2.5+math.cos(i*math.tau/40)*.30,2.04+math.sin(i*math.tau/40)*.30) for i in range(40)],.08,'Terracotta',True)
        for yy in [-2.7,-2.3]:b.tube('Ferry lifebuoy mounting bracket',[(side*1.64,yy,1.85),(xx,yy,1.85)],.03,'Copper')
