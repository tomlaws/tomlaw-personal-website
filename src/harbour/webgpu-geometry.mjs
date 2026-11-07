import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import asset from './geometry-asset.json' with { type: 'json' };
import { geometrySignature,applyGeometryMap,readGeometryMaps } from './prepared-geometry.mjs';

export function loadPreparedGeometry(){
  return fetch(`${import.meta.env.BASE_URL}geometry/${asset.file}`).then(readGeometryMaps).catch(()=>null);
}

// Reuse identical vertices in the existing static batches. Every triangle and
// attribute (normals, UVs, colours and glazing emission) is retained. This changes
// buffer representation only, avoiding repeated vertex-shader work and memory.
export function indexStaticBatches(root) {
  const result = {before:0, after:0};
  root.getObjectByName('Coastal static batches')?.traverse(object => {
    if (!object.isMesh || object.geometry.index) return;
    const original = object.geometry;
    result.before += original.attributes.position.count;
    object.geometry = mergeVertices(original, 1e-6);
    result.after += object.geometry.attributes.position.count;
    original.dispose();
  });
  return result;
}

// Spread CPU preparation across tasks so startup can service resize/disposal
// messages and main-thread fallback can keep the page responsive.
export async function indexStaticBatchesAsync(root, checkpoint = () => new Promise(resolve => setTimeout(resolve, 0)), prepared = null) {
  const meshes=[];
  root.getObjectByName('Coastal static batches')?.traverse(object=>{if(object.isMesh&&!object.geometry.index)meshes.push(object);});
  const result={before:0,after:0,prepared:0};
  const maps=new Map(prepared?.map(entry=>[entry.signature,entry]));
  for(const object of meshes){
    const original=object.geometry;
    result.before+=original.attributes.position.count;
    const entry=maps.size?maps.get(await geometrySignature(original)):null;
    let geometry;
    if(entry){try{geometry=applyGeometryMap(original,entry);result.prepared++;}catch{/* Invalid prepared data uses the original indexer. */}}
    object.geometry=geometry??mergeVertices(original,1e-6);
    result.after+=object.geometry.attributes.position.count;original.dispose();
    await checkpoint();
  }
  return result;
}
