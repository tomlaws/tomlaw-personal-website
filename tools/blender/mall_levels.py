"""Distinct Galleria programmes, public roof, protected lift and fitted media.

All meshes, material maps and joinery are authored in Blender, in metres.
References and adaptations are recorded in reference/asset-references.md.
"""
import math
import bpy
import numpy as np
from mathutils import Vector
import build_city as b
import craftsmanship as craft
import public_realm as realm
from detailed_assets import mesh_object, glass_panel
import mall_interior as mi
from mall_plan import (CX,CY,HALF_X,HALF_Y,WEST_X,EAST_X,SOUTH,NORTH,FRONT_Y,REAR_Y,CORNER,FLOORS,
    GROUND,GALLERY,LIBRARY,ROOF,CEILING,ATRIUM,LIFT,ESC,BRIDGE)


def art_panel(x,y,z,w=2.4,h=1.6):
    """Framed relief artwork with overlapping curved cut-paper silhouettes."""
    b.box('Galleria gallery art frame',(x,y,z),(w+.12,.13,h+.12),'Wood',.035)
    b.box('Galleria gallery linen backing',(x,y-.076,z),(w,.025,h),'Awning cream',.008)
    for j,(mat,scale,dx) in enumerate([('Mineral blue',.65,-.18),('Burgundy enamel',.42,.17),('Copper',.23,.04)]):
        path=[]
        for i in range(40):
            a=i*math.tau/40
            path.append((x+dx*w+math.cos(a)*w*scale*.45,y-.098-j*.008,z+math.sin(a)*h*scale*.61+.10*math.sin(a*2)))
        mesh_object('Galleria original abstract relief',path,[tuple(range(40))],mat)


def design_gallery(z):
    """Second floor: a design salon and a pottery atelier in the two wings."""
    mi.room('Galleria design salon',mi.WING_WEST,mi.ROOM_FRONT,mi.ROOM_BACK,mi.ROOM_WIDTH,z,'Mineral blue',door=mi.WING_WEST+.66)
    # Replace the oak finish inside the room with a flush stone finish.
    bpy.data.objects['Galleria design salon oak floor'].data.materials[0]=b.M['Paving stone']
    art_panel(mi.WING_WEST,-1.55,z+2.05,2.20,1.55)
    # A continuous sculpted figure-eight ceramic, open at the centre.
    b.slab('Galleria exhibition oval plinth',(mi.WING_WEST,-4.55),1.22,.80,z,.43,'Dusty plaster',.4)
    points=[(mi.WING_WEST+.42*math.sin(t),-4.55+.15*math.sin(2*t),z+1.33+.58*math.cos(t)) for t in [i*math.tau/80 for i in range(80)]]
    b.tube('Galleria porcelain loop sculpture',points,.15,'Pale ceramic',True)
    mi.chair(mi.WING_WEST-.70,-6.70,z,-.4)
    mi.plant(mi.WING_WEST+.66,-7.65,z,.75)
    mi.room('Galleria ceramics atelier',mi.WING_EAST,mi.ROOM_FRONT,mi.ROOM_BACK,mi.ROOM_WIDTH,z,'Ochre plaster',door=mi.WING_EAST-.66)
    bpy.data.objects['Galleria ceramics atelier oak floor'].data.materials[0]=b.M['Paving stone']
    # A shared workshop table, shaped stools and pottery tools distinguish it
    # from the ground-floor bookshop and the gallery's display plinths.
    for x in [mi.WING_EAST-.58,mi.WING_EAST+.58]:
        for y in [-2.72,-2.02]:b.box('Galleria atelier trestle foot',(x,y,z+.42),(.14,.14,.84),'Wood',.018)
    b.slab('Galleria atelier workbench',(mi.WING_EAST,-2.37),2.05,1.15,z+.84,.095,'Wood',.15)
    for x in [mi.WING_EAST-.68,mi.WING_EAST,mi.WING_EAST+.68]:
        mi.lathe('Galleria atelier unfinished pottery',x,-2.32,z+.935,[(.11,0),(.18,.16),(.14,.28),(.09,.32),(.068,.32)],'Roof ceramic')
        mi.lathe('Galleria atelier turned stool',x,-4.15,z,[(.22,0),(.11,.05),(.07,.42),(.26,.45),(.26,.53)],'Wood')
    mi.shelves(mi.WING_EAST,-5.45,z,2.25,'ceramic')
    mi.plant(mi.WING_EAST+.70,-7.60,z,.70)


def library(z):
    """Third floor: a reading room and a listening lounge in the two wings."""
    mi.room('Galleria reading room',mi.WING_WEST,mi.ROOM_FRONT,mi.ROOM_BACK,mi.ROOM_WIDTH,z,door=mi.WING_WEST+.66)
    mi.shelves(mi.WING_WEST,-1.05,z,2.30)
    b.slab('Galleria library reading desk',(mi.WING_WEST,-3.75),2.20,.80,z+.72,.085,'Wood',.20)
    for dx in [-.82,.82]:b.box('Galleria library desk pedestal',(mi.WING_WEST+dx,-3.75,z+.35),(.15,.58,.70),'Mineral blue',.04)
    for dx in [-.62,.62]:
        mi.chair(mi.WING_WEST+dx,-4.58,z,0,'Canvas fabric')
        b.box('Galleria open reading volume',(mi.WING_WEST+dx,-3.70,z+.828),(.46,.32,.045),'Awning cream',.015)
        b.tube('Galleria library task lamp arm',[(mi.WING_WEST+dx,-3.52,z+.81),(mi.WING_WEST+dx,-3.52,z+1.27),(mi.WING_WEST+dx,-3.71,z+1.37)],.022,'Copper')
        b.slab('Galleria library task lamp',(mi.WING_WEST+dx,-3.73),.34,.17,z+1.32,.05,'Warm neon',.07)
    mi.plant(mi.WING_WEST+.68,-6.90,z,.80)
    # Low curved stacks preserve a view through the room into the atrium.
    for j in range(3):
        a=(-45+j*45)*math.pi/180;cx=mi.WING_WEST+math.cos(a)*.50;cy=-6.35+math.sin(a)*1.30
        b.slab('Galleria library curved bookcase',(cx,cy),1.10,.54,z,1.22,'Wood',.18)
        for row in range(3):
            for i in range(4):b.box('Galleria library case volume',(cx-.36+i*.24,cy-.28,z+.2+row*.36),(.15,.22,.29),['Mineral blue','Awning cream','Burgundy enamel'][i%3],.012)
    mi.room('Galleria listening lounge',mi.WING_EAST,mi.ROOM_FRONT,mi.ROOM_BACK,mi.ROOM_WIDTH,z,'Burgundy enamel',door=mi.WING_EAST-.66)
    for y in [-2.90,-5.60]:
        # Each listening bay has a deep upholstered bench, an inset side table
        # and a visible pair of headphones instead of another retail display.
        b.slab('Galleria listening banquette',(mi.WING_EAST+.56,y),1.10,1.90,z,.38,'Wood',.32)
        b.slab('Galleria listening seat',(mi.WING_EAST+.46,y),1.15,1.90,z+.38,.18,'Burgundy enamel',.35)
        b.slab('Galleria listening curved back',(mi.WING_EAST+1.00,y),.22,1.90,z+.50,.74,'Burgundy enamel',.11)
        b.slab('Galleria listening side console',(mi.WING_EAST-.78,y),.64,.72,z,.62,'Mineral blue',.20)
        b.tube('Galleria listening headphone band',[(mi.WING_EAST-.78+.15*math.cos(a),y,z+.75+.17*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]],.026,'Gunmetal')
        for dx in [-.15,.15]:b.box('Galleria headphone ear cup',(mi.WING_EAST-.78+dx,y,z+.73),(.075,.13,.16),'Gunmetal',.028)
    mi.shelves(mi.WING_EAST,-1.05,z,2.30)
    mi.plant(mi.WING_EAST-.70,-7.60,z,.75)


def rooftop(z,guard):
    """Open viewing terrace; the original dome is authored separately."""
    edge=b.rounded(CX,CY,HALF_X*2-.90,HALF_Y*2-.90,CORNER-.10,16)
    guard('Galleria rooftop continuous safety glass',[(x,y,z+.06) for x,y in edge+[edge[0]]],1.16)
    import roof_terrace
    roof_terrace.build(z)

def lift(config):
    """Enclosed five-stop lift, aligned sills, service chase and sliding doors."""
    static=b.GROUP;cfg=config['lift'];x,y=cfg['x'],cfg['y'];floors=config['floors']+[config['roof']]
    bottom=.8;top=config['roof']+3.45;front=cfg['doorY']
    # Cut the thin floor finishes too: no parquet can bridge the shaft opening.
    bpy.context.view_layer.update()
    for obj in list(static.objects):
        if obj.type!='MESH' or 'floor' not in obj.name.lower():continue
        points=[obj.matrix_world@Vector(v) for v in obj.bound_box]
        lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
        if lo[2]<=config['floors'][0]+.1 or hi[2]-lo[2]>.1:continue
        if lo[0]<x+1.45 and hi[0]>x-1.45 and lo[1]<y+1.45 and hi[1]>y-1.45:
            realm.apply_difference(obj,[b.box('Temporary lift floor finish opening',(x,y,(lo[2]+hi[2])/2),(2.9,2.9,.4),'Gunmetal',0)])
    # Continuous opaque back protects the drive equipment; the cabin is visible
    # through the two side skins, never an exposed mechanism in an empty frame.
    b.box('Galleria lift protected service chase',(x,y+1.40,(bottom+top)/2),(3.10,.30,top-bottom),'Mineral blue',.045)
    for xx in [x-1.52,x+1.52]:
        for yy in [front,y+1.38]:b.box('Galleria lift structural corner',(xx,yy,(bottom+top)/2),(.13,.13,top-bottom),'Copper',.025)
        glass_panel('Galleria lift continuous safety enclosure',[(xx,front+.07,bottom),(xx,y+1.32,bottom),(xx,y+1.32,top-.15),(xx,front+.07,top-.15)])
    for xx in [x-1.25,x+1.25]:b.box('Galleria lift protected guide rail',(xx,y+1.13,(bottom+top)/2),(.07,.07,top-bottom-.20),'Aluminium',.012)
    for i,floor in enumerate(floors):
        ceiling=floors[i+1]-.08 if i+1<len(floors) else top-.10
        # Solid side returns and glass transom close the entire front skin.
        for xx in [x-1.115,x+1.115]:
            b.box('Galleria lift front return',(xx,front,(floor+ceiling)/2),(.77,.12,ceiling-floor),'Mineral blue',.025)
        b.box('Galleria lift landing lintel',(x,front,floor+2.53),(1.58,.20,.12),'Copper',.02)
        glass_panel('Galleria lift above-door infill',[(x-.73,front,floor+2.6),(x+.73,front,floor+2.6),(x+.73,front,ceiling),(x-.73,front,ceiling)])
        for xx in [x-.745,x+.745]:b.box('Galleria lift fitted door jamb',(xx,front-.015,floor+1.27),(.065,.22,2.54),'Aluminium',.013)
        b.box('Galleria lift aligned landing sill',(x,front+.105,floor-.032),(1.55,.41,.064),'Aluminium',.008)
        b.box('Galleria lift call panel',(x+.98,front-.075,floor+1.22),(.15,.035,.30),'Gunmetal',.025)
        b.cylinder('Galleria lift call button',(x+.98,front-.098,floor+1.22),.034,.015,'Warm neon',16,(math.pi/2,0,0))
        for xx in [x-1.52,x+1.52]:b.tube('Galleria lift floor transom',[(xx,front,floor-.05),(xx,y+1.32,floor-.05)],.045,'Copper')
    b.slab('Galleria lift enclosed machinery cap',(x,y),3.28,3.22,top-.12,.23,'Awning cream',.24)
    # The moving car is retained as an independent editable Blender collection.
    b.collection('Mall lift')
    b.slab('Galleria lift cabin floor',(0,0),2.46,2.68,-.12,.12,'Wood',.08)
    b.box('Galleria lift cabin rear',(0,1.29,1.28),(2.46,.10,2.56),'Mineral blue',.018)
    b.slab('Galleria lift cabin ceiling',(0,0),2.48,2.70,2.58,.12,'Awning cream',.09)
    b.slab('Galleria lift ceiling diffuser',(0,0),1.65,1.70,2.556,.021,'Honey interior',.20)
    for xx in [-1.19,1.19]:
        glass_panel('Galleria lift cabin side glass',[(xx,-1.30,.04),(xx,1.23,.04),(xx,1.23,2.55),(xx,-1.30,2.55)])
        b.tube('Galleria lift cabin safety handrail',[(xx*.96,-1.0,1.02),(xx*.96,1.10,1.02)],.035,'Copper')
        b.box('Galleria lift cabin corner',(xx,-1.31,1.29),(.085,.085,2.58),'Copper',.02)
    for xx in [-.94,.94]:b.box('Galleria lift cabin door cheek',(xx,-1.33,1.24),(.55,.08,2.48),'Mineral blue',.015)
    b.collection('Mall doors')
    # One leaf is instanced twelve times at runtime (five landings + the car).
    for xx in [-.337,.337]:b.box('Galleria lift door vertical stile',(xx,0,1.24),(.045,.05,2.44),'Aluminium',.008)
    for zz in [.025,2.46]:b.box('Galleria lift door horizontal stile',(0,0,zz),(.72,.05,.045),'Aluminium',.008)
    glass_panel('Galleria lift laminated sliding leaf',[(-.315,0,.05),(.315,0,.05),(.315,0,2.43),(-.315,0,2.43)])
    b.box('Galleria lift door low kickplate',(0,-.005,.18),(.66,.025,.25),'Mineral blue',.012)
    b.GROUP=static


def advertisements(config):
    """Two fitted LED campaigns with embedded authored colour/emission maps."""
    material=b.material('Galleria digital media','#ffffff',.4,0,emit=1.8,texture=True)
    n=1024;y,x=np.mgrid[0:n,0:n]/(n-1);local=(y*2)%1;second=y>=.5
    pixels=np.ones((n,n,4),np.float32)
    lower=np.array(b.rgb('#182b45'));upper=np.array(b.rgb('#4b2c54'))
    pixels[:,:,:3]=np.where(second[:,:,None],upper,lower)
    # Flowing folded ribbons leave the left third quiet for typography.
    for i,(colour,offset) in enumerate([('#c0a8f0',0),('#e6a68c',.15),('#70a9af',.31),('#e4d6b6',.46)]):
        wave=.47+.24*np.sin((x-.3)*5+offset*4)+offset*.2
        band=np.exp(-((local-wave)/(.065+i*.006))**2)*np.clip((x-.3)*3,0,1)
        pixels[:,:,:3]=pixels[:,:,:3]*(1-band[:,:,None]*.85)+np.array(b.rgb(colour))*band[:,:,None]*.85
    # Subtle embedded LED matrix texture, not separate geometry or thin bars.
    pixels[:,:,:3]*=(.95+.05*np.cos(x*math.tau*128)*np.cos(y*math.tau*128))[:,:,None]
    image=bpy.data.images.new('Galleria original digital campaigns',width=n,height=n);image.colorspace_settings.name='sRGB'
    image.pixels.foreach_set(b.encode_colour(pixels).ravel());image.pack()
    nodes=material.node_tree.nodes;links=material.node_tree.links;p=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=image
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='DetailUV';links.new(uv.outputs['UV'],tex.inputs['Vector'])
    links.new(tex.outputs['Color'],p.inputs['Base Color']);links.new(tex.outputs['Color'],p.inputs['Emission Color'])
    for i,s in enumerate(config['screens']):
        x,y,z,w,h,side=[s[k] for k in ['x','y','z','width','height','side']]
        size=(.19,w+.18,h+.18) if side else (w+.18,.19,h+.18)
        b.box('Galleria integrated media bronze bezel',(x,y,z),size,'Copper',.065)
        if side:verts=[(x+.11,y-w/2,z-h/2),(x+.11,y+w/2,z-h/2),(x+.11,y+w/2,z+h/2),(x+.11,y-w/2,z+h/2)]
        else:verts=[(x-w/2,y-.11,z-h/2),(x+w/2,y-.11,z-h/2),(x+w/2,y-.11,z+h/2),(x-w/2,y-.11,z+h/2)]
        obj=mesh_object('Galleria recessed digital screen',verts,[(0,1,2,3)],material)
        uv=obj.data.uv_layers.new(name='DetailUV')
        for loop,coords in zip(uv.data,[(0,i*.5),(1,i*.5),(1,(i+1)*.5),(0,(i+1)*.5)]):loop.uv=coords
        obj['preserveDetailUV']=True;obj['digitalAdvertisement']=True
        for label,dz,scale in [('FORM' if i==0 else 'SOUND',.46,.57),('DESIGN WEEK' if i==0 else 'LISTEN / DISCOVER',-.34,.18),('GALLERIA / 04',-.80,.15)]:
            position=(x+.135,y-1.75,z+dz) if side else (x-1.78,y-.135,z+dz)
            b.text('Galleria digital campaign typography',label,position,scale,'Warm neon',rotation=(math.pi/2,0,math.pi/2) if side else (math.pi/2,0,0))
