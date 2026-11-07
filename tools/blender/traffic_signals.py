"""Small reference-led signal assemblies at the waterfront crossing, in metres."""
import json
import math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix
import build_city as b
import craftsmanship as craft
import public_realm as realm
from detailed_assets import mesh_object

CONFIG=json.loads((Path(__file__).resolve().parents[2]/'src/trafficConfig.json').read_text())
ASPECTS={'Traffic red':'#ff443a','Traffic amber':'#ffc13c','Traffic green':'#53ef9c',
         'Pedestrian red':'#ff443a','Pedestrian green':'#53ef9c'}


def lens_materials():
    for name,colour in ASPECTS.items():
        mat=b.material(name,colour,.26,.08,emit=3.2,texture=True)
        # Concentric Fresnel ridges and small LED cells under a moulded lens.
        n=256;y,x=np.mgrid[0:n,0:n]/(n-1)*2-1;r=np.sqrt(x*x+y*y)
        relief=.018*np.sin(r*math.tau*16)+.006*np.cos(x*math.pi*32)*np.cos(y*math.pi*32)
        normal=np.ones((n,n,4),np.float32)
        normal[:,:,0]=.5+(np.roll(relief,1,1)-np.roll(relief,-1,1))*2
        normal[:,:,1]=.5+(np.roll(relief,1,0)-np.roll(relief,-1,0))*2
        nodes=mat.node_tree.nodes;links=mat.node_tree.links
        normal_image=next(node.image for node in nodes if node.type=='TEX_IMAGE' and 'grain normal' in node.image.name)
        normal_image.pixels.foreach_set(normal.ravel());normal_image.pack()
        tex=nodes.new('ShaderNodeTexImage');tex.image=next(node.image for node in nodes if node.type=='TEX_IMAGE' and 'albedo' in node.image.name)
        uv=next(node for node in nodes if node.type=='UVMAP');links.new(uv.outputs['UV'],tex.inputs['Vector'])
        links.new(tex.outputs['Color'],nodes['Principled BSDF'].inputs['Emission Color'])


def lens(name,z,mat,signals):
    previous=b.GROUP;b.GROUP=signals
    # A shallow convex optical cap, not a flat luminous disc over a solid case.
    rings=6;sides=32;radius=.139;vertices=[]
    for j in range(rings+1):
        rr=radius*j/rings
        for i in range(sides):
            a=math.tau*i/sides
            vertices.append((rr*math.cos(a),-.251-.026*(1-(rr/radius)**2),z+rr*math.sin(a)))
    faces=[]
    for j in range(rings):
        for i in range(sides):
            a=j*sides+i;c=j*sides+(i+1)%sides;faces.append((a,a+sides,c+sides,c))
    obj=mesh_object(name,vertices,faces,mat,True)
    # Merge the coincident centre into a proper fan before export.
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    uv=obj.data.uv_layers.new(name='DetailUV')
    for loop in obj.data.loops:
        v=obj.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(v.x/(2*radius)+.5,(v.z-z)/(2*radius)+.5)
    obj['preserveDetailUV']=True;obj['signalAspect']=mat
    b.GROUP=previous


def visor(z):
    outer=[(.183*math.cos(a),z+.183*math.sin(a)) for a in np.linspace(-.12,math.pi+.12,25)]
    inner=[(.164*math.cos(a),z+.164*math.sin(a)) for a in np.linspace(math.pi+.12,-.12,25)]
    obj=craft.profile_beam('Traffic curved open lens visor',outer+inner,-.36,-.215,1,'Burgundy enamel')
    craft.soften(obj,.007,2)


def pedestrian_head(signals):
    before=set(bpy.data.objects)
    case=craft.profile_beam('Pedestrian sealed signal case',b.rounded(0,2.55,.40,.78,.08,8),-.19,.07,1,'Burgundy enamel')
    craft.soften(case,.025,3)
    for z in [2.76,2.36]:
        b.box('Pedestrian inset dark display',(0,-.205,z),(.32,.028,.30),'Vehicle glazing',.04)
    # Illuminated stencil pictograms, not figures standing in the street.
    previous=b.GROUP;b.GROUP=signals
    for z,mat,walking in [(2.76,'Pedestrian red',False),(2.36,'Pedestrian green',True)]:
        lamp=b.cylinder('Pedestrian LED head',(0,-.228,z+.084),.031,.009,mat,16,(math.pi/2,0,0))
        lamp['pedestrianAspect']=mat
        paths=[[(0,.043),(0,-.040)], [(-.035,.025),(-.055,-.035)],[(.035,.025),(.055,-.035)],
               [(-.018,-.032),(-.026,-.110)],[(.018,-.032),(.026,-.110)]] if not walking else [
               [(.014,.044),(-.012,-.033)],[(-.006,.018),(-.064,-.018)],[ (.016,.014),(.065,-.004)],
               [(-.012,-.025),(-.070,-.099)],[(-.012,-.025),(.048,-.104)]]
        for path in paths:b.tube('Pedestrian LED stencil',[(x,-.232,z+zz) for x,zz in path],.016,mat)
    b.GROUP=previous
    b.box('Pedestrian mounting saddle',(0,.10,2.55),(.15,.22,.46),'Aluminium',.03)
    # Far-side display: face across the carriageway toward the opposite pavement.
    # Rotate the complete housing, optics and saddle together around the mast.
    transform=Matrix.Translation((-.19,0,0))@Matrix.Rotation(-math.pi/2,4,'Z')
    bpy.context.view_layer.update()
    for obj in set(bpy.data.objects)-before:obj.matrix_world=transform@obj.matrix_world
    # The button stays accessible from this pole's own pavement.
    before=set(bpy.data.objects)
    b.box('Pedestrian push button cabinet',(0,-.02,1.89),(.24,.23,.35),'Copper',.05)
    b.cylinder('Pedestrian recessed push button',(0,-.145,1.89),.066,.014,'Pale ceramic',24,(math.pi/2,0,0))
    transform=Matrix.Translation((.19,0,0))@Matrix.Rotation(math.pi/2,4,'Z')
    bpy.context.view_layer.update()
    for obj in set(bpy.data.objects)-before:obj.matrix_world=transform@obj.matrix_world


def build():
    static=b.GROUP
    signals=b.collection('Signals');b.GROUP=static
    lens_materials()
    templates=[]
    for pole_index,pole in enumerate(CONFIG['poles']):
        if pole_index:
            transform=Matrix.Translation((pole['x'],pole['y'],0))@Matrix.Rotation(math.radians(pole['headingDegrees']),4,'Z')
            for original,local_matrix in templates:
                obj=original.copy()
                for collection in original.users_collection:collection.objects.link(obj)
                obj.matrix_world=transform@local_matrix;obj['trafficSignal']=pole['id']
            continue
        before=set(bpy.data.objects)
        b.cylinder('Traffic tapered mast',(0,0,2.35),.072,3.10,'Aluminium',24,r2=.057)
        b.slab('Traffic flush mounting shoe',(0,0),.25,.25,.802,.028,'Aluminium',.045)
        b.cylinder('Traffic mast cap',(0,0,3.925),.07,.07,'Aluminium',24,r2=.045)
        shell=craft.profile_beam('Traffic moulded continuous housing',b.rounded(0,3.35,.48,1.28,.12,10),-.225,.045,1,'Burgundy enamel')
        cutters=[b.cylinder('Temporary signal socket',(0,-.238,z),.15,.19,'Gunmetal',40,(math.pi/2,0,0)) for z in [3.73,3.35,2.97]]
        realm.apply_difference(shell,cutters);craft.soften(shell,.018,3)
        for z,colour in [(3.73,'red'),(3.35,'amber'),(2.97,'green')]:
            b.ring('Traffic lens seating gasket',(0,-.242,z),.151,.015,'Gunmetal','y')
            visor(z);lens('Traffic optical '+colour,z,'Traffic '+colour,signals)
        for z in [2.88,3.82]:
            b.box('Traffic rear mounting saddle',(0,.066,z),(.19,.19,.09),'Aluminium',.02)
        b.box('Traffic sealed service cover',(0,.058,3.35),(.33,.035,.69),'Burgundy enamel',.065)
        for z in [3.10,3.60]:b.cylinder('Traffic service fastener',(0,.08,z),.023,.015,'Aluminium',6,(math.pi/2,0,0))
        pedestrian_head(signals)
        bpy.context.view_layer.update()
        templates=[(obj,obj.matrix_world.copy()) for obj in sorted(set(bpy.data.objects)-before,key=lambda obj:obj.name)]
        for index,(obj,_) in enumerate(templates):obj['signalPart']=index
        transform=Matrix.Translation((pole['x'],pole['y'],0))@Matrix.Rotation(math.radians(pole['headingDegrees']),4,'Z')
        for obj,_ in templates:
            obj.matrix_world=transform@obj.matrix_world;obj['trafficSignal']=pole['id']
    # Flush paint marks: one stop line controlling the existing one-way taxi circuit.
    b.box('Signal crossing stop line',(CONFIG['stopLineX'],CONFIG['roadY'],.646),(.22,4.03,.009),'Pale ceramic',0)
    # Restore the approved six broad zebra stripes, as thin flush road paint.
    for i in range(6):
        b.box('Waterfront zebra crossing',(CONFIG['crossingX'],-16.7+i*.6,.646),(1.35,.3,.009),'Pale ceramic',0)
    b.status('Waterfront signals modeled')
