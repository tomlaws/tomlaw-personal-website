"""Connected public-realm geometry: recessed streets, tree soil and inlaid rail."""
import math
import bpy
from mathutils import Vector
import build_city as b

ROAD_TOP=.64
PAVING_TOP=.8
# Established waterfront tree, then three later plantings across the plaza, the
# Galleria forecourt and the western promenade. Spacing stays irregular so the
# island never reads as an even row of trees.
TREES=((16,-2.5),(19,-11.6),(34,-14.5),(-30,-14.5),(34.2,3.6),(56.6,13.0))
TREE_BED=(3.2,2.6,.48)


def quay_outline():
    """One plan profile shared by the paving, coping and retaining wall.

    Generous convex corners and a smaller concave return keep the existing
    waterfront step, without sharp tips or differently bevelled layer outlines.
    """
    corners=[(-43.8,-19.8,2.2,180,270),
             (18.25,-21.25,.75,270,360),
             (19.75,-20.75,.75,180,90),
             (60.8,-17.8,2.2,270,360),
             (59,28,4,0,90),
             (-32,28,4,90,180),
             (-32,23,4,180,270),
             (-31,17,2,90,0),
             (-32,13,3,0,-90),
             (-43,7,3,90,180)]
    return [(cx+r*math.cos(math.radians(a+(end-a)*i/24)),
             cy+r*math.sin(math.radians(a+(end-a)*i/24)))
            for cx,cy,r,a,end in corners for i in range(25)]


def street_corners():
    """Concentric road bends, with width changes confined to the straights."""
    radius=1.5
    outer_radius=radius+4.2
    for cx,cy,start in [(19.9,-11.65,-90),(19.9,10.35,0),
                        (-19.9,10.35,90),(-19.9,-11.65,180)]:
        angles=[math.radians(start+i*90/32) for i in range(33)]
        outer=[(cx+outer_radius*math.cos(a),cy+outer_radius*math.sin(a)) for a in angles]
        inner=[(cx+radius*math.cos(a),cy+radius*math.sin(a)) for a in reversed(angles)]
        b.poly('Continuous road turn',outer+inner,.79,.04,'Street asphalt',0)
    # Round the four plot corners where the central lane meets the wider roads.
    # These small asphalt sectors are excavated with the rest of the network.
    for sx in [-1,1]:
        for y,sy in [(-13.15,1),(12.55,-1)]:
            x=sx*1.65
            local=[(-.03,-.03),(radius,-.03)]
            local += [(radius+radius*math.cos(math.radians(270-i*90/24)),
                       radius+radius*math.sin(math.radians(270-i*90/24))) for i in range(25)]
            local += [(-.03,radius)]
            points=[(x+sx*u,y+sy*v) for u,v in local]
            if sx*sy<0:points.reverse()
            b.poly('Continuous road turn junction',points,.79,.04,'Street asphalt',0)


def street_straights():
    """Keep the waterfront even-width, with a narrower rear service lane.

    The outer edges stay straight. Smooth inner-edge tapers connect each
    rear lane to a 4.2 m bend, without changing width halfway around the turn.
    """
    for name,outer_y,inner_y,end_y,start_x in [
        ('Waterfront main street',-17.35,-13.15,-13.15,14.5),
        ('Rear service lane',16.05,12.55,11.85,18.0),
    ]:
        edge=[]
        for i in range(25):
            t=i/24;s=t*t*(3-2*t)
            edge.append((start_x+(19.9-start_x)*t,inner_y+(end_y-inner_y)*s))
        inner=[(-x,y) for x,y in reversed(edge)]+edge
        points=[(-19.9,outer_y),(19.9,outer_y)]+list(reversed(inner))
        if outer_y>inner_y:points.reverse()
        b.poly(name,points,.79,.04,'Street asphalt',0)
    for x in [-23.5,23.5]:
        b.box('Side access street',(x,-.65,.81),(4.2,22.0,.04),'Street asphalt',0)


def apply_difference(ground,cutters):
    bpy.context.view_layer.update()
    collection=bpy.data.collections.new('Temporary excavation cutters')
    bpy.context.scene.collection.children.link(collection)
    for obj in cutters:
        for c in list(obj.users_collection):c.objects.unlink(obj)
        collection.objects.link(obj)
    bpy.context.view_layer.objects.active=ground
    modifier=ground.modifiers.new('Excavate connected infrastructure','BOOLEAN')
    modifier.operation='DIFFERENCE';modifier.solver='EXACT'
    modifier.operand_type='COLLECTION';modifier.collection=collection
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for obj in list(collection.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(collection)


def join_asphalt(roads):
    """Union the road volumes so coplanar overlaps cannot bake dark seams."""
    base=roads[0]
    collection=bpy.data.collections.new('Temporary asphalt union')
    bpy.context.scene.collection.children.link(collection)
    for obj in roads[1:]:
        for c in list(obj.users_collection):c.objects.unlink(obj)
        collection.objects.link(obj)
    bpy.context.view_layer.objects.active=base
    modifier=base.modifiers.new('One connected asphalt surface','BOOLEAN')
    modifier.operation='UNION';modifier.solver='EXACT';modifier.use_self=True
    modifier.operand_type='COLLECTION';modifier.collection=collection
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for obj in list(collection.objects):bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(collection)
    base.name='Connected recessed asphalt'
    base['surfaceHeight']=ROAD_TOP


def recess_streets():
    """Cut infrastructure into the continuous paving, preserving the quay edge."""
    ground=bpy.data.objects['Continuous neighbourhood ground']
    roads=[o for o in b.GROUP.objects if o.name.startswith(('Waterfront main street','Rear service lane','Side access street','Continuous road turn','Workshop delivery lane'))]
    bpy.context.view_layer.update()
    cutters=[]
    for road in roads:
        points=[road.matrix_world@v.co for v in road.data.vertices]
        lo=min(v.z for v in points);hi=max(v.z for v in points)
        cutpoints=[(p.x,p.y,.62 if p.z<(lo+hi)/2 else 2.0) for p in points]
        mesh=bpy.data.meshes.new('Street excavation');mesh.from_pydata(cutpoints,[],[tuple(p.vertices) for p in road.data.polygons]);mesh.update();mesh.materials.append(b.M['Paving stone'])
        obj=bpy.data.objects.new('Street excavation',mesh);b.GROUP.objects.link(obj);cutters.append(obj)
        road.location.z+=ROAD_TOP-hi
        road['surfaceHeight']=ROAD_TOP
    # The MTR now runs overhead; the forecourt below stays continuous and flush.
    for index,(tx,ty) in enumerate(TREES):
        cutters.append(b.poly('Tree planting opening'+(' %d'%index if index else ''),
                              b.rounded(tx,ty,*TREE_BED,8),.62,1.4,'Tree soil',0))
    cutters.append(b.box('Lift floor pit cutter',(20,8.2,1.3),(1.8,1.8,1.36),'Paving stone',0))
    apply_difference(ground,cutters)
    join_asphalt(roads)
    # Round the exposed street lips.
    weights=ground.data.attributes.new('bevel_weight_edge','FLOAT','EDGE')
    adjacent={}
    for p in ground.data.polygons:
        for key in p.edge_keys:adjacent.setdefault(tuple(sorted(key)),[]).append(p)
    for edge in ground.data.edges:
        verts=[ground.data.vertices[i].co for i in edge.vertices]
        faces=adjacent.get(tuple(sorted(edge.vertices)),[])
        if all(abs(v.z-PAVING_TOP)<.0001 for v in verts) and any(min(ground.data.vertices[i].co.z for i in f.vertices)<.65 for f in faces):
            weights.data[edge.index].value=1
    bevel=ground.modifiers.new('Soft continuous pavement arris','BEVEL')
    bevel.limit_method='WEIGHT';bevel.width=.028;bevel.segments=3
    bevel.affect='EDGES'
    bpy.context.view_layer.objects.active=ground;bpy.ops.object.modifier_apply(modifier=bevel.name)
    ground['roadDatum']=ROAD_TOP
    # Markings and covers belong on the new asphalt datum.
    for obj in b.GROUP.objects:
        if obj.name.startswith(('Broken road centre line','Waterfront zebra crossing','Side lane crossing','Iron manhole','Manhole rim')):
            obj.location.z-=.19
    # Broad, flush dropped crossings are carved into the same pedestrian slab.
    # Slope is 16 cm over 1.6 m; the corners feather into the adjacent footpath.
    ramps=[(4.8,-17.35,-1,0),(4.8,-13.15,1,0),(-25.6,-4.8,-1,1),(-21.4,-4.8,1,1),
           (21.4,-4.8,-1,1),(25.6,-4.8,1,1)]
    for cx,cy,direction,side in ramps:
        verts=[]
        for across in [-1.5,-.82,.82,1.5]:
            for t in [0,1]:
                depth=.157*(1-t)*(1 if abs(across)<1 else 0)
                x,y=(cx+direction*t*1.6,cy+across) if side else (cx+across,cy+direction*t*1.6)
                verts.append((x,y,.801-depth))
        faces=[(i*2,i*2+1,(i+1)*2+1,(i+1)*2) for i in range(3)]
        # Closed cutter above the sloping ramp profile.
        top=[(x,y,1.5) for x,y,z in verts];n=len(verts)
        border=[0,2,4,6,7,5,3,1]
        faces=[tuple(reversed(f)) for f in faces]+[tuple(i+n for i in f) for f in faces]+[(a,c,c+n,a+n) for a,c in zip(border,border[1:]+border[:1])]
        mesh=bpy.data.meshes.new('Dropped crossing profile');mesh.from_pydata(verts+top,[],faces);mesh.update();mesh.materials.append(b.M['Paving stone'])
        # Recalculate winding so mirrored ramps have closed outward normals.
        import bmesh
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        obj=bpy.data.objects.new('Dropped crossing cutter',mesh);b.GROUP.objects.link(obj)
        apply_difference(ground,[obj])


def tree_soil():
    # The tree grows from earth below paving level, not from a decorative plinth.
    import random
    for index,(tx,ty) in enumerate(TREES):
        b.poly('Recessed tree soil'+(' %d'%index if index else ''),
               b.rounded(tx,ty,TREE_BED[0]-.02,TREE_BED[1]-.02,.47,8),.625,.137,'Tree soil',0)
        # A mown green apron inside the same recessed opening, as in the
        # reference's tree pits, rather than bare soil across the whole bed.
        b.poly('Bed lawn grass'+(' %d'%index if index else ''),
               b.rounded(tx,ty,TREE_BED[0]-.5,TREE_BED[1]-.5,.4,8),.625,.16,'Lawn',0)
        rng=random.Random(804+index*17)
        for i in range(80):
            dx=rng.uniform(-1.36,1.36);dy=rng.uniform(-1.05,1.05)
            if dx*dx+dy*dy<.32:continue
            chip=b.box('Small organic mulch',(tx+dx,ty+dy,.77),(.06+rng.random()*.08,.035,.018),'Weathered timber',.012,rot=(0,0,rng.uniform(0,math.tau)))


def embedded_track():
    b.box('Recessed rail infill',(0,20,.71),(54,2.48,.18),'Street asphalt',0)
    # A grooved rail section: flange, web, head and a narrow running groove.
    for yy in [19.42,20.58]:
        b.box('Embedded rail flange',(0,yy,.684),(54,.22,.035),'Gunmetal',.008)
        b.box('Embedded rail web',(0,yy,.742),(54,.055,.086),'Oxidized metal',.008)
        b.box('Steel running rail',(0,yy,.795),(54,.095,.035),'Aluminium',.008)
        b.box('Tram flange groove',(0,yy-.083,.789),(54,.043,.018),'Gunmetal',.004)
    for xx in range(-24,25,3):
        b.box('Track expansion seal',(xx,20,.801),(.016,2.46,.005),'Gunmetal',0)

