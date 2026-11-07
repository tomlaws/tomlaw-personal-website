"""Loop Picturehouse: an original Art Deco cinema miniature, authored in Blender.

Reference-led massing and joinery; see reference/asset-references.md.
"""
import math
import bpy
import build_city as b
import craftsmanship as craft
import public_realm as realm
from detailed_assets import mesh_object, glass_panel


def poster(name,x,y,z,w,h,variant=0):
    """A framed, glazed abstract film poster, built as shallow graphic relief."""
    b.box(name+' brass case',(x,y,z),(w,.14,h),'Copper',.04)
    b.box(name+' printed paper',(x,y-.079,z),(w-.12,.012,h-.13),'Burgundy enamel',.008)
    # Original eclipse / mountain graphics, no downloaded image or lettering.
    b.cylinder(name+' eclipse',(x-w*.12,y-.091,z+h*.13),w*.26,.009,'Awning cream',48,(math.pi/2,0,0))
    if variant:
        b.cylinder(name+' shadow',(x-w*.04,y-.099,z+h*.2),w*.22,.009,'Deep teal',48,(math.pi/2,0,0))
    pts=[(x-w*.43,y-.108,z-h*.35),(x-w*.12,y-.108,z+h*.03),(x+w*.05,y-.108,z-h*.16),(x+w*.30,y-.108,z+h*.21),(x+w*.43,y-.108,z-h*.35)]
    mesh_object(name+' landscape print',pts,[tuple(range(5))],'Deep teal')
    for i in range(3):b.box(name+' credit line',(x,y-.113,z-h*.39-i*.058),(w*(.53-i*.07),.008,.018),'Awning cream',0)
    glass_panel(name+' protective glass',[(x-w*.44,y-.125,z-h*.45),(x+w*.44,y-.125,z-h*.45),(x+w*.44,y-.125,z+h*.45),(x-w*.44,y-.125,z+h*.45)])


def build(api):
    api.surface('Cinema terracotta','#c87a52',.76)
    b.collection('02 · Loop picturehouse')
    # A single boolean-unioned masonry envelope, with true hollow rooms.
    # Rounded plan corners wrap continuously into the side and rear elevations.
    outline=b.rounded(10.65,7.54,11.1,9.12,.56,12)
    b.poly('Cinema continuous terrazzo floor',outline,.8,.15,'Paving stone',.025)
    shell=b.poly('Cinema continuous rounded masonry shell',outline,.8,7.92,'Dusty plaster',0)
    tower=b.poly('Temporary integrated sign tower',b.rounded(6.5,3.985,2.8,2.01,.56,12),.8,10.4,'Dusty plaster',0)
    bpy.context.view_layer.objects.active=shell
    union=shell.modifiers.new('Continuous masonry union','BOOLEAN');union.operation='UNION';union.solver='EXACT';union.object=tower
    bpy.ops.object.modifier_apply(modifier=union.name);bpy.data.objects.remove(tower,do_unlink=True)
    void=b.poly('Temporary auditorium void',b.rounded(10.65,7.54,10.3,8.32,.18,12),.65,7.37,'Gunmetal',0)
    roof_well=b.poly('Temporary parapet well',b.rounded(10.65,7.74,10.3,7.92,.24,12),8.23,1.6,'Gunmetal',0)
    # The roof recess must stop at the tower, not scoop a cavity into its back.
    tower_protect=b.poly('Temporary protected tower',b.rounded(6.5,3.985,2.8,2.01,.56,12),8.1,2.0,'Gunmetal',0)
    realm.apply_difference(roof_well,[tower_protect])
    # Recesses meet the unchanged lobby glazing, and the existing lift landing.
    door=b.box('Temporary lobby aperture',(11.565,3.2,2.60),(7.15,1.5,3.4),'Gunmetal',0)
    landing=b.box('Temporary landing aperture',(16,8.2,5.90),(1.2,1.86,2.40),'Gunmetal',0)
    window=craft.profile_beam('Temporary upper window',b.rounded(11.65,6.50,6.6,1.60,.30,12),2.5,3.65,1,'Gunmetal')
    lightwell=b.box('Temporary rooflight aperture',(10.1,8.55,8.2),(4.7,2.05,1.0),'Gunmetal',0)
    # The service door is cut through the shell too, not painted on its surface.
    rear=b.box('Temporary rear door aperture',(8.4,11.97,2.35),(1.7,1.0,2.64),'Gunmetal',0)
    realm.apply_difference(shell,[void,roof_well,door,landing,window,lightwell,rear])
    craft.soften(shell,.045,3)
    for face in shell.data.polygons:face.use_smooth=True
    shell['continuousEnvelope']=True
    b.box('Cinema mezzanine floor',(10.7,8.16,4.57),(10.64,7.56,.26),'Paving stone',.03)
    for yy in [7.34,9.06]:b.box('Cinema landing bronze jamb',(16.22,yy,5.90),(.15,.10,2.40),'Burgundy enamel',.015)
    glass_panel('Cinema mezzanine glass door',[(16.23,7.40,4.75),(16.23,9.00,4.75),(16.23,9.00,7.03),(16.23,7.40,7.03)])
    b.box('Cinema door meeting stile',(16.25,8.2,5.9),(.08,.05,2.33),'Copper',.01)
    b.box('Cinema landing door head',(16.22,8.2,7.075),(.15,1.82,.09),'Burgundy enamel',.015)
    for yy in [8.03,8.37]:b.tube('Cinema landing door handle',[(16.32,yy,5.55),(16.4,yy,5.61),(16.4,yy,6.06),(16.32,yy,6.13)],.029,'Copper')
    # Complete ceiling-lit entrance volume with visible concession furniture.
    api.front_bay(11.55,2.78,2.61,7.0,3.22,'Honey interior','Burgundy enamel',depth=3.5,mullions=[.65,1.75],mullion_width=.10)
    for x in [12.37,13.17]:b.tube('Cinema entrance bronze pull',[(x,2.57,1.95),(x,2.50,2.04),(x,2.50,2.52),(x,2.57,2.61)],.03,'Copper')
    b.box('Cinema entrance threshold',(12.75,2.65,.90),(2.34,.40,.10),'Burgundy enamel',.015)
    b.slab('Cinema curved ticket counter',(9.35,4.45),2.10,1.00,.96,.99,'Burgundy enamel',.42)
    b.slab('Cinema polished counter lip',(9.35,4.45),2.22,1.08,1.95,.085,'Copper',.44)
    for xx in [8.63,8.89,9.15,9.41,9.67,9.93]:
        b.cylinder('Cinema counter timber flute',(xx,3.96,1.47),.047,.83,'Wood',12)
    b.box('Cinema ticket terminal',(9.16,4.23,2.21),(.52,.20,.36),'Gunmetal',.055,rot=(-.17,0,0))
    b.box('Cinema terminal glass',(9.16,4.115,2.23),(.40,.012,.23),'Window glass',0,rot=(-.17,0,0))
    b.cylinder('Cinema ticket roll',(8.74,4.34,2.16),.12,.17,'Awning cream',20,(0,math.pi/2,0))
    b.box('Cinema counter tickets',(8.73,4.06,2.046),(.15,.27,.012),'Awning cream',0)
    # A miniature popcorn cabinet has transparent faces and separate contents.
    b.slab('Cinema popcorn base',(10.05,4.52),.60,.55,2.04,.12,'Copper',.08)
    for x in [9.77,10.33]:
        for y in [4.27,4.77]:b.cylinder('Cinema popcorn upright',(x,y,2.47),.025,.72,'Copper',10)
    glass_panel('Cinema popcorn display',[(9.79,4.265,2.16),(10.31,4.265,2.16),(10.31,4.265,2.82),(9.79,4.265,2.82)])
    b.slab('Cinema popcorn cap',(10.05,4.52),.64,.60,2.82,.12,'Burgundy enamel',.10)
    for i in range(18):
        xx=9.85+(i%4)*.13;yy=4.33+((i//4)%3)*.13;zz=2.22+.05*(i%3)
        b.cylinder('Cinema popcorn kernel',(xx,yy,zz),.055,.08,'Awning cream',7)
    for yy in [4.30,5.40]:
        b.slab('Cinema lobby upholstered seat',(14.25,yy),.65,.69,1.27,.16,'Burgundy enamel',.20)
        b.box('Cinema lobby contoured back',(14.52,yy,1.70),(.14,.64,.74),'Burgundy enamel',.07,rot=(0,-.16,0))
        for xx in [14.0,14.45]:b.cylinder('Cinema lobby chair foot',(xx,yy,1.11),.035,.30,'Copper',12)
    poster('Cinema foyer poster',11.70,6.18,2.70,1.05,1.72,1)
    # The approved pavement poster remains flush on the integrated entrance wing.
    poster('Cinema pavement poster',6.45,2.985,2.55,1.46,2.35)
    # A broad recessed ribbon window replaces the oculus and applied round fins.
    outer=b.rounded(11.65,6.5,6.52,1.52,.26,12)
    inner=b.rounded(11.65,6.5,6.25,1.25,.18,12)
    n=len(outer);vertices=[]
    for y in [3.045,3.235]:
        for loop in [outer,inner]:vertices += [(x,y,z) for x,z in loop]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,j+n,i+n),(i+2*n,i+3*n,j+3*n,j+2*n),
                  (i,i+2*n,j+2*n,j),(i+n,j+n,j+3*n,i+3*n)]
    frame=mesh_object('Cinema fitted bronze ribbon frame',vertices,faces,'Copper')
    import bmesh
    bm=bmesh.new();bm.from_mesh(frame.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(frame.data);bm.free()
    craft.soften(frame,.018,3)
    glazing=mesh_object('Cinema recessed ribbon glazing',[(x,3.245,z) for x,z in inner],[tuple(range(len(inner)))],'Window glass')
    glazing.modifiers.new('Glass thickness','SOLIDIFY').thickness=.012
    for xx in [10.58,12.72]:b.box('Cinema ribbon window mullion',(xx,3.185,6.5),(.065,.13,1.25),'Copper',.015)
    b.room_panel('Cinema projection booth rear',(11.65,5.12,6.50),6.65,1.70,'Apricot interior')
    craft.room_lining('Cinema booth continuous bounce',11.65,3.26,5.11,6.50,6.65,1.70,'Apricot interior')
    b.box('Cinema booth recessed ceiling luminaire',(11.65,4.1,7.26),(4.80,.16,.045),'Warm neon',.01)
    # The tower grows out of the shell; its sign is seated in a shallow recess.
    b.box('Cinema recessed vertical sign',(6.525,2.865,7.78),(1.37,.23,5.20),'Burgundy enamel',.22)
    lettering=b.text('Cinema LOOP neon','L\nO\nO\nP',(6.525,2.729,9.42),.94,'Warm neon');lettering.data.space_line=1.03
    for x in [5.98,7.07]:b.tube('Cinema pylon neon edge',[(x,2.72,5.41),(x,2.72,10.11)],.041,'Pink neon')
    b.sign_light('Cinema pylon pink spill',(6.525,2.73,7.75),1.48,5.25,'#ed7994',34)
    # One flush cream coping follows the entire curved perimeter, without butt joints.
    rim=b.poly('Cinema continuous parapet coping',b.rounded(10.65,7.54,11.14,9.16,.58,12),8.69,.10,'Ochre plaster',0)
    rim_void=b.poly('Temporary coping interior',b.rounded(10.65,7.54,10.25,8.27,.19,12),8.5,.5,'Gunmetal',0)
    tower_void=b.poly('Temporary coping tower clearance',b.rounded(6.5,3.985,2.84,2.05,.58,12),8.5,.5,'Gunmetal',0)
    realm.apply_difference(rim,[rim_void,tower_void]);craft.soften(rim,.025,3)
    # A deep, faceted marquee with a warm coffered underside.
    canopy=[(7.57,3.10),(16.25,3.10),(16.30,1.80),(14.35,.86),(8.30,.86),(7.15,1.80)]
    b.poly('Cinema faceted marquee',canopy,4.09,.29,'Burgundy enamel',.06)
    b.poly('Cinema marquee ivory crown',canopy,4.38,.13,'Ochre plaster',.035)
    b.tube('Cinema continuous marquee neon',[(x,y,4.16) for x,y in canopy],.037,'Warm neon',True)
    for xx in [8.40,9.45,10.50,11.55,12.60,13.65,14.70]:
        b.box('Cinema marquee ceiling coffer',(xx,2.04,4.07),(.80,1.40,.035),'Copper',.024)
        b.box('Cinema recessed canopy lamp',(xx,2.04,4.043),(.58,.09,.022),'Warm neon',.008)
    api.signed_board('PICTUREHOUSE',11.36,.79,4.30,5.40,.42,'Warm neon','Burgundy enamel')
    b.area('Cinema lobby ceiling',(11.25,4.35,4.10),'#ffd2a3',78,4.8,(11.25,4.35,1.0),dimensions=(5.8,2.1))
    b.area('Cinema marquee downlight',(11.50,1.90,4.01),'#ffcdb1',52,4.8,(11.50,1.90,.8),dimensions=(5.8,1.4))
    # The roof sits inside the continuous parapet, with a real daylight opening.
    roof=b.poly('Cinema auditorium roof',b.rounded(10.65,7.54,10.36,8.38,.20,12),8.025,.215,'Cinema terracotta',0)
    opening=b.box('Temporary cinema rooflight opening',(10.1,8.55,8.13),(4.7,2.05,.9),'Gunmetal',0)
    realm.apply_difference(roof,[opening]);craft.soften(roof,.02,3)
    # A low, rolled-edge monitor replaces the mismatched wedge-and-box roof assembly.
    rooflight=craft.profile_beam('Cinema formed rooflight casing',b.rounded(10.1,8.80,5.05,1.20,.22,12),7.38,9.72,1,'Burgundy enamel')
    opening=b.box('Temporary rooflight glazing recess',(10.1,8.55,8.80),(4.7,2.05,2.2),'Gunmetal',0)
    realm.apply_difference(rooflight,[opening]);craft.soften(rooflight,.025,3)
    glass_panel('Cinema rooflight glazing',[(7.75,7.525,9.23),(12.45,7.525,9.23),(12.45,9.575,9.23),(7.75,9.575,9.23)])
    for xx in [9.32,10.88]:b.box('Cinema rooflight bronze glazing bar',(xx,8.55,9.255),(.065,2.13,.09),'Copper',.014)
    b.hvac(14.25,10.20,8.24,.70)
    # Rebuilt mezzanine landing and terrace keep the existing lift datums; the
    # public stair was removed on request, so the mezzanine is served inside.
    b.box('Workshop external terrace',(17.625,8.2,4.57),(2.85,2.1,.26),'Paving stone',.045)
    b.box('Cinema landing bridge',(16.10,8.2,4.57),(.75,2.1,.26),'Paving stone',.035)
    b.railing([(16.15,9.25),(18.97,9.25)],4.7,.92)
    for x in [17.00,18.65]:b.cylinder('Cinema landing steel column',(x,8.64,2.62),.14,3.64,'Burgundy enamel',16)
    craft.lift_shaft()
    # Secondary entrances and deeply recessed service windows finish rear views.
    api.service_bay(8.4,12.115,2.35,1.6,2.5,math.pi,'Honey interior')
    b.status('Loop picturehouse modeled')
