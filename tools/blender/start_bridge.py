"""Enable the locally installed upstream MCP add-on in Blender."""
import os
os.environ['DISABLE_TELEMETRY'] = 'true'
import bpy
import addon_utils
addon_utils.enable('blender_mcp', default_set=True, persistent=True)
addon = bpy.context.preferences.addons.get('blender_mcp')
if addon:
    addon.preferences.telemetry_consent = False
bpy.context.scene.blendermcp_auto_start_server = True
bpy.context.scene.blendermcp_use_polyhaven = False
bpy.context.scene.blendermcp_use_sketchfab = False
bpy.context.scene.blendermcp_use_hyper3d = False
bpy.ops.wm.save_userpref()
print('CITY_BLENDER_BRIDGE_READY', bpy.app.version_string, flush=True)
