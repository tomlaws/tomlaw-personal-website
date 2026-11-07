import asset from './world-asset.json' with {type:'json'};
import sourceHash from 'virtual:harbour-world-version';
import {readSceneData} from './scene-codec.mjs';
import {restorePreparedWorld} from './prepared-world.mjs';

// Use a worker for decompression and binary decoding so a cold load does not
// monopolise the page's main thread. Browsers without workers retain the same
// lossless scene and can still initialize using the original path.
async function loadPreparedData(url) {
  if (typeof Worker === 'undefined') return readSceneData(await fetch(url));
  let worker;
  try {
    worker = new Worker(new URL('./scene-decode-worker.js', import.meta.url), {type:'module'});
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({data}) => data.error ? reject(new Error(data.error)) : resolve(data.scene);
      worker.onerror = event => reject(new Error(event.message || 'Scene decode worker failed'));
      worker.onmessageerror = () => reject(new Error('Scene decode worker returned invalid data'));
      worker.postMessage({url});
    });
  } catch (error) {
    console.warn('Scene decode worker unavailable; decoding on the main thread.', error);
    return readSceneData(await fetch(url));
  } finally {
    worker?.terminate();
  }
}

export async function loadHarbourWorld({procedural=false,diagnostic=()=>{}}={}){
  if(!procedural&&asset.sourceHash===sourceHash){
    try{
      const data=await loadPreparedData(`${import.meta.env.BASE_URL}world/${asset.file}`);
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
