import asset from './world-asset.json' with {type:'json'};
import sourceHash from 'virtual:harbour-world-version';
import {restorePreparedWorldAsync} from './prepared-world.mjs';
import {loadPreparedData} from './prepared-data.mjs';

export async function loadHarbourWorld({procedural=false,diagnostic=()=>{}}={}){
  if(!procedural&&asset.sourceHash===sourceHash){
    try{
      let data;
      if (asset.brotliFile) {
        try { data = await loadPreparedData(`${import.meta.env.BASE_URL}world-br/${asset.brotliFile}`); }
        catch (error) { console.warn('Brotli scene unavailable; trying gzip.', error); }
      }
      data ??= await loadPreparedData(`${import.meta.env.BASE_URL}world/${asset.file}`);
      const world=await restorePreparedWorldAsync(data);diagnostic('world-source',{source:'prepared'});return world;
    }catch(error){console.warn('Prepared harbour unavailable; constructing the original scene.',error);}
  }
  const [{createWorld},{loadBuildingModels},{indexStaticBatchesAsync,loadPreparedGeometry}]=await Promise.all([
    import('./coastal-world.mjs'),import('./building-models.mjs'),import('./webgpu-geometry.mjs'),
  ]);
  const geometryMaps=loadPreparedGeometry(),models=await loadBuildingModels();
  const world=createWorld({models});
  await indexStaticBatchesAsync(world.root,undefined,await geometryMaps);
  diagnostic('world-source',{source:'procedural'});return world;
}
