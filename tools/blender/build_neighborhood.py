"""A small, authored harbour neighbourhood: three buildings and inhabited streets.

Uses the existing Blender modelling/export helpers, but replaces the district,
architecture, public realm and material direction. Dimensions are metres.
"""
import sys, math, random, json, traceback
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0,str(Path(__file__).parent))
import build_city as b
import detailed_assets as detail
import craftsmanship as craft
import public_realm as realm
import arcade_quarter as quarter
import picturehouse
import traffic_signals
import harbor_mall
import toyshop
import cyber_teahouse
import night_identity
import cartoon_station
from types import SimpleNamespace

box=b.box; slab=b.slab; tube=b.tube; cylinder=b.cylinder; ring=b.ring
Z=.9

def surface(name,color,rough=.78,kind='plaster',metal=0.):
    """Tileable albedo, relief and roughness at three physical scales."""
    mat=b.material(name,color,rough,metal)
    n=256; y,x=np.mgrid[0:n,0:n];g=np.random.default_rng(sum(map(ord,name)))
    def noise(cells):
        grid=g.normal(0,1,(cells+1,cells+1));grid[-1,:]=grid[0,:];grid[:,-1]=grid[:,0]
        sx=x/n*cells;sy=y/n*cells;ix=sx.astype(int);iy=sy.astype(int)
        fx=sx-ix;fy=sy-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
        return (grid[iy,ix]*(1-fx)+grid[iy,ix+1]*fx)*(1-fy)+(grid[iy+1,ix]*(1-fx)+grid[iy+1,ix+1]*fx)*fy
    broad=noise(3)
    relief=broad*.025+noise(8)*.019+noise(24)*.012+g.normal(0,.012,(n,n))
    if kind=='brick':
        cell=n//12;course=(y//cell)%2;mortar=((y%cell)<1)|(((x+course*cell)%(cell*2))<1)
        relief-=mortar*.22
    elif kind=='tile':
        cell=n//12;mortar=((y%cell)<1)|((x%cell)<1);relief-=mortar*.19
    elif kind=='panel':
        # Pressed cladding: bolted vertical joints with a fine horizontal seam.
        vcell,hcell=n//4,n//16
        joint=((x%vcell)<2)|((y%hcell)<1)
        relief-=joint*.30
    elif kind=='asphalt':
        relief=relief*.4+g.normal(0,.027,(n,n))
    else:
        chips=g.random((n,n))>.996;relief-=chips*.2
    pixels=np.ones((n,n,4),np.float32);c=np.array(b.rgb(color))
    pixels[:,:,:3]=np.clip(c*(1+relief[:,:,None]*2.1),0,1)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    p.inputs['Coat Weight'].default_value=.035
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='DetailUV'
    def image(label,data,colour=False):
        im=bpy.data.images.new(name+' / '+label,width=n,height=n);im.colorspace_settings.name='sRGB' if colour else 'Non-Color'
        im.pixels.foreach_set((b.encode_colour(data) if colour else data).astype(np.float32).ravel());im.pack()
        node=nodes.new('ShaderNodeTexImage');node.image=im;links.new(uv.outputs['UV'],node.inputs['Vector']);return node
    tex=image('mineral colour',pixels,colour=True);links.new(tex.outputs['Color'],p.inputs['Base Color'])
    normal=np.ones_like(pixels);normal[:,:,0]=.5+(np.roll(relief,1,axis=1)-np.roll(relief,-1,axis=1))*.9;normal[:,:,1]=.5+(np.roll(relief,1,axis=0)-np.roll(relief,-1,axis=0))*.9;normal[:,:,2]=1
    nt=image('surface relief',normal);nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.45
    links.new(nt.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
    rough_map=rough+relief*.6
    if kind=='asphalt':rough_map-=np.clip(broad*.38-.08,0,.48)
    r=np.ones_like(pixels);r[:,:,:3]=np.clip(rough_map[:,:,None],.25,1)
    rt=image('roughness',r);links.new(rt.outputs['Color'],p.inputs['Roughness'])
    return mat

def palette():
    b.M.clear();b.LIGHTS.clear();b.ASSETS.clear()
    b.initialize()
    # Daylight target (reference/daytime/pastel-toytown-isometric.png): a high-key
    # pastel diorama. Warm near-white walls and sand paving carry the frame, with
    # saturated cobalt, terracotta and foliage green reserved for roofs, awnings
    # and planting. Measured on the reference: median luma 0.66, 5th percentile
    # 0.39 (shadows stay light) and 63% of pixels above 0.18 saturation.
    surface('Mineral blue','#3380ab',.83)
    surface('Soot concrete','#7b8492',.84)
    surface('Dusty plaster','#dbcaa4',.85)
    surface('Clay brick','#b96a3c',.82,'brick')
    surface('Ochre plaster','#d6b174',.82)
    surface('Jade tile','#5c8c7e',.5,'tile')
    surface('Street asphalt','#8e8779',.73,'asphalt')
    surface('Paving stone','#cdb992',.86)
    surface('Tree soil','#7f6d55',.96,'asphalt')
    surface('Patchwork render','#bcb192',.88)
    surface('Lawn','#86a83f',.9)
    # Crisp painted trim: cornices, floor bands, window frames and coping, the
    # reference's strongest architectural signal against saturated walls.
    surface('Trim cream','#f0e5cd',.82)
    surface('Bark','#8e7554',.9)
    # Pressed-metal cladding for the neon shopfronts in the quarter: the deepest
    # surface left in the city, held near the reference's cool slate.
    surface('Neon panel','#414751',.44,'panel',metal=.18)
    # Natural foliage and restrained painted metal, rather than a pink tree palette.
    for name,color in [('Leaf','#4e7a45'),('Leaf light','#8db055'),('Concrete','#a9a49a'),('Stone','#d2cbb8'),('Copper','#c08a52'),('Deep teal','#3f7f76'),('Oxidized metal','#9daba3')]:
        p=b.M[name].node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*b.rgb(color),1)
        # These replacements are untextured details; use the explicit new surfaces for walls.
        for link in list(p.inputs['Base Color'].links):b.M[name].node_tree.links.remove(link)
    b.M['Window glass'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*b.rgb('#9cb6bf'),1)
    craft.textures()
    detail.foliage_materials()
    b.material('Lift solar glass','#7aa8a4',.19,.15,alpha=.42)
    # Neon tube colours are shared: night_identity fits them into its architectural
    # channels and the teahouse lights its own signage with the same two tubes.
    b.material('Night cyan','#13d9ff',.29,.05,emit=6.5)
    b.material('Night magenta','#ff369a',.29,.05,emit=5.5)

def signed_board(body,x,y,z,w,h,color='Cyan neon',back='Gunmetal',side=False):
    assert not any('\u3400'<=c<='\u9fff' for c in body), 'City signs must not contain Chinese text'
    lines=body.split('\n');size=min(h/(len(lines)*1.35),w/max(map(len,lines))*.88)
    if side:
        box('Enamel blade sign',(x,y,z),(.24,w,h),back,.08)
        o=b.text('Sign lettering',body,(x+.135,y,z),size,color,rotation=(math.pi/2,0,math.pi/2));o.data.align_y='CENTER'
    else:
        box('Painted sign case',(x,y,z),(w,.22,h),back,.06)
        o=b.text('Sign lettering',body,(x,y-.125,z),size,color);o.data.align_y='CENTER'

def pipe(points,r=.1,mat='Copper'):
    tube('Exposed utility pipe',points,r,mat)
    for i,p in enumerate(points[1:-1],1):
        direction=Vector(points[i+1])-Vector(p)
        cylinder('Pipe coupling',p,r*1.35,.13,mat,12,direction.to_track_quat('Z','Y').to_euler())

def shutter(x,y,z,w,h):
    box('Roller shutter recess',(x,y+.09,z),(w,.2,h),'Gunmetal',.025)
    for i in range(max(3,int(h/.34))):box('Shutter formed slat',(x,y-.035,z-h/2+.16+i*.34),(w-.12,.08,.18),'Oxidized metal',.022)

def front_bay(x,y,z,w,h,lit='Honey interior',frame='Trim cream',split=False,depth=None,mullions=None,mullion_width=.14):
    back=.035 if depth is None else depth
    if depth is None:box('Recess shadow',(x,y+.27,z),(w+.22,.43,h+.22),'Gunmetal',.035)
    else:
        box('Shop rear wall',(x,y+depth+.08,z),(w+.22,.15,h+.22),'Dusty plaster',.025)
        for dz in [-h/2,h/2]:box('Shop floor and ceiling',(x,y+depth/2,z+dz),(w+.2,depth+.25,.12),'Dusty plaster',.02)
        for dx in [-w/2,w/2]:box('Shop reveal',(x+dx,y+depth/2,z),(.12,depth+.25,h),'Dusty plaster',.02)
        box('Recessed ceiling fixture',(x,y+depth*.42,z+h/2-.09),(w*.65,.2,.055),'Warm neon',.015)
    if lit:b.room_panel('Recessed ceiling-lit interior',(x,y+back,z),w-.12,h-.14,lit)
    else:box('Unlit room depth',(x,y+.02,z),(w-.13,.05,h-.15),'Vehicle glazing',.025)
    if depth is not None and lit:
        craft.room_lining('Shop continuous interior bounce',x,y-.08,y+depth-.008,z,w,h,lit)
    divisions=mullions if mullions is not None else ([0] if split else [])
    edges=[-w/2+.07]+[v for d in divisions for v in [d-mullion_width/2-.015,d+mullion_width/2+.015]]+[w/2-.07]
    for a,c in zip(edges[::2],edges[1::2]):
        box('Reflective front pane',(x+(a+c)/2,y-.11,z),(c-a,.018,h-.1),'Window glass',0)
    for dx in [-w/2,w/2]:box('Deep painted jamb',(x+dx,y-.06,z),(.105,.26,h+.13),frame,.025)
    for dz in [-h/2,h/2]:box('Window lintel and sill',(x,y-.04,z+dz),(w+.18,.32,.12),frame,.025)
    for d in divisions:box('Window meeting stile',(x+d,y-.135,z),(mullion_width,.07,h),frame,.014)
    box('Concrete sill',(x,y-.14,z-h/2-.11),(w+.38,.48,.13),'Paving stone',.03)

def side_bay(x,y,z,w,h,lit='Lagoon interior'):
    box('Side recess',(x-.25,y,z),(.43,w+.2,h+.2),'Gunmetal',.035)
    if lit:b.room_panel('Side room wall',(x-.03,y,z),w-.1,h-.1,lit,side=True)
    else:box('Unlit side room',(x-.02,y,z),(.04,w-.1,h-.1),'Vehicle glazing',0)
    box('Side glazing',(x+.1,y,z),(.018,w-.1,h-.1),'Window glass',0)
    for dy in [-w/2,w/2]:box('Side window jamb',(x+.04,y+dy,z),(.27,.1,h+.16),'Copper',.025)
    for dz in [-h/2,h/2]:box('Side window sill',(x+.06,y,z+dz),(.35,w+.2,.12),'Copper',.025)

def service_bay(x,y,z,w,h,angle,lit=None):
    before=set(b.GROUP.objects)
    front_bay(0,0,z,w,h,lit,'Gunmetal',True)
    for obj in set(b.GROUP.objects)-before:
        px,py=obj.location.x,obj.location.y
        obj.location.x=x+px*math.cos(angle)-py*math.sin(angle)
        obj.location.y=y+px*math.sin(angle)+py*math.cos(angle)
        obj.rotation_euler.z+=angle

def facade_course(cx,front,z,w,height,centres,window_width,window_height,mat,lights,frame='Trim cream'):
    bottom=z;top=z+height;mid=z+height*.52
    # Solid walls around real apertures: broad masonry areas, not luminous floor bands.
    low=mid-window_height/2;high=mid+window_height/2
    box('Lower masonry spandrel',(cx,front,(bottom+low)/2),(w,.52,low-bottom),mat,.05)
    box('Upper masonry lintel',(cx,front,(high+top)/2),(w,.52,top-high),mat,.05)
    edges=[cx-w/2]+[v for x in centres for v in [x-window_width/2,x+window_width/2]]+[cx+w/2]
    for a,c in zip(edges[::2],edges[1::2]):
        if c>a:box('Masonry pier',((a+c)/2,front,mid),(c-a,.52,window_height),mat,.04)
    # Painted window surrounds carry the building's own pastel accent, the
    # reference's strongest colour signal above the shopfront.
    for i,x in enumerate(centres):front_bay(x,front-.285,mid,window_width,window_height,lights[i],frame=frame)

def wall_ac(x,y,z,side=False):
    box('Air conditioner',(x,y,z),(1.15,.62,.72),'Oxidized metal',.08)
    # One pressed grille instead of hairline fan blades and louvre strips.
    box('Condenser grille',(x-.2,y-.325,z),(.62,.045,.5),'Gunmetal',.03)
    for i in range(3):box('Condenser grille bar',(x-.2,y-.35,z-.16+i*.16),(.56,.03,.055),'Gunmetal',.012)
    pipe([(x+.58,y,z-.2),(x+.78,y,z-.2),(x+.78,y,z-1.1)],.06,'Gunmetal')
    for dx in [-.43,.43]:box('AC wall bracket',(x+dx,y+.04,z-.4),(.065,.75,.08),'Copper',.012)

def ground_level(x,y):
    return .8

def planter(x,y,z=None,scale=1):
    if z is None:z=ground_level(x,y)
    cylinder('Terracotta planter',(x,y,z+.27*scale),.37*scale,.54*scale,'Terracotta',16,r2=.45*scale)
    cylinder('Pot soil',(x,y,z+.55*scale),.37*scale,.04,'Bark',16)
    for i in range(7):
        a=i*2.4
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=(x+math.cos(a)*.19*scale,y+math.sin(a)*.19*scale,z+.85*scale))
        o=b.link(bpy.context.object,'Leaf light' if i%3==0 else 'Leaf');o.name='Broad waxy leaf';o.scale=(.13*scale,.09*scale,.5*scale);o.rotation_euler=(.5*math.cos(a),.5*math.sin(a),a)
        for f in o.data.polygons:f.use_smooth=True

def small_tree(x,y,z=.9,tag='',seed=902):
    detail.tree(x,y,z,tag,seed)


def continuous_ground(outline):
    """Closed, uninterrupted paving; infrastructure excavations are applied later."""
    obj=b.poly('Continuous neighbourhood ground',outline,.6,.2,'Paving stone',0)
    obj['pavingDatum']=.8

def ground():
    b.collection('00 · Quay and streets')
    outline=realm.quay_outline()
    # Plan curves, rather than a large 3D bevel, align all three ground layers.
    b.poly('Harbour retaining wall',outline,-2.2,2.6,'Soot concrete',.025)
    b.poly('Quay coping',outline,.36,.25,'Paving stone',.008)
    continuous_ground(outline)
    # An arterial waterfront street, a narrow rear lane and two access turns.
    realm.street_straights()
    realm.street_corners()
    box('Workshop delivery lane',(0,.575,.815),(3.3,27.45,.032),'Street asphalt',0)
    for x in np.arange(-18.8,20,4):
        if abs(x-4.8)>2:box('Broken road centre line',(x,-15.25,.837),(1.9,.13,.012),'Pale ceramic',0)
    # Two deliberate pedestrian crossings, not markings on every corner.
    for i in range(6):box('Side lane crossing',(-25+i*.6,-4.8,.844),(.31,1.2,.015),'Pale ceramic',.012)
    for i in range(6):box('Side lane crossing mall',(21.95+i*.6,-4.8,.844),(.31,1.2,.015),'Pale ceramic',.012)
    for x,y in [(-18,-18.8),(17,-18.8),(-27.3,8),(27.3,8)]:b.streetlight(x,y)
    for x,y in [(-7,-13.7),(15,15),(22,3)]:
        cylinder('Iron manhole',(x,y,.846),.42,.018,'Gunmetal',24)
        ring('Manhole rim',(x,y,.86),.35,.028,'Oxidized metal')
    realm.recess_streets()
    realm.tree_soil()
    traffic_signals.build()
    b.status('Street hierarchy modeled')

def repair_house():
    b.collection('01 · Kowloon repair house')
    x,y=-12,7;front=1.5;w=11;d=11
    # Masonry core is set back behind the apertures and extends to a rear wall.
    box('Repair house foundation',(-12,6.9,.87),(11.3,11.6,.14),'Soot concrete',.04)
    box('Repair house structural core',(x,y+.5,9.7),(10.5,9.5,17.6),'Soot concrete',.15)
    box('Repair house east return',(-6.65,7,9.7),(.2,11,17.6),'Dusty plaster',.04)
    box('Repair house west return',(-17.35,7,9.7),(.3,11,17.6),'Soot concrete',.04)
    # Ground floor is a recessed, visibly inhabited shop beneath a brick transom.
    box('Shop tiled plinth',(x,front-.03,1.25),(11,.6,.7),'Jade tile',.08)
    for xx in [-17.25,-12.8,-6.75]:box('Arcade masonry pier',(xx,front,2.7),(.5,.8,3.6),'Jade tile',.07)
    box('Shop transom',(x,front,4.55),(11.2,.8,.64),'Clay brick',.08)
    for xx,ww in [(-15,3.65),(-9.6,5.1)]:front_bay(xx,front-.38,2.7,ww,2.4,'Honey interior',frame='Mint enamel',depth=1.5)
    box('Shop floor',(-12,1.2,1.0),(10.4,1.4,.15),'Jade tile',.02)
    # Shelves, small boxes, a counter and a lit refrigerator behind the glass.
    for xx in [-16,-14.8,-10.6,-9.4,-8.2]:
        for zz in [1.65,2.3,2.95]:
            box('Shop shelf',(xx,2.26,zz),(1.05,.42,.06),'Wood',.012)
            for j in range(4):box('Stock box',(xx-.36+j*.24,2.2,zz+.17),(.18,.19,.28),'Awning cream' if j%2 else 'Deep teal',.025)
    box('Timber shop counter',(-14.8,1.5,1.85),(2.7,.45,.7),'Wood',.07)
    signed_board('KOWLOON ELECTRIC',-12,.995,4.53,7.6,.75,'Warm neon')
    craft.shop_canopy()
    tube('Shop canopy lamp',[(-17.4,-.4,3.92),(-6.6,-.4,3.92)],.055,'Warm neon')
    # Four unequal window compositions and varied occupancy.
    for f in range(4):
        z=4.9+f*3.4
        centres=[-15.5,-12,-8.5] if f!=2 else [-15.4,-11.9,-8.4]
        lights=[['Honey interior',None,'Apricot interior'],[None,'Lagoon interior',None],['Honey interior','Honey interior',None],[None,'Apricot interior','Lagoon interior']][f]
        # One pale base carries every building, as in the reference; the
        # building's colour lives in its surrounds, belts and parapet.
        facade_course(x,front,z,11,3.4,centres,1.9 if f!=2 else 2.1,2.05,'Dusty plaster',lights,frame='Ochre plaster')
        if f in [0,2]:box('Concrete belt',(-12,1.4,z-.06),(11.5,.74,.19),'Trim cream',.035)
    for xx,zz in [(-16.4,8.2),(-16.4,15)]:wall_ac(xx,1.05,zz)
    for xx in [-17.35,-7.0]:pipe([(xx,1.1,1.1),(xx,1.1,17.5),(xx+.3,1.1,18.6)],.1,'Copper')
    # Quieter service elevations remain inhabited when the camera orbits, but
    # one recessed bay per storey instead of a field of small openings.
    for f in range(4):
        service_bay(-15.5,12.38,6.65+f*3.4,1.8,1.95,math.pi,'Apricot interior' if f==1 else None)
    for yy in [3.15,11.7]:pipe([(-17.59,yy,1.1),(-17.59,yy,18.5)],.105,'Oxidized metal')
    box('Side utility enclosure',(-17.64,7.4,2.3),(.3,2.35,2.7),'Deep teal',.08)
    box('Rear delivery door',(-12,12.32,2.25),(1.85,.16,2.7),'Deep teal',.06)
    box('Rear service canopy',(-12,12.72,3.75),(2.25,1,.15),'Oxidized metal',.05)
    box('Weathered wall repair',(-16.8,1.225,12.45),(1.12,.055,.61),'Patchwork render',.01)
    box('Older brick infill',(-7.25,1.22,5.45),(.85,.05,.8),'Clay brick',.01)
    # Roof parapet, ceramic tank, a service cabin and carefully spaced equipment.
    roof=18.5
    slab('Roof coping',(-12,7),11.65,11.55,roof,.27,'Trim cream',.2)
    for xx in [-17.4,-6.6]:box('Roof parapet',(xx,7,roof+.6),(.3,10.9,.65),'Mineral blue',.04)
    for yy in [1.65,12.35]:box('Roof parapet',(-12,yy,roof+.6),(11.1,.3,.65),'Mineral blue',.04)
    box('Rooftop stair room',(-14.6,9.1,roof+1.45),(3.3,3.6,2.6),'Mineral blue',.12)
    box('Service cabin cap',(-14.6,9.1,roof+2.81),(3.65,3.92,.18),'Gunmetal',.05)
    cylinder('Roof water tank',(-9.2,8.9,roof+1.33),1.2,2.1,'Oxidized metal',32)
    for zz in [roof+.42,roof+1.4,roof+2.22]:ring('Water tank strap',(-9.2,8.9,zz),1.21,.065,'Gunmetal')
    pipe([(-8,8.9,roof+1.7),(-7.4,8.9,roof+1.7),(-7.4,8.9,roof+.2)],.11)
    b.hvac(-11.4,4.3,roof+.27,1.15);b.hvac(-15,4.1,roof+.27,.85)
    for yy in [7.8,8.7,9.6]:cylinder('Roof communications whip',(-14.5,yy,roof+3.65),.055,1.8,'Oxidized metal',12)
    signed_board('R\nE\nP\nA\nI\nR',-6.2,.35,9.3,1.2,3.4,'Pink neon')
    for zz in [7.85,10.75]:tube('Repair sign mounting arm',[(-6.65,1.6,zz),(-6.65,.44,zz)],.065,'Gunmetal')
    planter(-17.9,.15,scale=.9);planter(-7,-.45,scale=.75)
    b.area('Repair shop amber pool',(-12,-.3,3.9),'#ffc087',280,6,(-12,1.4,1.6))
    b.sign_light('Repair blade pink bounce',(-6.2,.35,9.3),1.2,3.4,'#e66bb5',50)
    b.status('Repair house modeled')

def workshop():
    picturehouse.build(SimpleNamespace(**globals()))


def teahouse():
    cyber_teahouse.build(SimpleNamespace(**globals()))


def bicycle(x,y,z=.9):
    for yy in [-.72,.72]:
        pts=[(x,y+yy+math.cos(a)*.36,z+.4+math.sin(a)*.36) for a in np.linspace(0,math.tau,33)]
        tube('Bicycle tire',pts,.048,'Gunmetal',True)
        for a in [0,math.pi/3,2*math.pi/3]:tube('Bicycle spokes',[(x,y+yy+math.cos(a)*.33,z+.4+math.sin(a)*.33),(x,y+yy-math.cos(a)*.33,z+.4-math.sin(a)*.33)],.012,'Aluminium')
    a=(x,y-.72,z+.4);c=(x,y+.72,z+.4);m=(x,y-.02,z+.35);seat=(x,y+.2,z+.95);head=(x,y-.5,z+.99)
    for pts in [[a,m,seat,c,m],[seat,head,a],[head,(x,y-.54,z+1.23),(x+.24,y-.62,z+1.28)],[(x,y+.2,z+.95),(x,y+.2,z+1.1)]]:tube('Bicycle enamel frame',pts,.035,'Deep teal')
    slab('Bicycle saddle',(x,y+.23),.26,.32,z+1.08,.08,'Gunmetal',.09)
    box('Front wire basket',(x,y-.82,z+1.09),(.47,.34,.31),'Oxidized metal',.045)

def stop():
    b.collection('04 · Lantern transit stop')
    # A street vignette with deliberately readable, generous spacing.
    x,y=10.2,-7.3
    slab('Bus shelter roof',(x,y),6.2,2.7,4.0,.23,'Deep teal',.45)
    for xx in [7.5,12.9]:
        for yy in [y-1.02,y+1.02]:cylinder('Shelter rounded post',(xx,yy,2.4805),.09,3.159,'Oxidized metal',16)
        box('Shelter glazed end',(xx,y,2.55),(.024,1.84,2.5),'Window glass',0)
        for zz in [1.25,3.85]:tube('Shelter glass frame',[(xx,y-1.02,zz),(xx,y+1.02,zz)],.055,'Oxidized metal')
    box('Shelter rear glass',(x,y+1.02,2.55),(5.2,.027,2.5),'Window glass',0)
    for zz in [1.25,3.85]:tube('Shelter rear frame',[(7.5,y+1.02,zz),(12.9,y+1.02,zz)],.055,'Oxidized metal')
    tube('Shelter warm fixture',[(8.2,y,3.965),(12.2,y,3.965)],.043,'Pink neon')
    craft.bench(x,y+.28,.9,4.65)
    # Freestanding vending machine, small stocked cans, a payment panel and hatch.
    vx,vy=15.7,-6.45
    craft.vending(vx,vy)
    signed_board('24',vx,vy-.575,3.56,1.1,.26,'Pink neon')
    # Cat ears and a sleeping rounded cat echo the inhabited detail of the reference.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=(vx-.3,vy,3.93));o=b.link(bpy.context.object,'Stone');o.scale=(.37,.27,.19)
    for xx in [vx-.59,vx-.35]:cylinder('Cat ear',(xx,vy-.2,4.13),.09,.22,'Stone',3,r2=0)
    for xx in [vx-.54,vx-.39]:box('Sleeping cat eye',(xx,vy-.255,4.02),(.055,.018,.025),'Gunmetal',.008)
    cylinder('Stop sign post',(6.15,-9.2,2.1),.065,2.4,'Copper',12)
    cylinder('Stop sign foot',(6.15,-9.2,.96),.25,.12,'Paving stone',20)
    box('Route sign',(6.15,-9.2,3.4),(.73,.15,1.05),'Deep teal',.1)
    b.text('Route number','08',(6.15,-9.29,3.34),.36,'Pale ceramic')
    bicycle(18,-8.4);planter(14,-8.8,z=.9,scale=.8)
    # The group is lowered 10 cm below, so the root collar finishes in its soil pit.
    small_tree(16,-2.5,.87)
    box('Street bin',(17.4,-5.1,1.42),(.65,.65,1.05),'Deep teal',.14)
    box('Litter slot',(17.4,-5.445,1.61),(.4,.027,.12),'Gunmetal',.025)
    # This vignette was authored on a .9 m base. Seat the whole assembly on the
    # common .8 m quay datum, keeping every connected component together.
    for obj in b.GROUP.objects:obj.location.z-=.1
    b.area('Shelter rose light',(10,-7.8,3.5),'#e994be',260,5,(10,-8.8,.9))
    b.area('Vending cabinet ceiling',(15.55,-6.40,3.29),'#ffdbb9',24,.8,(15.55,-6.73,1.5))
    b.status('Transit vignette modeled')

def waterfront():
    b.collection('05 · Harbour promenade')
    # Open promenade replaces the elevated railway across the foreground.
    b.waterfront_railing([(-44,-21),(-12,-21)],.84,.93)
    b.waterfront_railing([(-3,-21),(18,-21)],.84,.93)
    for x in [-20,8]:
        craft.bench(x,-19.1,.8,2.4,0)
    # A broad landing makes the pier an intentional connection to the water.
    craft.pier()
    # Crates and a life ring belong to the harbour, rather than arbitrary decoration.
    for x,y in [(-13,-19.5),(-14.05,-19.5)]:
        box('Fish crate',(x,y,1.06),(.86,.64,.52),'Deep teal',.05)
        for i in range(3):box('Crate vent',(x-.27+i*.27,y-.328,1.06),(.16,.018,.26),'Gunmetal',.016)
    # Centre the ring in the first complete bay, on the accessible promenade
    # face. The cradle wraps the top rail and supports the ring from below.
    ring_x,ring_y,ring_z=-1.95,-20.75,1.37
    ring('Life ring',(ring_x,ring_y,ring_z),.38,.1,'Terracotta','y')
    for dx in [-.16,.16]:
        xx=ring_x+dx
        tube('Life ring rail clamp',[(xx,-21+math.cos(a)*.094,1.77+math.sin(a)*.094)
            for a in np.linspace(0,math.tau,33)[:-1]],.018,'Aluminium',True)
        tube('Life ring bent cradle',[(xx,-20.906,1.77),(xx,-20.91,1.62),
            (xx,-20.91,.905),(xx,-20.75,.905),(xx,-20.65,.94),
            (xx,-20.65,1.02)],.025,'Aluminium')
    planter(12.2,-19.4,scale=.9)
    # Street trees on the promenade sidewalk, each rooted in its own recessed
    # soil opening. Positions are irregular so the quay never reads as a row.
    for index,(tx,ty) in enumerate(realm.TREES[1:],1):
        small_tree(tx,ty,.87,'bed%d'%index,902+index*53)
    # A tiny glazed arrival board also preserves a readable sheltered edge.
    box('Harbour timetable',(-1.8,-19.4,1.9),(.95,.16,1.8),'Gunmetal',.065)
    for xx in [-2.13,-1.47]:cylinder('Timetable mounting post',(xx,-19.4,1),.055,.4,'Gunmetal',12)
    box('Timetable glazing',(-1.8,-19.49,1.9),(.78,.018,1.57),'Window glass',0)
    for zz in [1.5,1.8,2.1,2.4]:box('Printed timetable row',(-1.8,-19.51,zz),(.61,.012,.045),'Pale ceramic',0)
    b.status('Waterfront modeled')

def rear_rail():
    cartoon_station.build()


def move(objects,x,y,yaw):
    """Compose an assembly transform after resolving each object's placement."""
    bpy.context.view_layer.update()
    matrix=Matrix.Translation((x,y,0))@Matrix.Rotation(yaw,4,'Z')
    for obj in objects:obj.matrix_world=matrix@obj.matrix_world


def roof_garden(label,cx,cy,z,w,d):
    """A planted roof bed: a formed trough with leafy, irregular shrubs."""
    box(label+' roof bed',(cx,cy,z+.22),(w,.9,.44),'Mineral blue',.09)
    box(label+' roof bed soil',(cx,cy,z+.42),(w-.16,.68,.06),'Tree soil',.03)
    rng=random.Random(int(abs(cx)*73+abs(cy)*131))
    count=max(5,int(w/.40))
    for i in range(count):
        px=cx-w/2+.30+i*(w-.60)/max(1,count-1);py=cy+rng.uniform(-.20,.20)
        base=(px,py,z+.44);tip=(px+rng.uniform(-.14,.14),py+rng.uniform(-.14,.14),z+rng.uniform(.72,1.18))
        tube(label+' roof bed stem',[base,tip],.024,'Bark')
        for j in range(14):
            a=j*math.tau/14+rng.uniform(-.2,.2);r=rng.uniform(.05,.30)
            centre=(tip[0]+math.cos(a)*r,tip[1]+math.sin(a)*r,tip[2]+rng.uniform(-.14,.20))
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=5,location=centre)
            leaf=b.link(bpy.context.object,'Leaf light' if j%3==0 else 'Leaf');leaf.name=label+' roof bed leaf'
            leaf.scale=(.21,.16,.24);leaf.rotation_euler=(a,rng.uniform(-.4,.4),a)
            for face in leaf.data.polygons:face.use_smooth=True


def forecourt_shop(label,sx,sy,yaw,w,d,floors,roof):
    """A narrow shophouse: recessed glazed shopfront, awning, planted roof.

    The Galleria shrunk to a corner emporium, so the quay it released takes
    small hospitable blocks like the reference townscape rather than one large
    replacement mass. Built in a local frame facing -y, then placed.
    """
    before=set(b.GROUP.objects)
    hw,hd=w/2,d/2;front=-hd
    # Each shophouse takes one pastel accent for its awning, door and window
    # surrounds and one secondary for its plinth, piers and parapet, so the quay
    # reads as a row of different shops over one shared pale base, like the reference.
    slot=sum(map(ord,label))%3
    accent=('Awning coral','Mint enamel','Ochre plaster')[slot]
    secondary=('Mineral blue','Clay brick','Jade tile')[slot]
    box(label+' foundation',(0,0,.87),(w+.7,d+.7,.14),'Soot concrete',.04)
    # One continuous set-back envelope, with the shopfront fitted in front of it.
    box(label+' continuous envelope',(0,.2,(roof+.8)/2+.3),(w-.2,d-.4,roof-.6),'Dusty plaster',.13)
    box(label+' ground plinth',(0,front+.10,1.20),(w,.4,.62),secondary,.07)
    for xx in [-hw+.26,hw-.26]:box(label+' shopfront pier',(xx,front+.22,2.60),(.46,.62,3.34),secondary,.06)
    front_bay(0,front+.44,2.60,w-1.0,2.86,'Honey interior',frame='Trim cream',depth=1.5,mullions=[-w*.16,w*.16])
    box(label+' painted entrance door',(w*.30,front+.66,2.05),(w*.26,.14,2.3),accent,.04)
    box(label+' shop transom',(0,front+.22,4.34),(w-.24,.62,.42),accent,.06)
    # Fabric awning on cast brackets, with a rolled valance over the shop.
    awning=craft.profile_beam(label+' canvas awning',[(front+.44,4.74),(front-1.10,4.50),(front-1.10,4.30),(front+.44,4.08)],-hw+.34,hw-.34,0,accent)
    craft.soften(awning,.03,3)
    for xx in [-hw+.62,0,hw-.62]:tube(label+' awning bracket',[(xx,front+.36,4.82),(xx,front-1.02,4.62)],.026,'Copper')
    tube(label+' awning valance bar',[(-hw+.36,front-1.06,4.40),(hw-.36,front-1.06,4.40)],.032,'Copper')
    signed_board('QUAY SUPPLY CO',0,front+.44,5.08,w*.66,.54,'Pink neon')
    # Upper storeys: unequal window courses with occupied rooms behind them.
    # One course per storey above the shopfront, so nothing floats over the roof.
    for f in range(floors-1):
        z=5.90+f*3.45
        centres=[-w*.26,0,w*.26] if f%2==0 else [-w*.22,w*.22]
        lights=[['Honey interior',None,'Lagoon interior'],['Apricot interior','Honey interior']][f%2]
        facade_course(0,front,z,w-.2,3.15,centres,w*.20,1.92,'Dusty plaster',lights,frame=accent)
        if f==0:box(label+' concrete belt',(0,front+.06,z-1.52),(w+.12,.72,.16),'Trim cream',.03)
    # Side and rear services keep the quieter elevations inhabited: a rolled
    # blind over the ground-floor service bays and a blade sign on the flank.
    for zz in [zz for zz in (2.5,6.1,9.6) if zz<roof-1.1]:
        service_bay(-hw+.14,0,zz,1.5,1.8,-math.pi/2,'Lagoon interior' if zz==6.1 else None)
        service_bay(hw-.14,0,zz,1.5,1.8,math.pi/2,None)
    box(label+' flank rolled blind',(hw+.04,0,4.80),(.10,d-1.0,.17),'Canvas fabric',.04)
    signed_board(label.split()[-1].upper(),hw+.18,0,5.42,1.4,.86,'Cyan neon',side=True)
    pipe([(hw+.05,d*.32,1.1),(hw+.05,d*.32,roof+.5)],.075,'Copper')
    wall_ac(hw+.16,-d*.20,max(roof-.9,3.4))
    # Planted parapet roof with a stair cabin, a tank and a hanging garden.
    slab(label+' roof coping',(0,.2),w+.1,d,roof,.24,'Trim cream',.18)
    for xx in [-hw,hw]:box(label+' roof parapet',(xx,.2,roof+.58),(.26,d+.2,.6),secondary,.04)
    for yy in [.2-hd,.2+hd]:box(label+' roof parapet',(0,yy,roof+.58),(w+.2,.26,.6),secondary,.04)
    box(label+' rooftop stair room',(-hw+1.0,.2+hd-1.0,roof+1.12),(1.9,1.9,2.05),secondary,.1)
    box(label+' stair room cap',(-hw+1.0,.2+hd-1.0,roof+2.24),(2.14,2.14,.16),'Gunmetal',.04)
    if floors>1:
        cylinder(label+' roof water tank',(hw-1.05,.2+hd-1.15,roof+1.02),.82,1.55,'Oxidized metal',24)
        for zz in [roof+.5,roof+1.45]:ring(label+' tank strap',(hw-1.05,.2+hd-1.15,zz),.83,.05,'Gunmetal')
        b.hvac(hw-1.15,.2-hd+.95,roof+.28,.8)
    roof_garden(label,-hw+1.5,.2-hd+.72,roof+.06,w-3.4,.9)
    move(set(b.GROUP.objects)-before,sx,sy,yaw)


def freed_quarter():
    """Shophouses on the quay released by the shrunken Galleria."""
    b.collection('08 · Forecourt shops')
    forecourt_shop('Quay corner shop',42.60,9.60,0,5.2,6.4,2,7.90)
    forecourt_shop('Quay long shop',49.90,9.60,0,5.6,6.4,3,11.35)
    forecourt_shop('Quay market hall',34.60,-4.20,-math.pi/2,6.6,3.6,2,7.90)
    b.status('Galleria forecourt shops modeled')


def build():
    palette()
    b.CJK=None
    ground();repair_house();workshop();teahouse();stop();waterfront();rear_rail();harbor_mall.build();freed_quarter();toyshop.build(surface);night_identity.build();b.vehicles()
    # Fail the rebuild on visual geometry regressions, before consolidation
    # removes the object names needed for sightline and clearance checks.
    validation=Path(__file__).with_name('validate_scene.py')
    exec(compile(validation.read_text(),str(validation),'exec'),{'__file__':str(validation)})
    bpy.ops.wm.save_as_mainfile(filepath=str(b.SOURCE/'nocturne-source.blend'))
    b.export_assets();b.presentation()
    s=bpy.context.scene;s.camera.data.ortho_scale=119
    s.camera.location=(78,-88,72);s.camera.rotation_euler=(Vector((7,0,6))-s.camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.wm.save_as_mainfile(filepath=str(b.SOURCE/'nocturne-harbor.blend'))
    path=b.OUT/'manifest.json';manifest=json.loads(path.read_text());manifest['design']='Lantern Ward / shopping quarter and harbor toy emporium';path.write_text(json.dumps(manifest,indent=2))
    b.status('complete')

if __name__=='__main__':
    try:build()
    except Exception:
        b.status('failed',error=traceback.format_exc());raise

