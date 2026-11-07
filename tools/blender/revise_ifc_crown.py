"""Rebuild only IFC's crown in Blender, preserving the rest of the shipped GLB.

Run: blender --background --python tools/blender/revise_ifc_crown.py
The retained source GLB makes this repeatable; the .blend is the editable model.
"""
import copy
import json
import struct
from pathlib import Path

import bpy
import bmesh

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/blender/ifc-before-crown.glb'
TARGET = ROOT / 'public/hk-models/two-ifc.glb'
PARTS = ROOT / 'assets/blender/ifc-crown.glb'


def read_glb(path):
    raw = path.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    document = json.loads(raw[20:20 + size])
    offset = 20 + size
    return document, raw[offset + 8:offset + 8 + struct.unpack_from('<I', raw, offset)[0]]


def write_glb(path, document, binary):
    document['buffers'] = [{'byteLength': len(binary)}]
    text = json.dumps(document, separators=(',', ':')).encode('utf-8')
    text += b' ' * (-len(text) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(binary))
                     + struct.pack('<II', len(text), 0x4E4F534A) + text
                     + struct.pack('<II', len(binary), 0x004E4942) + binary)


def replace_crown(original, binary, crown, crown_binary):
    """Splice Blender-authored fins into the GLB without re-exporting its shaft.

    Compact the used meshes/accessors/views while copying their binary records
    verbatim. This retains every other vertex, material, node and opening.
    """
    result = copy.deepcopy(original)
    keep = [i for i, node in enumerate(result['nodes'])
            if not node.get('name', '').startswith('IFC open crown fin')]
    remap = {old: new for new, old in enumerate(keep)}
    result['nodes'] = [result['nodes'][i] for i in keep]
    for node in result['nodes']:
        if 'children' in node:
            node['children'] = [remap[i] for i in node['children'] if i in remap]
    for scene in result['scenes']:
        scene['nodes'] = [remap[i] for i in scene['nodes'] if i in remap]
    offsets = {key: len(result[key]) for key in ['nodes', 'meshes', 'accessors', 'bufferViews']}
    material_map = {i: next(j for j, m in enumerate(result['materials']) if m['name'] == material['name'])
                    for i, material in enumerate(crown['materials'])}
    binary += b'\0' * (-len(binary) % 4)
    for view in copy.deepcopy(crown['bufferViews']):
        view['byteOffset'] = view.get('byteOffset', 0) + len(binary)
        result['bufferViews'].append(view)
    for accessor in copy.deepcopy(crown['accessors']):
        accessor['bufferView'] += offsets['bufferViews']
        result['accessors'].append(accessor)
    for mesh in copy.deepcopy(crown['meshes']):
        for primitive in mesh['primitives']:
            primitive['indices'] += offsets['accessors']
            primitive['attributes'] = {key: i + offsets['accessors'] for key, i in primitive['attributes'].items()}
            primitive['material'] = material_map[primitive['material']]
        result['meshes'].append(mesh)
    for node in copy.deepcopy(crown['nodes']):
        node['mesh'] += offsets['meshes']
        result['nodes'].append(node)
    result['scenes'][result.get('scene', 0)]['nodes'].extend(
        range(offsets['nodes'], len(result['nodes'])))
    binary += crown_binary
    # Remove orphaned records from the former 28-fin crown.
    packed = bytearray()
    mesh_map, accessor_map, view_map = {}, {}, {}
    meshes, accessors, views = [], [], []

    def accessor(index):
        if index not in accessor_map:
            item = copy.deepcopy(result['accessors'][index])
            old_view = item['bufferView']
            if old_view not in view_map:
                view = copy.deepcopy(result['bufferViews'][old_view])
                start = view.get('byteOffset', 0)
                packed.extend(b'\0' * (-len(packed) % 4))
                view['byteOffset'] = len(packed)
                packed.extend(binary[start:start + view['byteLength']])
                view_map[old_view] = len(views)
                views.append(view)
            item['bufferView'] = view_map[old_view]
            accessor_map[index] = len(accessors)
            accessors.append(item)
        return accessor_map[index]

    for node in result['nodes']:
        if 'mesh' not in node:
            continue
        index = node['mesh']
        if index not in mesh_map:
            mesh = copy.deepcopy(result['meshes'][index])
            for primitive in mesh['primitives']:
                primitive['indices'] = accessor(primitive['indices'])
                primitive['attributes'] = {key: accessor(i) for key, i in primitive['attributes'].items()}
            mesh_map[index] = len(meshes)
            meshes.append(mesh)
        node['mesh'] = mesh_map[index]
    result.update(meshes=meshes, accessors=accessors, bufferViews=views)
    return result, bytes(packed)


def main():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    for obj in list(bpy.data.objects):
        if obj.name.startswith('IFC open crown fin'):
            bpy.data.objects.remove(obj, do_unlink=True)
    white = bpy.data.materials['white']
    fins = []
    # Four broad fingers on each face, retaining the open corners and inward curl.
    for face, (nx, nz) in enumerate([(1, 0), (-1, 0), (0, 1), (0, -1)]):
        ax, az = nz, -nx
        for i, u in enumerate([-.54, -.18, .18, .54]):
            top = 14.98 - abs(u) * .5
            # A continuous inward sweep: vertical at the roof, curling more
            # strongly near the tip. Keep the shortened height and open centre.
            profile = [(13.72 + (top - 13.72) * t,
                        .97 - .39 * t * t, 1 - .24 * t * t)
                       for t in (step / 8 for step in range(9))]
            vertices = []
            for y, radius, taper in profile:
                for du, dr in [(-.06, -.0375), (.06, -.0375), (.06, .0375), (-.06, .0375)]:
                    x = ax * (u * taper + du) + nx * (radius + dr)
                    z = az * (u * taper + du) + nz * (radius + dr)
                    vertices.append((x, -z, y))
            last = (len(profile) - 1) * 4
            faces = [(3, 2, 1, 0), (last, last + 1, last + 2, last + 3)]
            for ring in range(len(profile) - 1):
                for edge in range(4):
                    a, b = ring * 4 + edge, ring * 4 + (edge + 1) % 4
                    faces.append((a, b, b + 4, a + 4))
            mesh = bpy.data.meshes.new(f'IFC compact crown fin {face}-{i}')
            mesh.from_pydata(vertices, [], faces)
            mesh.materials.append(white)
            bm = bmesh.new(); bm.from_mesh(mesh)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            assert not any(not edge.is_manifold for edge in bm.edges), 'Closed crown fin'
            bm.to_mesh(mesh); bm.free()
            obj = bpy.data.objects.new(mesh.name, mesh)
            bpy.context.collection.objects.link(obj)
            fins.append(obj)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/two-ifc.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in fins:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = fins[0]
    bpy.ops.export_scene.gltf(filepath=str(PARTS), export_format='GLB', use_selection=True)
    original, binary = read_glb(SOURCE)
    crown, crown_binary = read_glb(PARTS)
    updated, packed = replace_crown(original, binary, crown, crown_binary)
    write_glb(TARGET, updated, packed)
    print('IFC: 16 closed fins; base 13.72, tallest tip 14.89; shaft GLB records preserved verbatim.')


if __name__ == '__main__':
    main()
