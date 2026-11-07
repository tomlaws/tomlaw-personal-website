"""Bake district occlusion, pack PBR maps and export self-contained compressed GLBs.
Run after build_city.py, in the same Blender scene. Safe to run again.
"""
import bpy, json, time, traceback
import numpy as np
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/models'; SOURCE=ROOT/'assets/blender'
def status(phase,**kw):
    (SOURCE/'build-status.json').write_text(json.dumps({'phase':phase,'time':time.time(),**kw}))
    print(phase,flush=True)

def bake(obj):
    if obj.get('occlusionRevision')==2:return
    status('baking ambient occlusion',asset=obj.name)
    bpy.ops.object.select_all(action='DESELECT');obj.hide_set(False);obj.select_set(True);bpy.context.view_layer.objects.active=obj
    uv=obj.data.uv_layers.get('LightmapUV') or obj.data.uv_layers.new(name='LightmapUV')
    obj.data.uv_layers.active=uv
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.004,area_weight=.4)
    bpy.ops.object.mode_set(mode='OBJECT')
    # The furnished mall has long, narrow mouldings and many small fixtures.
    # A 1K lightmap undersamples their UV islands and bleeds dark seams onto
    # the continuous facade. Reserve a 2K tile, as for the public realm.
    resolution=2048 if obj.name.startswith(('00','07')) else 1024
    im=bpy.data.images.new(obj.name+' · baked occlusion',width=resolution,height=resolution,alpha=False)
    im.colorspace_settings.name='Non-Color';im.generated_color=(1,1,1,1)
    restore=[]
    for slot in obj.material_slots:
        mat=slot.material.copy();slot.material=mat;nodes=mat.node_tree.nodes;links=mat.node_tree.links
        # Rebakes must replace the previous map, including the exporter hook.
        for node in list(nodes):
            if node.name.startswith('Baked occlusion') or (node.type=='GROUP' and node.node_tree and node.node_tree.name=='glTF Material Output'):
                nodes.remove(node)
        tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.name='Baked occlusion';nodes.active=tex;tex.select=True
        uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='LightmapUV';links.new(uvnode.outputs[0],tex.inputs[0])
        output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        original=output.inputs['Surface'].links[0].from_socket
        ao=nodes.new('ShaderNodeAmbientOcclusion');ao.inputs['Distance'].default_value=3.2;ao.samples=32;ao.only_local=False
        emit=nodes.new('ShaderNodeEmission');links.new(ao.outputs['Color'],emit.inputs['Color']);links.new(emit.outputs[0],output.inputs['Surface'])
        restore.append((mat,original,output,ao,emit,tex))
    try:
        bpy.context.scene.render.bake.margin=5
        bpy.ops.object.bake(type='EMIT',use_clear=True)
    finally:
        for mat,original,output,ao,emit,tex in restore:
            mat.node_tree.links.new(original,output.inputs['Surface']);mat.node_tree.nodes.remove(ao);mat.node_tree.nodes.remove(emit)
    group=bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
        group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    for mat,_,_,_,_,tex in restore:
        if mat.get('surfaceRole')=='solid':
            node=mat.node_tree.nodes.new('ShaderNodeGroup');node.node_tree=group
            mat.node_tree.links.new(tex.outputs['Color'],node.inputs['Occlusion'])
    im.pack();obj['occlusionBaked']=True;obj['occlusionRevision']=2

def export(objects,path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False);obj.select_set(True)
        if not obj.get('triangulated'):
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Portable tangent geometry','TRIANGULATE')
            bpy.ops.object.modifier_apply(modifier=mod.name)
            obj['triangulated']=True
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_tangents=True,
        export_vertex_color='MATERIAL',
        export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16,export_draco_normal_quantization=12,
        export_draco_texcoord_quantization=14)

def export_batched_city(objects):
    """Share one AO atlas and one material per palette entry across the district.
    Individual editable assets retain their own maps. Only the runtime copy is joined.
    """
    status('batching runtime city')
    width,height=4096,4096
    pixels=np.ones((height,width,4),dtype=np.float32)
    large_slots=[(0,0),(0,2048)]
    small_slots=[(x,y) for y in [0,1024,2048,3072] for x in [2048,3072]]
    atlas=bpy.data.images.new('District shared occlusion atlas',width=width,height=height,alpha=False)
    atlas.colorspace_settings.name='Non-Color'
    copies=[];palette={}
    for source in objects:
        obj=source.copy();obj.data=source.data.copy();bpy.context.scene.collection.objects.link(obj);copies.append(obj)
        image=next(slot.material.node_tree.nodes['Baked occlusion'].image for slot in source.material_slots)
        resolution=image.size[0]
        assert resolution in [1024,2048],'Unsupported AO tile size'
        slots=large_slots if resolution==2048 else small_slots
        assert slots,'Every static asset needs a reserved AO atlas tile'
        ox,oy=slots.pop(0)
        data=np.empty(resolution*resolution*4,dtype=np.float32);image.pixels.foreach_get(data)
        pixels[oy:oy+resolution,ox:ox+resolution]=data.reshape(resolution,resolution,4)
        # Canonical UV order also lets otherwise identical materials share shaders.
        uv_data={}
        for name in ['DetailUV','LightmapUV','RoomUV']:
            layer=obj.data.uv_layers.get(name);values=np.zeros(len(obj.data.loops)*2,dtype=np.float32)
            if layer:layer.data.foreach_get('uv',values)
            if name=='LightmapUV':values.reshape(-1,2)[:]=(values.reshape(-1,2)*resolution+np.array([ox,oy]))/np.array([width,height])
            uv_data[name]=values
        for layer in list(obj.data.uv_layers):obj.data.uv_layers.remove(layer)
        for name,values in uv_data.items():obj.data.uv_layers.new(name=name).data.foreach_set('uv',values)
        obj.data.uv_layers.active_index=0;obj.data.uv_layers[0].active_render=True
        for slot in obj.material_slots:
            original=slot.material;key=original.get('paletteKey',original.name.split('.')[0])
            if key not in palette:
                mat=original.copy();mat.name='District / '+key
                mat.node_tree.nodes['Baked occlusion'].image=atlas;palette[key]=mat
            slot.material=palette[key]
    atlas.pixels.foreach_set(pixels.ravel());atlas.pack()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in copies:obj.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
    combined=bpy.context.object;combined.name='Nocturne Harbor / batched runtime';combined['authoredIn']='Blender';combined['materialBatchCount']=len(palette)
    export([combined],OUT/'nocturne-city.glb')
    count=len(palette);bpy.data.objects.remove(combined,do_unlink=True)
    return {'materialBatches':count,'occlusionAtlas':[width,height]}

def finish():
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
    manifest=json.loads((OUT/'manifest.json').read_text())
    # Animated vehicles must not bake a stationary shadow onto the district.
    for asset in manifest['assets']:
        for obj in bpy.data.collections[asset['name']].objects:
            hidden=asset['moving']
            obj.hide_render=hidden;obj.hide_set(hidden)
    static=[]
    for asset in manifest['assets']:
        obj=next(o for o in bpy.data.collections[asset['name']].objects if o.type=='MESH')
        if not asset['moving']:bake(obj);static.append(obj)
        status('compressing asset',asset=obj.name)
        export([obj],OUT/asset['file'])
        bounds=[obj.matrix_world@__import__('mathutils').Vector(v) for v in obj.bound_box]
        asset['bounds']={'min':[min(p[i] for p in bounds) for i in range(3)],'max':[max(p[i] for p in bounds) for i in range(3)]}
        asset['bytes']=(OUT/asset['file']).stat().st_size
        if asset['moving']:obj.hide_render=True;obj.hide_set(True)
    manifest['runtime']=export_batched_city(static)
    manifest['version']=2;manifest['ambientOcclusion']='Cycles district occlusion, 3.2 m reach, dedicated LightmapUV channel';manifest['compression']='KHR_draco_mesh_compression'
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
    scene.cycles.samples=48;scene.render.resolution_percentage=100
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'nocturne-harbor.blend'))
    status('rendering Blender preview')
    bpy.ops.render.render(write_still=True)
    status('complete',bytes=(OUT/'nocturne-city.glb').stat().st_size)

if __name__=='__main__':
    try:finish()
    except Exception:
        status('failed',error=traceback.format_exc());raise
