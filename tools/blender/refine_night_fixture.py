"""Apply the inspected lantern correction to editable and finished assets.

The full neighborhood rebuild already passed. Reuse the finished, unchanged
district lightmaps and regenerate the changed toyshop through the same mesh
preparation, bake, compression and batching helpers as the full pipeline.
"""
import sys,json
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).parent))
import build_city as b
import finish_assets as finish
import night_identity

source=b.SOURCE/'nocturne-source.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
for prefix in ['Night channel / ','Night diffuser / ']:
    obj=bpy.data.objects[prefix+'toyshop lantern eave']
    offset=.036 if prefix.startswith('Night diffuser') else 0
    for point in obj.data.splines[0].points:point.co.y=-7.94-offset;point.co.z=6.81

# Rerun the full named-geometry checks on the editable scene before joining.
b.M.update({m['paletteKey']:m for m in bpy.data.materials if m.get('paletteKey')})
manifest=json.loads((b.OUT/'manifest.json').read_text())
b.LIGHTS[:]=manifest['lights'];b.VEGETATION[:]=manifest['vegetation']
night_identity.FIXTURES[:]=[(o,bpy.data.objects['Night diffuser / '+o['nightFixture']])
    for o in bpy.data.objects if o.get('fixtureRole')=='housing']
validation=Path(__file__).with_name('validate_scene.py')
exec(compile(validation.read_text(),str(validation),'exec'),{'__file__':str(validation)})
bpy.ops.wm.save_as_mainfile(filepath=str(source))

bpy.ops.wm.open_mainfile(filepath=str(b.SOURCE/'nocturne-harbor.blend'))
name='08 · Cloudberry toyshop'
old=bpy.data.collections[name]
for obj in list(old.objects):bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.collections.remove(old)
with bpy.data.libraries.load(str(source),link=False) as (available,loaded):loaded.collections=[name]
collection=loaded.collections[0];bpy.context.scene.collection.children.link(collection)
b.prepare_collection(collection)
finish.finish()
