"""Isolated Blender source inspection, without changing the live authoring scene."""
import sys, math, json, hashlib
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
import build_city as b

label=sys.argv[sys.argv.index('--label')+1] if '--label' in sys.argv else 'polished'
out=ROOT/'assets/validation'
if '--fresh' in sys.argv:
    import build_neighborhood as district
    import metro_train
    district.palette();metro_train.train()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/train-source.blend'))
# Record the source guard geometry/materials to prove the approved fences stay.
guards=[]
for obj in sorted(bpy.data.objects,key=lambda o:o.name):
    if not obj.get('stationGuard'):continue
    if obj.type=='MESH':shape=[list(v.co) for v in obj.data.vertices]
    else:shape=[[list(p.co) for p in s.points] for s in obj.data.splines]
    mats=[(m.get('paletteKey'),list(m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value),
           m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value) for m in obj.data.materials]
    guards.append([obj.name,list(obj.location),shape,mats])
(out/f'train-{label}-guard-fingerprint.json').write_text(json.dumps({
    'objects':len(guards),'sha256':hashlib.sha256(json.dumps(guards,sort_keys=True).encode()).hexdigest()}),encoding='utf-8')
train=set(bpy.data.collections['Metro'].objects)
if '--save-train' in sys.argv:
    # Refresh the editable train from the validated city source without running
    # palette() again or overwriting the live full-build progress file.
    for obj in list(bpy.data.objects):
        if obj not in train:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/train-source.blend'))
for obj in bpy.data.objects:obj.hide_render=obj not in train
for mat in bpy.data.materials:b.M[mat.get('paletteKey',mat.name)]=mat
b.collection('Train QA studio')
b.material('Studio slate','#52606a',.84,0)
b.box('Studio floor',(0,0,-.09),(200,200,.12),'Studio slate',0)
b.area('Large warm key',(-7,-10,12),'#fff1df',2200,9,(0,-3,1.8))
b.area('Soft neutral fill',(8,-4,9),'#e7efff',1600,8,(0,-3,1.8))
b.area('Roof edge light',(-2,10,12),'#ffffff',2800,7,(0,0,1.8))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=40;s.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type!='CPU'
    s.cycles.device='GPU'
except Exception:pass
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.18,.22,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.35
camdata=bpy.data.cameras.new('Train QA camera');cam=bpy.data.objects.new('Train QA camera',camdata)
s.collection.objects.link(cam);camdata.type='ORTHO';s.camera=cam;s.view_settings.view_transform='AgX'
s.render.resolution_x=1400;s.render.resolution_y=900;s.render.resolution_percentage=100
for view,position,target,scale in [('front',(11,-18,9),(0,-4.8,1.8),13.2),('joint',(11,-8,7),(0,0,1.85),9.0),('cab',(6,-16,6),(0,-8.8,2),6.0)]:
    cam.location=position;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=scale
    s.render.filepath=str(out/f'train-{label}-{view}.png');bpy.ops.render.render(write_still=True)
