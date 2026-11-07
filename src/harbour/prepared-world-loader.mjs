import asset from './world-asset.json' with {type:'json'};
import sourceHash from 'virtual:harbour-world-version';
import {readSceneData} from './scene-codec.mjs';
import {restorePreparedWorld} from './prepared-world.mjs';

export async function loadHarbourWorld({procedural=false,diagnostic=()=>{}}={}){
  if(!procedural&&asset.sourceHash===sourceHash){
    try{
      const data=await readSceneData(await fetch(`${import.meta.env.BASE_URL}world/${asset.file}`));
      const world=restorePreparedWorld(data);diagnostic('world-source',{source:'prepared'});return world;
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
