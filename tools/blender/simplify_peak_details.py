"""Author bolder Peak Tower details in Blender and export the runtime mesh data.

Uses the retained original tower as the editing base. Run with Blender --background
--python tools/blender/simplify_peak_details.py. Other architecture is preserved.
"""
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[2]
REPLACED = ('Peak recessed louvre backing', 'Peak fine horizontal louvre',
            'Peak louvre horizontal frame', 'Peak louvre vertical frame',
            'Peak louvre end return', 'Peak louvre end slat',
            'Peak roof terrace handrail', 'Peak roof terrace end handrail',
            'Peak terrace railing post', 'Peak pier granite stripe')


def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/blender/peak-before-simplification.glb'))
    for obj in list(bpy.data.objects):
        if any(obj.name.startswith(name) for name in REPLACED):
            bpy.data.objects.remove(obj, do_unlink=True)
    assert not any('fine horizontal louvre' in obj.name for obj in bpy.data.objects)
    authored = []

    def mesh(name, vertices, faces, key):
        data = bpy.data.meshes.new(name)
        data.from_pydata([(x, -z, y) for x, y, z in vertices], [], faces)
        bm = bmesh.new(); bm.from_mesh(data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        assert all(edge.is_manifold for edge in bm.edges), name
        bm.to_mesh(data); bm.free(); data.update()
        material = bpy.data.materials.get(key) or bpy.data.materials.new(key)
        data.materials.append(material)
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        authored.append((obj, name, key))

    def box(name, w, h, d, x, y, z, key):
        vertices = [(x + sx*w/2, y + sy*h/2, z + sz*d/2)
                    for sx, sy, sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                      (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        mesh(name, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),
                              (2,3,7,6),(3,0,4,7)], key)

    def upper(x):
        return 1.58 + 1.10 * (abs(x)/1.68)**2.10

    def clipped(name, width, bottom, top, thickness, x, z, key):
        limit = 1.68 * (max(0, (top-1.58)/1.10))**(1/2.10)
        left, right = max(x-width/2, -limit), min(x+width/2, limit)
        if right-left < 1e-5:
            return
        points = [(left, top), (right, top)]
        steps = max(1, math.ceil((right-left)/.06))
        for i in range(steps, -1, -1):
            xx = left + (right-left)*i/steps
            points.append((xx, min(top, max(bottom, upper(xx)))))
        clean = []
        for p in points:
            if not clean or math.dist(p, clean[-1]) > 1e-6:
                clean.append(p)
        if math.dist(clean[0], clean[-1]) < 1e-6:
            clean.pop()
        n = len(clean)
        vertices = [(px, py, z + side*thickness/2) for side in [-1,1] for px, py in clean]
        faces = [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh(name, vertices, faces, key)

    for side in [-1,1]:
        z = side*(1.74/2-.10)
        clipped('Peak recessed louvre backing',2.30,1.66,2.48,.035,0,z,'peakLouvre')
        for row in range(6):
            y = 1.72 + row*.14
            clipped('Peak broad horizontal louvre',2.30,y-.020,y+.020,.055,0,z+side*.018,'room')
        for row in range(3):
            y = 1.65 + row*.42
            clipped('Peak louvre horizontal frame',2.36,y-.0275,y+.0275,.070,0,z+side*.030,'white')
        for column in range(5):
            clipped('Peak louvre vertical frame',.045,1.65,2.49,.070,-1.17+column*.585,z+side*.032,'white')
        clipped('Peak louvre end return',.035,1.66,2.48,1.70,side*1.155,0,'peakLouvre')
        for row in range(6):
            y = 1.72 + row*.14
            clipped('Peak broad louvre end slat',.055,y-.020,y+.020,1.70,side*1.165,0,'room')
        box('Peak roof terrace handrail',2.34,.032,.032,0,2.725,side*.815,'metal')
        box('Peak roof terrace end handrail',.032,.032,1.64,side*1.175,2.725,0,'metal')
        for i in range(4):
            box('Peak terrace railing post',.030,.19,.028,-1.15+i*2.30/3,2.63,side*.815,'metal')
    for x in [-.82,.82]:
        top = 1.31 + 1.11*(abs(x)/1.68)**2.35 + .035
        for z in [-.52,.52]:
            for row in range(2):
                box('Peak pier granite joint',.296,.045,.296,x,top-.10-row*.20,z,'peakLouvre')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/peak-tower.blend'))
    records = []
    for obj, name, key in authored:
        obj.data.calc_loop_triangles()
        positions, normals = [], []
        for triangle in obj.data.loop_triangles:
            normal = triangle.normal
            for index in triangle.vertices:
                v = obj.data.vertices[index].co
                positions.extend([v.x,v.z,-v.y])
                normals.extend([normal.x,normal.z,-normal.y])
        records.append({'name':name,'key':key,'position':positions,'normal':normals})
    output = '// Blender-authored Peak Tower details. Regenerate with tools/blender/simplify_peak_details.py.\n'
    output += 'export const PEAK_DETAILS=' + json.dumps(records,separators=(',',':')) + ';\n'
    (ROOT / 'src/harbour/peak-detail-meshes.mjs').write_text(output,encoding='utf-8')
    print(f'Authored {len(records)} bold Peak details; crescent, atrium and roof lighting preserved.')
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from complete_peak_bowl import complete_bowl
    complete_bowl()


if __name__ == '__main__':
    main()
