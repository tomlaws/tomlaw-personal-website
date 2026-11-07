"""Isolated close-up QA render; run headless so the editable city stays open."""
import sys, math
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).parent))
import build_neighborhood as district
import build_city as b
import taxi_sedan

district.palette();taxi_sedan.build()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/taxi-source.blend'))
b.collection('Studio')
b.material('Studio slate','#344b5a',.84,0)
b.box('Studio floor',(0,0,-.07),(200,200,.12),'Studio slate',.0)
b.area('Large warm key',(-4,-6,7),'#fff0d7',850,5,(0,0,.6))
b.area('Softbox blue fill',(4,-1,4),'#c5dfef',450,4,(0,0,.7))
b.area('Roof edge light',(0,5,6),'#eef6ff',1000,3,(0,0,.7))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for d in prefs.devices:d.use=d.type!='CPU'
    s.cycles.device='GPU'
except Exception:pass
s.world.use_nodes=True;s.world.node_tree.nodes.get('Background').inputs[0].default_value=(.12,.15,.2,1)
s.world.node_tree.nodes.get('Background').inputs[1].default_value=.3
camdata=bpy.data.cameras.new('Taxi QA camera');cam=bpy.data.objects.new('Taxi QA camera',camdata)
s.collection.objects.link(cam);camdata.type='ORTHO';camdata.ortho_scale=6.6;s.camera=cam
s.render.resolution_x=1100;s.render.resolution_y=850;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX'
for name,pos in [('front',(6,-8,5.7)),('rear',(-6,8,5.7))]:
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler()
    s.render.filepath=str(ROOT/f'assets/validation/taxi-{name}.png')
    bpy.ops.render.render(write_still=True)
