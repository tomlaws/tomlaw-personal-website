"""Fit bolder HKCEC frames and copings to the retained roof/glass envelope.

Run node scripts/export-hkcec-reference.mjs first, then this script in Blender.
The reference meshes stay editable in hkcec.blend; only the new detail meshes
are exported for the runtime. Coordinates in the layout use Three's Y-up axes.
"""
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]


def main():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/blender/hkcec-detail-base.glb'))
    layout = json.loads((ROOT / 'assets/blender/hkcec-detail-layout.json').read_text())
    authored = []
    roofs = [obj for obj in bpy.data.objects if obj.type=='MESH' and
             (obj.name=='HKCEC continuous vaulted roof' or obj.name.endswith('swept canopy'))]
    assert len(roofs)==3
    roof_trees = [BVHTree.FromPolygons([obj.matrix_world @ v.co for v in obj.data.vertices],
                                     [list(p.vertices) for p in obj.data.polygons]) for obj in roofs]

    def underside(x, z):
        # Cast from below so an overlapping side canopy takes precedence over
        # the higher central vault. Fitting only to the main vault left the
        # outer foyer supports poking through the two lower roofs.
        hits = [tree.ray_cast(Vector((x,-z,.095)),Vector((0,0,1)))[0] for tree in roof_trees]
        heights = [hit.z for hit in hits if hit is not None]
        return min(heights)-.003 if heights else math.inf

    def fit_head(vertices):
        # A post can straddle the lap between two roofs. Corner-only fitting
        # misses the lower skin passing across the middle of its top face.
        # Seat the whole cap below that skin without adding tiny trim pieces.
        head=[Vector(v) for v in vertices[4:]]; offset=0
        for i in range(25):
            for j in range(25):
                u,v=i/24,j/24
                p=head[0].lerp(head[1],u).lerp(head[3].lerp(head[2],u),v)
                offset=max(offset,p.y-underside(p.x,p.z))
        if offset>0:
            for i in range(4,8):
                x,y,z=vertices[i]; vertices[i]=(x,y-offset-.003,z)
        return vertices

    def mesh(name, vertices, faces, role, **metadata):
        data = bpy.data.meshes.new(name)
        data.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
        bm = bmesh.new(); bm.from_mesh(data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        assert all(edge.is_manifold for edge in bm.edges), name
        assert all(face.calc_area() > 1e-10 for face in bm.faces), name
        assert bm.calc_volume(signed=True) > 0, name
        # Smooth along the fitted curves while retaining the crisp corners of
        # the rectangular profiles. This also avoids duplicating every flat
        # triangle normal in the shared render buffers.
        for face in bm.faces: face.smooth=True
        for edge in bm.edges: edge.smooth=edge.calc_face_angle(0)<math.radians(30)
        bm.to_mesh(data); bm.free(); data.update()
        material = bpy.data.materials.get('white') or bpy.data.materials.new('white')
        material.diffuse_color = (.84, .88, .9, 1); material.roughness = .52
        data.materials.append(material)
        obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
        authored.append((obj, name, role, metadata)); return obj

    def rail(name, points, width, height, role):
        points = [Vector(p) for p in points]
        vertices = []
        for i, point in enumerate(points):
            tangent = (points[min(i+1, len(points)-1)] - points[max(0, i-1)]).normalized()
            side = Vector((0, 1, 0)).cross(tangent)
            if side.length < .01:
                side = Vector((1, 0, 0))
            side.normalize(); up = tangent.cross(side).normalized()
            for sx, sy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                vertices.append(tuple(point + side*sx*width/2 + up*sy*height/2))
        faces = [(3,2,1,0), tuple(range((len(points)-1)*4, len(points)*4))]
        for i in range(len(points)-1):
            a, b = i*4, (i+1)*4
            faces += [(a+j, a+(j+1)%4, b+(j+1)%4, b+j) for j in range(4)]
        return mesh(name, vertices, faces, role, width=width, height=height)

    # Rectangular aluminium coping follows the exact sampled roof edges. The
    # fine central ridge is omitted; no grids or panel seams are added to roofs.
    for edge in layout['roofEdges']:
        if edge['key'] == 'hkcecRoof':
            continue
        rail('HKCEC broad fitted roof coping',
             [[x, y+.003, z] for x, y, z in edge['points']],
             .060, .042, 'roof-coping')

    counts = [7,5,3,3,3,3,0,3,0]
    seen = set()
    for run_index, (run, count) in enumerate(zip(layout['facades'], counts)):
        points, tops, base = run['points'], run['tops'], run['base']
        lengths = [0]
        for a, b in zip(points, points[1:]):
            lengths.append(lengths[-1] + math.dist(a, b))
        total = lengths[-1]
        closed = math.dist(points[0], points[-1]) < 1e-6

        def sample(distance):
            distance = max(0, min(total, distance))
            index = min(next((i for i in range(len(lengths)-1) if distance <= lengths[i+1]), len(lengths)-2), len(lengths)-2)
            t = (distance-lengths[index]) / max(lengths[index+1]-lengths[index], 1e-8)
            p = Vector((points[index][0], 0, points[index][1])).lerp(Vector((points[index+1][0], 0, points[index+1][1])), t)
            return p, tops[index] + (tops[index+1]-tops[index])*t

        for column in range(count):
            distance = column*total/(count if closed else count-1)
            centre, head = sample(distance)
            identity = tuple(round(v, 5) for v in (centre.x, centre.z, base, head))
            if identity in seen:
                continue
            seen.add(identity)
            before, _ = sample(distance-.01); after, _ = sample(distance+.01)
            tangent = (after-before).normalized()
            # One square corner post serves adjoining panes. Sloped head
            # vertices fit the actual curtain-wall head below its canopy.
            normal = Vector((-tangent.z, 0, tangent.x))
            width, depth = .072, .066
            _, left_head = sample(distance-width/2)
            _, right_head = sample(distance+width/2)
            vertices = []
            for top in [False, True]:
                for side, front in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                    p = centre + tangent*(side*width/2) + normal*(front*depth/2)
                    p.y = (left_head if side < 0 else right_head) if top else base
                    vertices.append(tuple(p))
            faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
            mesh('HKCEC broad curtain-wall mullion', fit_head(vertices), faces, 'facade-mullion',
                 run=run_index, width=width, depth=depth, head=head)

        # Retain only the existing major floor divisions, now as broad fitted
        # bands. Their complete profile must fit beneath overlapping canopies,
        # not merely beneath the head of the central curtain wall.
        def transom_clearance(distance,y):
            centre,head=sample(distance)
            before,_=sample(distance-.01); after,_=sample(distance+.01)
            tangent=(after-before).normalized(); normal=Vector((-tangent.z,0,tangent.x))
            ceiling=min([head]+[underside((centre+normal*d).x,(centre+normal*d).z) for d in [-.028,0,.028]])
            return ceiling-y-.036

        y = base + run['horizontal']
        while y < max(tops)-.035:
            divisions=max(2,math.ceil(total/.018)); paths=[]; path=[]
            previous=0; previous_clear=transom_clearance(0,y)>=0
            def at(distance):
                p,_=sample(distance); return [p.x,y,p.z]
            if previous_clear:path=[at(0)]
            for i in range(1,divisions+1):
                distance=total*i/divisions; clear=transom_clearance(distance,y)>=0
                if clear!=previous_clear:
                    # Refine the actual roof intersection; interpolating a
                    # height across the lap can put trim back through its skin.
                    low,high=previous,distance
                    for _ in range(18):
                        middle=(low+high)/2
                        if (transom_clearance(middle,y)>=0)==previous_clear:low=middle
                        else:high=middle
                    boundary=low-.0002 if previous_clear else high+.0002
                    if previous_clear:
                        path.append(at(boundary)); paths.append(path); path=[]
                    else:path=[at(boundary)]
                if clear:path.append(at(distance))
                previous,previous_clear=distance,clear
            if path:paths.append(path)
            for path in paths:
                if len(path)>1 and math.dist(path[0],path[-1])>.08:
                    rail('HKCEC broad floor transom', path, .052, .060, 'floor-transom')
            y += run['horizontal']

    # Fit the three main foyer supports to the real roof underside; their
    # previous hairline cylinders stopped short of it.
    for support in layout['supports']:
        a, b = support['points']; vertices=[]; centre_head=underside(a[0],a[2])
        for top in [False,True]:
            for sx,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                x,z=a[0]+sx*.09/2,a[2]+sz*.075/2
                head=underside(x,z)
                assert math.isfinite(head), 'Every support corner must meet a canopy'
                vertices.append((x,centre_head if top else a[1],z))
        mesh('HKCEC substantial foyer support', fit_head(vertices),
             [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],
             'foyer-support',width=.09,depth=.075)

    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/hkcec.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    records = []
    for obj, name, role, metadata in authored:
        obj.select_set(True); obj.data.calc_loop_triangles(); positions, normals = [], []
        for triangle in obj.data.loop_triangles:
            for loop_index in triangle.loops:
                normal = obj.data.corner_normals[loop_index].vector
                v = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                positions.extend([v.x,v.z,-v.y]); normals.extend([normal.x,normal.z,-normal.y])
        records.append({'name':name,'key':'white','role':role,**metadata,'position':positions,'normal':normals})
    output = '// Blender-authored HKCEC details. Regenerate with tools/blender/simplify_hkcec_details.py.\n'
    output += 'export const HKCEC_DETAILS=' + json.dumps(records,separators=(',',':')) + ';\n'
    (ROOT / 'src/harbour/hkcec-detail-meshes.mjs').write_text(output,encoding='utf-8')
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'assets/blender/hkcec-details.glb'), export_format='GLB',use_selection=True,export_yup=True,export_normals=True)
    review = {'date':'2026-11-03','parts':len(records),
              'mullions':sum(p['role']=='facade-mullion' for p in records),
              'roofCopings':sum(p['role']=='roof-coping' for p in records),
              'mullionWidth':.072,'oldMajorMullionDiameter':.042,
              'transomHeight':.060,'oldTransomDiameter':.024,
              'preserved':['all three roof shells','glazing envelope','podium','terrace bands','entrance','interior volumes','night lighting'],
              'removed':['fine roof ridge','redundant shared-corner mullions','secondary thin frame lines']}
    (ROOT / 'assets/validation/hkcec-detail-review.json').write_text(json.dumps(review,indent=2)+'\n',encoding='utf-8')
    print('HKCEC_DETAILS',json.dumps(review))


if __name__=='__main__':
    main()
