"""Fingerprint the approved dome independently of removable roof furniture."""
import hashlib
import json
import sys
from pathlib import Path
import bpy

BASELINE=Path(__file__).resolve().parents[2]/'assets/validation/mall-dome-approved.json'
PREFIXES=('Galleria fitted rooflight upstand','Galleria continuous glass lantern',
          'Galleria formed lantern rib','Galleria lantern ring beam')


def fingerprint(graph):
    graph.update()
    result={}
    for obj in bpy.data.collections['07 · Harbor galleria'].objects:
        if not obj.name.startswith(PREFIXES):continue
        evaluated=obj.evaluated_get(graph);mesh=evaluated.to_mesh()
        data={
            'vertices':[[round(v,6) for v in obj.matrix_world@vertex.co] for vertex in mesh.vertices],
            'faces':[[*face.vertices,face.material_index] for face in mesh.polygons],
            'materials':[m.name for m in mesh.materials],
        }
        result[obj.name]=hashlib.sha256(json.dumps(data,separators=(',',':')).encode()).hexdigest()
        evaluated.to_mesh_clear()
    assert len(result)>=16,'The complete dome and supporting frame must be present'
    return result


def verify(graph):
    actual=fingerprint(graph)
    assert actual==json.loads(BASELINE.read_text()),'Approved central glass dome or fitted frame changed'
    return len(actual)


if __name__=='__main__' and '--capture' in sys.argv:
    assert not BASELINE.exists(),'Do not overwrite the approved dome baseline'
    BASELINE.write_text(json.dumps(fingerprint(bpy.context.evaluated_depsgraph_get()),indent=2))
    print('Captured approved dome and frame geometry',flush=True)
