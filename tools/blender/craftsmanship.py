"""Reference-led street objects, authored as editable Blender meshes in metres.

See reference/asset-references.md for the photographs and construction details.
"""
import math, random
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import build_city as b
from detailed_assets import mesh_object, glass_panel, arch_roof


def soften(obj,width=.025,segments=3):
    mod=obj.modifiers.new('Worked edges','BEVEL');mod.width=width;mod.segments=segments;mod.harden_normals=True
    obj.modifiers.new('Face weighted normals','WEIGHTED_NORMAL')
    return obj


def opening_profile(center,bottom,width,height,radius=.12):
    """Rounded-rectangle section shared by real apertures and their linings."""
    return b.rounded(center,bottom+height/2,width,height,radius,8)


def opening_frame(name,outer,inner,a,c,axis,material):
    """One closed hollow moulding, fitted to an actual opening."""
    n=len(outer);vertices=[];faces=[]
    others=[i for i in range(3) if i!=axis]
    for depth in [a,c]:
        for loop in [outer,inner]:
            for u,v in loop:
                p=[0,0,0];p[axis]=depth;p[others[0]]=u;p[others[1]]=v;vertices.append(p)
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                      (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    obj=mesh_object(name,vertices,faces,material)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    soften(obj,.025,3)
    return obj


def profile_beam(name,profile,a,c,axis,mat):
    others=[i for i in range(3) if i!=axis];vertices=[]
    for along in [a,c]:
        for u,v in profile:
            p=[0,0,0];p[axis]=along;p[others[0]]=u;p[others[1]]=v;vertices.append(p)
    n=len(profile);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    obj=mesh_object(name,vertices,faces,mat)
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj


def textures():
    """Directional grain, woven cloth, fired clay, brushed steel and paint maps."""
    n=256;y,x=np.mgrid[0:n,0:n]/n
    for name,color,rough,metal,kind in [
        ('Wood','#a48158',.66,0,'wood'),('Weathered timber','#827565',.81,0,'wood'),
        ('Roof ceramic','#69777a',.64,.02,'clay'),('Canvas fabric','#326967',.88,0,'cloth'),
        ('Aluminium','#a4b1b4',.36,.65,'metal'),('Taxi paint','#b9364d',.27,.25,'paint'),
        ('Burgundy enamel','#713f50',.34,.18,'paint'),
        ('Rail slate','#657e92',.40,.08,'paint'),
        ('Rail cream','#eee2c9',.43,.06,'paint'),
        ('Rail graphite','#34383e',.64,.03,'paint'),
        ('Mint enamel','#82c7a7',.43,.06,'paint'),
        ('Bark','#75614b',.93,0,'bark')]:
        mat=b.material(name,color,rough,metal);rng=np.random.default_rng(sum(map(ord,name)))
        noise=rng.normal(0,1,(n,n));waves=np.sin(x*math.tau*2)*.045+np.sin(x*math.tau*5)*.018
        if kind=='bark':grain=np.sin((x+.025*np.sin(y*math.tau*3))*math.tau*28)*.18+noise*.035+np.sin(x*math.tau*9)*.12
        elif kind=='wood':
            grain=np.sin((y+waves)*math.tau*58)*.05+np.sin((y+waves*.4)*math.tau*17)*.045
            grain+=np.sin(y*math.tau*4+x*.8)*.09+noise*.017
            pores=np.maximum(0,np.sin((y+waves)*math.tau*104))**18
            grain-=pores*.075
        elif kind=='cloth':grain=.025*np.sin(x*math.tau*115)+.025*np.sin(y*math.tau*111)+noise*.012
        elif kind=='clay':grain=.12*np.sin(x*math.tau*3)*np.sin(y*math.tau*2)+noise*.05
        elif kind=='metal':grain=noise*.017+np.sin(y*math.tau*102)*.016
        else:grain=noise*.009+np.sin(x*math.tau)*np.cos(y*math.tau)*.014
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
        uv=nodes.new('ShaderNodeUVMap');uv.uv_map='DetailUV'
        def image(label,data,col=False):
            pixels=np.ones((n,n,4),np.float32);pixels[:,:,:3]=data[:,:,None] if data.ndim==2 else data
            im=bpy.data.images.new(name+' / '+label,width=n,height=n);im.colorspace_settings.name='sRGB' if col else 'Non-Color'
            im.pixels.foreach_set((b.encode_colour(pixels) if col else pixels).astype(np.float32).ravel());im.pack()
            tex=nodes.new('ShaderNodeTexImage');tex.image=im;links.new(uv.outputs['UV'],tex.inputs['Vector']);return tex
        albedo=image('colour',np.clip(np.array(b.rgb(color))*(1+grain[:,:,None]),0,1),True)
        links.new(albedo.outputs['Color'],p.inputs['Base Color'])
        r=image('roughness',np.clip(rough+grain*.5,.18,.96));links.new(r.outputs['Color'],p.inputs['Roughness'])
        normal=np.ones((n,n,3),np.float32);normal[:,:,0]=.5+(np.roll(grain,1,1)-np.roll(grain,-1,1))*.6
        normal[:,:,1]=.5+(np.roll(grain,1,0)-np.roll(grain,-1,0))*.6
        tex=image('grain normal',normal);nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35 if kind!='paint' else .08
        links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])


def lit_lining(name,vertices,mat,levels=None):
    obj=b.glow_surface(name,vertices,mat)
    if levels:
        for i,v in enumerate(levels):obj.data.uv_layers['RoomUV'].data[i].uv=(.2 if i%3==0 else .8,v)
    obj['interiorBounce']=True
    return obj


def room_lining(name,x,front,back,z,w,h,mat,side=False):
    """Warm bounce on every visible room surface, including the ceiling soffit."""
    a=x-w/2+.065;c=x+w/2-.065;lo=z-h/2+.065;hi=z+h/2-.065
    planes=[('ceiling',[(a,front,hi),(a,back,hi),(c,back,hi),(c,front,hi)],[.7,.94,.94,.7]),
            ('floor',[(a,front,lo),(c,front,lo),(c,back,lo),(a,back,lo)],[.08,.08,.2,.2]),
            ('left',[(a,front,lo),(a,back,lo),(a,back,hi),(a,front,hi)],[.12,.2,.95,.65]),
            ('right',[(c,back,lo),(c,front,lo),(c,front,hi),(c,back,hi)],[.2,.12,.65,.95])]
    for label,verts,levels in planes:
        if side:verts=[(-py,px,pz) for px,py,pz in verts]
        lit_lining(name+' '+label,verts,mat,levels)


def taxi():
    import taxi_sedan
    taxi_sedan.build()


def lift_cabin():
    b.collection('Lift')
    b.slab('Lift car floor',(0,0),1.75,1.75,0,.14,'Aluminium',.08)
    b.slab('Lift patterned floor',(0,0),1.58,1.58,.141,.024,'Jade tile',.06)
    b.slab('Lift car ceiling',(0,0),1.75,1.75,2.4,.14,'Aluminium',.08)
    for xx in [-.82,.82]:
        for yy in [-.82,.82]:b.box('Lift cabin extruded corner',(xx,yy,1.27),(.075,.075,2.26),'Aluminium',.014)
        glass_panel('Lift cabin panoramic side',[(xx,-.77,.3),(xx,.77,.3),(xx,.77,2.32),(xx,-.77,2.32)])
        for zz in [.28,2.32]:b.box('Lift cabin glass rebate',(xx,0,zz),(.08,1.68,.065),'Aluminium',.012)
        b.tube('Lift interior handrail',[(xx*.91,-.65,1.18),(xx*.87,-.58,1.18),(xx*.87,.63,1.18)],.036,'Aluminium')
    glass_panel('Lift cabin clear rear',[(-.77,.82,.3),(.77,.82,.3),(.77,.82,2.32),(-.77,.82,2.32)])
    for xx in [-.4,.4]:
        glass_panel('Lift sliding glass door',[(xx-.36,-.83,.27),(xx+.36,-.83,.27),(xx+.36,-.83,2.26),(xx-.36,-.83,2.26)])
        b.box('Lift sliding door meeting rail',(xx+(.365 if xx<0 else -.365),-.844,1.27),(.043,.035,2.09),'Aluminium',.012)
    for zz in [.19,2.31]:b.box('Lift door guide track',(0,-.84,zz),(1.7,.085,.075),'Gunmetal',.012)
    b.box('Lift brushed control panel',(.72,-.47,1.36),(.08,.20,.53),'Aluminium',.03)
    for zz in [1.27,1.39,1.51]:b.cylinder('Lift call button',(.773,-.47,zz),.026,.009,'Warm neon',12,(0,math.pi/2,0))
    for xx in [-.5,.5]:b.box('Lift recessed ceiling strip',(xx,0,2.385),(.12,1.2,.025),'Warm neon',.01)
    lit_lining('Lift illuminated ceiling',[(-.73,-.7,2.379),(-.73,.7,2.379),(.73,.7,2.379),(.73,-.7,2.379)],'Honey interior',[.75]*4)


def lift_shaft():
    """Weather-tight lift tower with protected guides and west-facing landings."""
    cx,cy=20,8.2
    # A shallow pit leaves room for the moving floor below the footway datum.
    for xx in [cx-1,cx+1]:b.box('Lift ground landing side',(xx,cy,.725),(.18,2.18,.15),'Paving stone',.02)
    for yy in [cy-1,cy+1]:b.box('Lift ground landing end',(cx,yy,.725),(1.82,.18,.15),'Paving stone',.02)
    # Frame carries continuous weather-sealed infill on all four elevations.
    for xx in [19.04,20.96]:
        for yy in [cy-.96,cy+.96]:
            b.box('Lift shaft mullion',(xx,yy,4.21),(.145,.145,6.82),'Copper',.025)
            b.box('Lift shaft baseplate',(xx,yy,.815),(.27,.27,.03),'Aluminium',.008)
            for dx,dy in [(-.09,-.09),(.09,.09)]:b.cylinder('Lift anchor bolt',(xx+dx,yy+dy,.842),.023,.025,'Gunmetal',6)
    for zz in [.91,3.24,4.7,7.09,7.65]:
        for yy in [cy-.96,cy+.96]:b.box('Lift sealed facade transom',(cx,yy,zz),(1.92,.14,.14),'Copper',.02)
        for xx in [19.04,20.96]:b.box('Lift sealed side transom',(xx,cy,zz),(.14,1.92,.14),'Copper',.02)
    # The rear wall protects rails, cabling and counterweight from weather.
    b.box('Lift enclosed machinery back',(cx,cy+.99,4.25),(1.78,.10,6.65),'Copper',.025)
    for zz in [2,4.1,6.2]:
        b.box('Lift rear service panel',(cx,cy+1.047,zz),(1.53,.024,1.83),'Gunmetal',.045)
        for xx in [cx-.66,cx+.66]:b.cylinder('Lift service cover fastener',(xx,cy+1.068,zz+.77),.023,.015,'Aluminium',8,(math.pi/2,0,0))
    for xx in [19.20,20.80]:
        b.box('Lift protected guide rail',(xx,cy+.912,4.22),(.06,.035,6.5),'Aluminium',.006)
        for zz in [1.3,3.2,5.2,7.0]:b.box('Lift protected rail bracket',(xx,cy+.937,zz),(.22,.03,.09),'Gunmetal',.008)
    def pane(name,points):
        obj=glass_panel(name,points);obj.data.materials.clear();obj.data.materials.append(b.M['Lift solar glass']);return obj
    # Both visible external sides are enclosed, including the previously open front.
    for za,zb in [(.98,3.17),(3.31,4.63),(4.77,7.02),(7.16,7.57)]:
        pane('Lift front sealed glass',[(19.12,cy-.984,za),(20.88,cy-.984,za),(20.88,cy-.984,zb),(19.12,cy-.984,zb)])
        pane('Lift east sealed glass',[(20.984,cy-.88,za),(20.984,cy+.88,za),(20.984,cy+.88,zb),(20.984,cy-.88,zb)])
    # West doors are centred on the terrace; each sill overlaps the walking surface.
    for level in [.8,4.7]:
        b.box('Lift landing threshold',(19.015,cy,level-.035),(.21,1.65,.07),'Aluminium',.012)
        for yy in [cy-.80,cy+.80]:b.box('Lift landing door jamb',(19.015,yy,level+1.13),(.12,.10,2.26),'Aluminium',.018)
        b.box('Lift landing lintel',(19.015,cy,level+2.31),(.14,1.72,.22),'Copper',.025)
        for offset in [-.37,.37]:
            pane('Lift enclosed landing door',[(19.004,cy+offset-.35,level+.055),(19.004,cy+offset+.35,level+.055),(19.004,cy+offset+.35,level+2.20),(19.004,cy+offset-.35,level+2.20)])
        b.box('Lift landing door seal',(18.994,cy,level+1.12),(.04,.043,2.16),'Gunmetal',.008)
        b.box('Lift landing controls',(18.954,cy-.87,level+1.02),(.08,.13,.3),'Aluminium',.024)
        b.cylinder('Lift landing call button',(18.91,cy-.87,level+1.05),.025,.012,'Warm neon',12,(0,math.pi/2,0))
    for za,zb in [(3.22,4.7),(7.12,7.65)]:b.box('Lift west sealed spandrel',(19.015,cy,(za+zb)/2),(.13,1.77,zb-za),'Copper',.02)
    b.slab('Lift weather cap',(cx,cy),2.25,2.25,7.65,.22,'Copper',.15)
    b.box('Lift drive enclosure',(cx,cy,7.97),(1.65,1.72,.40),'Gunmetal',.065)
    for yy in [cy-.5,cy-.25,cy,cy+.25,cy+.5]:b.box('Lift protected machinery vent',(20.84,yy,7.97),(.02,.12,.18),'Copper',.01)
    # Structural ties connect the shaft to the supported terrace edge.
    for yy in [cy-.89,cy+.89]:
        b.box('Lift terrace steel tie',(18.89,yy,4.51),(.43,.19,.15),'Gunmetal',.02)
        b.box('Lift terrace tie plate',(18.66,yy,4.51),(.05,.28,.27),'Aluminium',.015)


def bench(x,y,z,width=2.4,yaw=0):
    before=set(b.GROUP.objects)
    # Rounded slats follow an ergonomic section; iron frames carry the load.
    for yy,zz,tilt in [(-.27,.47,-.12),(-.12,.49,-.035),(.03,.49,.025),(.18,.48,.12),(.30,.58,-.20),(.34,.74,-.20),(.38,.90,-.20),(.42,1.06,-.20)]:
        b.box('Bench profiled timber slat',(0,yy,zz),(width,.125,.065),'Wood',.023,rot=(tilt,0,0))
    supports=[-width/2+.22,width/2-.22]+([0] if width>3 else [])
    for xx in supports:
        b.tube('Bench cast iron side frame',[(xx,-.26,.08),(xx,-.22,.39),(xx,-.16,.435),(xx,.25,.435),(xx,.32,.69),(xx,.4,1.04)],.043,'Gunmetal')
        b.tube('Bench rear foot',[(xx,.2,.42),(xx,.30,.055)],.055,'Gunmetal')
        for yy in [-.26,.30]:
            b.slab('Bench anchored shoe',(xx,yy),.23,.23,.012,.06,'Gunmetal',.05)
            for dx in [-.07,.07]:b.cylinder('Bench foot screw',(xx+dx,yy,.08),.018,.016,'Aluminium',8)
        b.tube('Bench curved armrest',[(xx,-.24,.47),(xx,-.28,.69),(xx,-.21,.75),(xx,.24,.75),(xx,.33,.71)],.043,'Gunmetal')
        for yy in [-.27,.18,.38]:b.cylinder('Bench slat bolt',(xx,yy,.53 if yy<.3 else .96),.018,.014,'Aluminium',8)
    b.tube('Bench underseat stretcher',[(-width/2+.22,.05,.31),(width/2-.22,.05,.31)],.036,'Gunmetal')
    for obj in set(b.GROUP.objects)-before:
        px,py=obj.location.x,obj.location.y
        obj.location=(x+px*math.cos(yaw)-py*math.sin(yaw),y+px*math.sin(yaw)+py*math.cos(yaw),obj.location.z+z)
        obj.rotation_euler.z+=yaw


def shop_canopy():
    x=-12;y=1.1;z=4.33;width=11.7;projection=1.75
    verts=[];faces=[];nx=48;ny=8
    for j in range(ny+1):
        t=j/ny
        for i in range(nx+1):
            u=i/nx;verts.append((x+(u-.5)*width,y-t*projection,z-.43*t-.07*math.sin(math.pi*t)+.014*math.sin(u*math.pi*12)))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+nx+1,a+nx+2,a+1))
    cloth=mesh_object('Tensioned woven shop canopy',verts,faces,'Canvas fabric',True);cloth.modifiers.new('Canvas thickness','SOLIDIFY').thickness=.018
    front=y-projection;top=z-.43
    verts=[]
    for i in range(nx+1):
        u=i/nx;xx=x+(u-.5)*width;verts.extend([(xx,front,top),(xx,front,top-.15-.075*(.5-.5*math.cos(u*math.pi*24)))])
    obj=mesh_object('Scalloped stitched canopy valance',verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(nx)],'Canvas fabric',True);obj.modifiers.new('Valance thickness','SOLIDIFY').thickness=.014
    for yy,zz,r in [(y,z,.09),(front,top,.055)]:b.cylinder('Awning roll and front rail',(x,yy,zz),r,width+.1,'Oxidized metal',16,(0,math.pi/2,0))
    for xx in [x-width*.36,x+width*.36]:
        b.box('Awning wall mounting plate',(xx,y+.06,z-.20),(.23,.08,.47),'Gunmetal',.025)
        b.tube('Awning articulated support',[(xx,y,z-.29),(xx+.35,y-.7,z-.42),(xx,front,top-.025)],.047,'Aluminium')
        for px,py,pz in [(xx,y,z-.29),(xx+.35,y-.7,z-.42)]:b.cylinder('Awning hinge',(px,py,pz),.082,.10,'Gunmetal',16,(math.pi/2,0,0))


def pier():
    # Supported timber construction, with scarfed board joints and visible fixings.
    for xx in [-10.6,-7.5,-4.4]:
        b.box('Pier longitudinal bearer',(xx,-25.8,-.35),(.25,9.5,.39),'Weathered timber',.035)
    for yy in [-29.6,-27.2,-24.8,-22.0]:b.box('Pier cross bearer',(-7.5,yy,-.22),(7.5,.22,.13),'Weathered timber',.023)
    for xx in [-10.6,-4.4]:
        for yy in [-29,-25]:
            b.cylinder('Pier pile',(xx,yy,-1.3225),.25,2.355,'Weathered timber',16)
            b.cylinder('Marine pile iron collar',(xx,yy,-.36),.263,.18,'Gunmetal',16)
            b.box('Pier bolted connection',(xx,yy-.26,-.27),(.33,.045,.36),'Oxidized metal',.016)
    for i in range(29):
        yy=-30.3+i*.31
        for a,c in ([(-11.2,-7.5),(-7.49,-3.8)] if i%2 else [(-11.2,-8.55),(-8.54,-3.8)]):
            b.box('Pier weathered deck board',((a+c)/2,yy,-.09),(c-a,.29,.13),'Weathered timber',.012)
        for xx in [-10.6,-7.5,-4.4]:
            for dy in [-.085,.085]:b.cylinder('Pier countersunk deck fixing',(xx,yy+dy,-.022),.020,.008,'Gunmetal',8)
    for xx in [-11.22,-3.78]:b.box('Pier edge fascia',(xx,-25.8,-.21),(.14,9.4,.33),'Weathered timber',.025)
    b.box('Pier seaward fascia',(-7.5,-30.5,-.21),(7.6,.14,.33),'Weathered timber',.025)
    dock=-.025;rise=(.8-dock)/6
    for i in range(5):
        top=dock+(i+1)*rise;yy=-24.25+i*.5
        # Five closed stone treads retain equal rises, with a worked bullnose.
        profile=[(yy-.25,dock),(yy+.25,dock),(yy+.25,top),(yy-.205,top),(yy-.24,top-.025),(yy-.25,top-.055)]
        soften(profile_beam('Ferry exposed stair tread',profile,-9.5,-5.5,0,'Paving stone'),.006,2)
        for offset in [.10,.18]:b.box('Pier stair recessed grip',(-7.5,yy-.25+offset,top-.001),(3.72,.018,.008),'Gunmetal',0)
    for xx in [-9.52,-5.48]:
        b.tube('Ferry stair handrail',[(xx,-24.52,.84),(xx,-24.5,.90),(xx,-22,1.70),(xx,-21.6,1.70)],.055,'Oxidized metal')
        for yy,zz in [(-24.35,.1125),(-23.25,.3875),(-22,.8)]:
            top=.9+(yy+24.5)/2.5*.8
            b.tube('Ferry stair rail post',[(xx,yy,zz),(xx,yy,top)],.045,'Oxidized metal')
            b.slab('Pier handrail foot',(xx,yy),.19,.19,zz,.03,'Aluminium',.06)
    b.railing([(-11,-30),(-11,-24.5)],0,.9);b.railing([(-4,-30),(-4,-24.5)],0,.9)
    for xx in [-10.6,-4.4]:
        b.slab('Pier cleat base',(xx,-28.6),.43,.27,-.025,.055,'Gunmetal',.09)
        b.cylinder('Pier cleat neck',(xx,-28.6,.095),.075,.20,'Gunmetal',16)
        b.tube('Pier horn cleat',[(xx-.27,-28.6,.18),(xx-.13,-28.6,.14),(xx+.13,-28.6,.14),(xx+.27,-28.6,.18)],.05,'Gunmetal')


def vending(x,y):
    # Open display cabinet; no opaque block behind/through the merchandise.
    b.box('Vending rear shell',(x,y+.45,2.325),(1.72,.14,2.85),'Dusty plaster',.12)
    for xx in [x-.78,x+.78]:b.box('Vending folded side shell',(xx,y,2.325),(.16,.90,2.85),'Dusty plaster',.08)
    for zz,hh in [(1.19,.58),(3.60,.30)]:b.box('Vending cabinet cap',(x,y,zz),(1.72,.94,hh),'Dusty plaster',.07)
    b.box('Vending payment column',(x+.57,y-.43,2.47),(.35,.15,1.99),'Deep teal',.06)
    b.room_panel('Vending softly lit rear',(x-.15,y+.365,2.50),1.12,1.86,'Apricot interior')
    room_lining('Vending interior bounce',x-.15,y-.48,y+.36,2.5,1.12,1.86,'Apricot interior')
    for zz in [1.70,2.23,2.76]:
        b.box('Vending folded shelf',(x-.15,y-.05,zz),(1.06,.78,.045),'Aluminium',.01)
        b.box('Vending price strip',(x-.15,y-.459,zz+.025),(1.04,.02,.08),'Pale ceramic',.004)
        for i in range(3):
            xx=x-.48+i*.31
            b.cylinder('Vending drink bottle',(xx,y-.12,zz+.19),.085,.28,'Mint enamel' if i%2 else 'Terracotta',16,r2=.075)
            b.cylinder('Vending bottle neck',(xx,y-.12,zz+.36),.047,.07,'Pale ceramic',12)
            b.cylinder('Vending bottle label',(xx,y-.12,zz+.21),.087,.105,'Awning cream',16)
    glass_panel('Vending display glass',[(x-.72,y-.53,1.53),(x+.42,y-.53,1.53),(x+.42,y-.53,3.45),(x-.72,y-.53,3.45)])
    for xx in [x-.73,x+.44]:
        b.box('Vending door mullion',(xx,y-.535,2.49),(.055,.07,1.98),'Gunmetal',.014)
        b.tube('Vending continuous side lamp',[(xx,y-.39,1.58),(xx,y-.39,3.40)],.022,'Pink neon')
    b.box('Vending payment screen',(x+.58,y-.514,2.99),(.22,.025,.28),'Cyan neon',.02)
    b.box('Vending card reader',(x+.58,y-.527,2.56),(.22,.08,.22),'Gunmetal',.025)
    b.box('Vending collection opening',(x-.13,y-.487,1.14),(1.07,.035,.31),'Gunmetal',.025)
    b.box('Vending hinged hatch',(x-.13,y-.513,1.19),(.99,.045,.17),'Aluminium',.025,rot=(.3,0,0))
    for zz in [1.92,2.30]:b.cylinder('Vending selection button',(x+.59,y-.53,zz),.045,.025,'Warm neon',16,(math.pi/2,0,0))

