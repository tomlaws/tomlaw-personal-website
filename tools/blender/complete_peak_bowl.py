"""Complete the Peak Tower's bowl ends without rebuilding its details.

Standalone: Blender --background --python tools/blender/complete_peak_bowl.py
Also called after simplify_peak_details.py so both exports stay reproducible.
Coordinates below use the runtime's Y-up convention; Blender stores Z-up.
"""
import json
from pathlib import Path
import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[2]
NAME = 'Peak completed crescent shell'
HALF_WIDTH, HALF_DEPTH, INNER = 1.68, .87, 1.17
DECK_TOP = 2.515 + .055 / 2


def lower(x):
    return 1.31 + 1.11 * (abs(x) / HALF_WIDTH) ** 2.35


def upper(x):
    return 1.58 + 1.10 * (abs(x) / HALF_WIDTH) ** 2.10


def complete_bowl():
    for obj in list(bpy.data.objects):
        name = obj.name.replace('_', ' ')
        if name.startswith(('Peak crescent aluminium fascias',
                            'Peak crescent shaded soffit', NAME)):
            bpy.data.objects.remove(obj, do_unlink=True)

    # Solid aluminium cheeks rise from the unchanged lower bowl to the terrace
    # edge, with both end caps level with the deck. The central grille remains
    # open above the thin curved sill. This is one continuous solid, not plates
    # laid over the existing rim with coplanar seams or exposed back faces.
    top = [(-HALF_WIDTH, DECK_TOP), (-INNER, DECK_TOP),
           (-INNER, upper(INNER))]
    top += [(x, upper(x)) for i in range(65)
            if -INNER < (x := -HALF_WIDTH + i / 64 * HALF_WIDTH * 2) < INNER]
    top += [(INNER, upper(INNER)), (INNER, DECK_TOP),
            (HALF_WIDTH, DECK_TOP)]
    bottom = [(x, lower(x)) for i in range(64, -1, -1)
              for x in [-HALF_WIDTH + i / 64 * HALF_WIDTH * 2]]
    outline = top + bottom
    n = len(outline)
    vertices = [(x, -z, y) for z in [-HALF_DEPTH, HALF_DEPTH]
                for x, y in outline]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    data = bpy.data.meshes.new(NAME)
    data.from_pydata(vertices, [], faces)
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    assert all(edge.is_manifold for edge in bm.edges), 'Bowl must have no open ends'
    assert all(face.calc_area() > 1e-9 for face in bm.faces), 'No degenerate triangles'
    assert bm.calc_volume(signed=True) > 0, 'Bowl normals must face outward'
    unseen = set(bm.verts); stack = [next(iter(unseen))]
    while stack:
        vertex = stack.pop()
        if vertex not in unseen:
            continue
        unseen.remove(vertex)
        stack.extend(edge.other_vert(vertex) for edge in vertex.link_edges)
    assert not unseen, 'Both bowl ends must belong to the same shell'
    bm.to_mesh(data); bm.free(); data.update()
    material = bpy.data.materials.get('peakFascia') or bpy.data.materials.new('peakFascia')
    material.diffuse_color = (.73, .78, .82, 1)
    material.roughness = .62
    data.materials.append(material)
    obj = bpy.data.objects.new(NAME, data); bpy.context.collection.objects.link(obj)
    obj['reference'] = 'User Peak Tower photograph; https://farrells.com/project/peak-tower/'
    obj['construction'] = 'Continuous crescent with solid end cheeks and full-depth closure'

    data.calc_loop_triangles(); positions, normals = [], []
    for triangle in data.loop_triangles:
        normal = triangle.normal
        for index in triangle.vertices:
            v = data.vertices[index].co
            positions.extend([v.x, v.z, -v.y])
            normals.extend([normal.x, normal.z, -normal.y])
    record = {'name': NAME, 'key': 'peakFascia', 'endTop': DECK_TOP, 'position': positions, 'normal': normals}
    output = '// Blender-authored closed Peak bowl. Regenerate with tools/blender/complete_peak_bowl.py.\n'
    output += 'export const PEAK_BOWL=' + json.dumps(record, separators=(',', ':')) + ';\n'
    (ROOT / 'src/harbour/peak-bowl-mesh.mjs').write_text(output, encoding='utf-8')

    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/peak-tower.blend'))
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(ROOT / 'assets/blender/peak-bowl.glb'),
                              export_format='GLB', use_selection=True,
                              export_yup=True, export_normals=True)
    review = {'date': '2026-11-03', 'connectedShells': 1, 'manifold': True,
              'vertices': len(data.vertices), 'triangles': len(data.loop_triangles),
              'solidEnds': ['left', 'right'], 'depth': HALF_DEPTH * 2,
              'terraceJoinHeight': DECK_TOP, 'flatEndCaps': True,
              'preserved': ['original lower curve', 'original width and depth',
                            'central grille aperture', 'atrium', 'podium',
                            'terrace glazing, railings and concealed lighting']}
    (ROOT / 'assets/validation/peak-bowl-review.json').write_text(
        json.dumps(review, indent=2) + '\n', encoding='utf-8')
    print('PEAK_BOWL', json.dumps(review))


if __name__ == '__main__':
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/peak-tower.blend'))
    complete_bowl()
