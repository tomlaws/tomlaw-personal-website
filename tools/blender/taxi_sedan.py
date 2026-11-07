"""Comfort-inspired Hong Kong sedan, modelled in metres, front toward -Y.

The coachwork is a hollow, shaped shell with real wheel openings. Cabin panels,
glazing, lamps and bumpers follow the same surfaces rather than floating over a
solid car-shaped block. Reference photographs are recorded in asset-references.md.
"""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import build_city as b
from detailed_assets import mesh_object


def mesh(name, vertices, faces, material, smooth=False):
    obj=mesh_object(name,vertices,faces,material,smooth)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
    return obj


def bevel(obj, width=.018, segments=3):
    mod=obj.modifiers.new('Coachwork edge radii','BEVEL')
    mod.width=width;mod.segments=segments;mod.harden_normals=True
    obj.modifiers.new('Stable panel normals','WEIGHTED_NORMAL')
    return obj


def apply(obj, modifier):
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def subtract(obj, cutter):
    bpy.context.view_layer.update()
    mod=obj.modifiers.new('Functional opening','BOOLEAN')
    mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
    apply(obj,mod);bpy.data.objects.remove(cutter,do_unlink=True)


def pbr(name, colour, rough, metal, kind):
    mat=b.material(name,colour,rough,metal)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    n=256;y,x=np.mgrid[0:n,0:n]/n;rng=np.random.default_rng(sum(map(ord,name)))
    noise=rng.normal(0,1,(n,n))
    grain=noise*(.012 if kind=='rubber' else .004)
    if kind=='cloth':grain+=.014*(np.sin(x*math.tau*95)+np.sin(y*math.tau*95))
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='DetailUV'
    for label in ['colour','roughness','normal']:
        data=np.ones((n,n,4),np.float32)
        if label=='colour':data[:,:,:3]=np.array(b.rgb(colour))*(1+grain[:,:,None])
        elif label=='roughness':data[:,:,:3]=np.clip(rough+grain[:,:,None]*1.8,.1,.98)
        else:
            data[:,:,0]=.5+(np.roll(grain,1,1)-np.roll(grain,-1,1))*.4
            data[:,:,1]=.5+(np.roll(grain,1,0)-np.roll(grain,-1,0))*.4
        im=bpy.data.images.new(name+' / '+label,width=n,height=n)
        im.colorspace_settings.name='sRGB' if label=='colour' else 'Non-Color'
        im.pixels.foreach_set((b.encode_colour(data) if label=='colour' else data).ravel());im.pack()
        tex=nodes.new('ShaderNodeTexImage');tex.image=im;links.new(uv.outputs['UV'],tex.inputs['Vector'])
        if label=='normal':
            normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.14
            links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
        else:links.new(tex.outputs['Color'],p.inputs['Base Color' if label=='colour' else 'Roughness'])
    return mat


def palette():
    pbr('Taxi paint','#b72432',.25,.28,'paint')
    pbr('Taxi pearl silver','#c8d0cd',.31,.38,'paint')
    pbr('Taxi rubber','#20262a',.83,0,'rubber')
    pbr('Taxi upholstery','#444b4c',.93,0,'cloth')
    b.material('Taxi chrome','#aebcc0',.24,.85)
    b.material('Taxi smoked glass','#537581',.16,.12,alpha=.34)
    b.material('Taxi lamp lens','#d6e5de',.2,.15)
    b.material('Taxi warm filament','#fff0cb',.24,0,emit=2.8)
    b.material('Taxi amber lens','#de8d29',.25,.12,emit=.18)
    b.material('Taxi tail lens','#9e1625',.23,.15,emit=.7)
    b.material('Taxi rear plate','#eecb75',.53,0)


def coachwork():
    # Cross-sections taper in plan and roll from the belt line into the bonnet.
    stations=[(-2.26,.73,.835),(-2.19,.81,.88),(-1.98,.838,.936),
              (-1.70,.849,.955),(-1.17,.849,.987),(-.90,.846,.992),
              (.65,.846,.986),(1.43,.845,.979),(1.90,.839,.954),
              (2.20,.799,.898),(2.27,.738,.866)]
    verts=[]
    for y,w,z in stations:
        for x,h in [(-w*.91,.25),(-w,.39),(-w,.72),(-w*.986,z-.067),
                    (-w*.87,z),(-w*.49,z+.019),(0,z+.023),
                    (w*.49,z+.019),(w*.87,z),(w*.986,z-.067),
                    (w,.72),(w,.39),(w*.91,.25)]:verts.append((x,y,h))
    n=13;faces=[tuple(range(n-1,-1,-1)),tuple(range((len(stations)-1)*n,len(stations)*n))]
    faces += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i)
              for j in range(len(stations)-1) for i in range(n)]
    body=mesh('Taxi formed hollow coachwork',verts,faces,'Taxi paint',True)
    # Actual cabin cavity: the red body cannot fill the seats or glazing.
    cut=b.box('Cabin cavity tool',(0,.16,1.35),(1.49,2.47,1.44),'Taxi rubber',.05)
    for m in list(cut.modifiers):apply(cut,m)
    subtract(body,cut)
    for y in [-1.39,1.39]:
        cut=b.cylinder('Wheel opening tool',(0,y,.316),.36,2.2,'Taxi rubber',48,(0,math.pi/2,0))
        subtract(body,cut)
    bevel(body,.018)
    body['wheelbase']=2.78;body['bodyWidth']=1.698;body['hollowCabin']=True
    b.box('Taxi cabin floor',(0,.17,.638),(1.44,2.41,.048),'Taxi rubber',.014)
    # Fine panel gaps follow the metal itself, not thick decorative framing.
    for side in [-1,1]:
        x=side*.849
        for y in [-1.055,.13,1.37]:
            end=.73 if y>1 else .30
            b.tube('Taxi door reveal',[(x,y,.953),(x,y,.77),(x,y-.03,end)],.005,'Taxi rubber')
        b.tube('Taxi lower door reveal',[(x,-.98,.305),(x,.99,.305)],.005,'Taxi rubber')
        b.box('Taxi black side protection',(side*.854,.02,.51),(.021,2.15,.071),'Taxi rubber',.006)
        for y in [-.08,1.06]:
            b.box('Taxi inset handle pocket',(side*.849,y,.854),(.019,.205,.061),'Taxi rubber',.006)
            b.box('Taxi flush metal handle',(side*.862,y,.863),(.026,.165,.033),'Taxi chrome',.005)
        # Wheel lips have a restrained pressed-metal flare, not a separate ring.
        for y in [-1.39,1.39]:
            vertices=[]
            for radius,xoff in [(.36,0),(.383,.006),(.408,-.006)]:
                for a in np.linspace(0,math.pi,25):
                    vertices.append((side*(.845+xoff),y+radius*math.cos(a),.316+radius*math.sin(a)))
            faces=[(r*25+j,r*25+j+1,(r+1)*25+j+1,(r+1)*25+j) for r in range(2) for j in range(24)]
            mesh('Taxi pressed wheel arch lip',vertices,faces,'Taxi paint',True)
    # Bonnet shut lines and two shallow stamped creases define its length.
    for side in [-1,1]:
        b.tube('Taxi bonnet panel reveal',[(side*.69,-2.12,.921),(side*.712,-1.7,.971),(side*.70,-1.15,1.003)],.004,'Taxi rubber')
    b.tube('Taxi bonnet rear gap',[(-.70,-1.14,1.003),(0,-1.14,1.019),(.70,-1.14,1.003)],.005,'Taxi rubber')
    b.tube('Taxi boot shut line',[(-.67,1.52,1.002),(-.70,2.13,.928),(.70,2.13,.928),(.67,1.52,1.002)],.004,'Taxi rubber')


def surface_panel(name,points,material,thickness=.018):
    obj=mesh(name,points,[tuple(range(len(points)))],material)
    if thickness:
        mod=obj.modifiers.new('Pressed panel thickness','SOLIDIFY');mod.thickness=thickness;mod.offset=0
        bevel(obj,min(.01,thickness*.4),2)
    return obj


def side_x(z):
    return .800-(z-.982)*.276


def side_panel(name,side,yz,material,offset=0):
    return surface_panel(name,[(side*(side_x(z)+offset),y,z) for y,z in yz],material)


def pane(name,points):
    """Slightly convex safety glass, with one surface to avoid blend layering."""
    a,bp,c,d=[Vector(p) for p in points];vertices=[];nx,ny=12,6
    normal=(bp-a).cross(d-a).normalized()
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx
            p=a.lerp(bp,u).lerp(d.lerp(c,u),v)
            p+=normal*(.014*math.sin(u*math.pi)*math.sin(v*math.pi))
            vertices.append(p)
    faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
    obj=mesh_object(name,vertices,faces,'Taxi smoked glass',True)
    b.tube(name+' bonded seal',points,.012,'Taxi rubber',True)
    return obj


def cabin():
    # Broad, connected A/B/C pillars provide the Comfort's recognisable cabin.
    for side in [-1,1]:
        for label,yz in [
            ('A pillar',[(-1.19,.965),(-1.055,.995),(-.57,1.448),(-.65,1.49)]),
            ('B pillar',[(.01,.977),(.105,.977),(.105,1.491),(.01,1.491)]),
            ('C pillar',[(1.245,.974),(1.53,.965),(.96,1.473),(.815,1.492)]),
            ('roof side rail',[(-.65,1.49),(-.565,1.443),(.823,1.45),(.96,1.473),(.89,1.52),(-.59,1.514)])
        ]:side_panel('Taxi silver '+label,side,yz,'Taxi pearl silver')
        for label,yz in [
            ('front',[(-1.05,.997),(.007,.997),(.007,1.447),(-.569,1.439)]),
            ('rear',[(.11,.997),(1.24,.99),(.813,1.448),(.11,1.447)])
        ]:
            pts=[(side*side_x(z),y,z) for y,z in yz]
            if side<0:pts.reverse()
            pane('Taxi clear door glazing '+label,pts)
        # Quarter-light divider follows the rear glass rake.
        b.tube('Taxi rear quarter light seal',[(side*side_x(.993),1.018,.993),(side*side_x(1.447),.735,1.447)],.013,'Taxi rubber')
        b.tube('Taxi silver belt moulding',[(side*.807,-1.12,.988),(side*.807,1.43,.988)],.013,'Taxi chrome')
        b.tube('Taxi roof rain gutter',[(side*.677,-.59,1.495),(side*.664,.81,1.513)],.012,'Taxi chrome')
        b.box('Taxi mirror pedestal',(side*.83,-.945,1.016),(.13,.125,.064),'Taxi rubber',.018)
        mirror=b.box('Taxi faired door mirror',(side*.934,-.947,1.06),(.202,.21,.13),'Taxi pearl silver',.034)
        b.box('Taxi mirror reflective insert',(side*.934,-.836,1.061),(.147,.009,.076),'Taxi chrome',0)
    pane('Taxi raked windscreen',[(-.77,-1.171,.997),(.77,-1.171,.997),(.651,-.636,1.475),(-.651,-.636,1.475)])
    pane('Taxi rear windscreen',[(.77,1.503,.996),(-.77,1.503,.996),(-.656,.946,1.471),(.656,.946,1.471)])
    # A continuous compound-curved roof, including front/rear headers.
    stations=[(-.665,.65,1.466),(-.615,.68,1.488),(-.48,.685,1.512),
              (.65,.68,1.52),(.885,.677,1.49),(.963,.655,1.462)]
    vertices=[]
    for y,w,z in stations:
        for u in np.linspace(-1,1,17):vertices.append((w*u,y,z+.041*(1-u*u)))
    faces=[(j*17+i,j*17+i+1,(j+1)*17+i+1,(j+1)*17+i) for j in range(len(stations)-1) for i in range(16)]
    roof=mesh('Taxi compound curved silver roof',vertices,faces,'Taxi pearl silver',True)
    roof.modifiers.new('Roof steel and headliner','SOLIDIFY').thickness=.025
    # Dimensional, empty upholstered interior visible through every window.
    for x in [-.36,.36]:
        b.box('Taxi shaped front cushion',(x,-.32,.718),(.58,.57,.13),'Taxi upholstery',.075)
        b.box('Taxi shaped front backrest',(x,-.052,.975),(.575,.14,.51),'Taxi upholstery',.057,rot=(.13,0,0))
        b.box('Taxi padded head restraint',(x,-.025,1.248),(.30,.13,.19),'Taxi upholstery',.049)
    b.box('Taxi rear bench cushion',(0,.87,.721),(1.37,.52,.13),'Taxi upholstery',.067)
    b.box('Taxi rear bench backrest',(0,1.112,.962),(1.37,.135,.47),'Taxi upholstery',.041,rot=(.12,0,0))
    for x in [-.41,.41]:b.box('Taxi rear head restraint',(x,1.12,1.216),(.27,.13,.18),'Taxi upholstery',.038)
    for side in [-1,1]:b.box('Taxi interior door trim',(side*.753,.18,.78),(.033,2.23,.23),'Taxi upholstery',.01)
    b.box('Taxi curved dashboard',(0,-.931,.997),(1.44,.33,.135),'Taxi rubber',.045)
    b.box('Taxi instrument binnacle',(.36,-.75,1.037),(.42,.18,.13),'Taxi rubber',.028)
    wheel=b.ring('Taxi steering wheel',(.36,-.628,1.07),.145,.021,'Taxi rubber','y')
    for a in [0,2.1,4.2]:b.tube('Taxi steering spoke',[(.36,-.628,1.07),(.36+.13*math.cos(a),-.628,1.07+.13*math.sin(a))],.014,'Taxi rubber')
    b.box('Taxi dashboard meter',(-.13,-.776,1.103),(.21,.1,.08),'Taxi rubber',.015)
    for x in [-.38,.26]:b.tube('Taxi fitted windscreen wiper',[(x,-1.155,1.024),(x+.23,-1.037,1.134)],.011,'Taxi rubber')
    # Small trapezoidal roof light, seated on the crowned roof.
    vertices=[(-.265,-.26,1.565),(.265,-.26,1.565),(.225,-.235,1.727),(-.225,-.235,1.727),
              (-.265,-.06,1.565),(.265,-.06,1.565),(.225,-.085,1.727),(-.225,-.085,1.727)]
    bevel(mesh('Taxi illuminated roof sign',vertices,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)],'Taxi lamp lens'),.014)
    text=b.text('Taxi roof lettering','TAXI',(0,-.266,1.611),.106,'Taxi paint')
    text.data.extrude=.001;text.data.bevel_depth=.0005


def wheel_mesh(side,y):
    # Revolved rounded sidewall and tread; tyres fit entirely inside the arches.
    profile=[(-.095,.18),(-.108,.235),(-.101,.281),(-.074,.311),
             (-.047,.319),(.050,.319),(.083,.303),(.101,.267),(.103,.19)]
    n=40;vertices=[]
    for offset,radius in profile:
        for a in np.linspace(0,math.tau,n,endpoint=False):vertices.append((side*(.746+offset),y+radius*math.cos(a),.32+radius*math.sin(a)))
    faces=[(r*n+j,r*n+(j+1)%n,(r+1)*n+(j+1)%n,(r+1)*n+j) for r in range(len(profile)-1) for j in range(n)]
    tire=mesh('Taxi rounded touring tyre',vertices,faces,'Taxi rubber',True)
    tire['wheelCenter']=[side*.746,y,.32];tire['radius']=.319
    # Sculpted hubcap with recessed ventilation openings, not exposed wagon spokes.
    cap=b.cylinder('Taxi dished silver wheel cover',(side*.848,y,.32),.203,.022,'Taxi pearl silver',40,(0,math.pi/2,0))
    bevel(cap,.012,3)
    for a in np.linspace(0,math.tau,6,endpoint=False):
        yc=y+.137*math.cos(a);zc=.32+.137*math.sin(a)
        vent=b.box('Taxi recessed wheel vent',(side*.863,yc,zc),(.008,.053,.085),'Taxi rubber',0)
        vent.rotation_euler.x=a-math.pi/2
    b.cylinder('Taxi wheel cover centre',(side*.866,y,.32),.09,.014,'Taxi pearl silver',32,(0,math.pi/2,0))
    b.cylinder('Taxi hub emblem',(side*.876,y,.32),.025,.009,'Taxi chrome',16,(0,math.pi/2,0))
    # Two unobtrusive circumferential tread grooves define rubber, not shiny metal.
    for off in [-.036,.033]:
        points=[(side*(.746+off),y+.320*math.cos(a),.32+.320*math.sin(a)) for a in np.linspace(0,math.tau,41)]
        b.tube('Taxi tyre tread seam',points,.003,'Taxi rubber',True)


def bumpers_and_lamps():
    for end in [-1,1]:
        # Wraparound swept bumper follows the narrower nose and boot corners.
        outline=[(-.842,end*1.98),(-.834,end*2.22),(-.739,end*2.329),
                 (.739,end*2.329),(.834,end*2.22),(.842,end*1.98),
                 (.81,end*1.98),(.79,end*2.185),(.706,end*2.273),
                 (-.706,end*2.273),(-.79,end*2.185),(-.81,end*1.98)]
        bumper=b.poly('Taxi moulded wraparound bumper',outline,.342,.207,'Taxi rubber',.022)
        # White front and ochre rear plates are recessed into their bumper pads.
        b.box('Taxi registration recess',(0,end*2.328,.438),(.46,.022,.169),'Taxi rubber',0)
        b.box('Taxi registration plate',(0,end*2.342,.446),(.39,.012,.123),'Taxi lamp lens' if end<0 else 'Taxi rear plate',0)
        label=b.text('Taxi registration characters','HK 28',(0,end*2.351,.412),.071,'Taxi rubber',rotation=(math.pi/2,0,0 if end<0 else math.pi))
        label.data.extrude=.0005;label.data.bevel_depth=0
    b.box('Taxi grille shadow',(0,-2.267,.721),(.724,.025,.232),'Taxi rubber',0)
    b.tube('Taxi grille surround',[(-.37,-2.285,.61),(.37,-2.285,.61),(.37,-2.285,.835),(-.37,-2.285,.835)],.012,'Taxi chrome',True)
    for z in [.65,.70,.75,.80]:b.box('Taxi grille horizontal blade',(0,-2.283,z),(.69,.018,.014),'Taxi chrome',0)
    for x in [-.2,0,.2]:b.box('Taxi grille upright',(x,-2.281,.717),(.012,.014,.18),'Taxi chrome',0)
    for side in [-1,1]:
        # Formed lenses occupy the chamfered face, with contrasting amber corners.
        pts=[(side*.40,-2.283,.607),(side*.769,-2.254,.61),(side*.775,-2.252,.826),(side*.40,-2.283,.84)]
        surface_panel('Taxi headlamp rubber reveal',pts,'Taxi rubber',.032)
        center=sum((Vector(p) for p in pts),Vector())/4
        lens=[tuple(center+(Vector(p)-center)*.88+Vector((0,-.018,0))) for p in pts]
        surface_panel('Taxi moulded headlamp lens',lens,'Taxi lamp lens',.013)
        core=[tuple(center+(Vector(p)-center)*.64+Vector((0,-.027,0))) for p in pts]
        surface_panel('Taxi warm headlamp reflector',core,'Taxi warm filament',0)
        for offset in [-.07,0,.07]:
            x=side*(.584+offset);y=-2.283+(abs(x)-.4)*.078
            b.tube('Taxi headlamp lens fluting',[(x,y-.029,.647),(x,y-.029,.797)],.0035,'Taxi lamp lens')
        surface_panel('Taxi front amber indicator',[(side*.781,-2.261,.618),(side*.817,-2.225,.625),(side*.817,-2.225,.795),(side*.783,-2.259,.81)],'Taxi amber lens',.015)
        rear=[(side*.53,2.289,.584),(side*.783,2.253,.587),(side*.791,2.249,.857),(side*.53,2.288,.87)]
        surface_panel('Taxi rear lamp bonded surround',rear,'Taxi rubber',.029)
        centre=sum((Vector(p) for p in rear),Vector())/4
        red=[tuple(centre+(Vector(p)-centre)*.91+Vector((0,.015,0))) for p in rear]
        surface_panel('Taxi rear wraparound lamp',red,'Taxi tail lens',.011)
        surface_panel('Taxi rear indicator section',[(side*.543,2.308,.787),(side*.776,2.274,.784),(side*.783,2.271,.846),(side*.543,2.306,.858)],'Taxi amber lens',.008)
        surface_panel('Taxi reversing lamp',[(side*.543,2.311,.719),(side*.639,2.297,.719),(side*.639,2.297,.76),(side*.543,2.311,.76)],'Taxi lamp lens',.006)
    b.tube('Taxi rear boot chrome',[(-.52,2.292,.804),(.52,2.292,.804)],.012,'Taxi chrome')


def build():
    b.collection('Taxi');palette();coachwork();cabin()
    for side in [-1,1]:
        for y in [-1.39,1.39]:wheel_mesh(side,y)
    bumpers_and_lamps()
