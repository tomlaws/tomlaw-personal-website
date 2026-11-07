import {applyGeometryMap} from './prepared-geometry.mjs';

// Build-time only: deduplicate identical binary vertex records. Unlike a
// tolerance-based weld, this never merges nearby but different vertex values.
export function indexGeometryExactly(original){
  if(original.index)return original;
  const attributes=Object.values(original.attributes);
  if(attributes.some(attribute=>attribute.isInterleavedBufferAttribute))throw new Error('Exact indexing expects plain vertex attributes');
  const views=attributes.map(attribute=>new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  const strides=attributes.map(attribute=>attribute.itemSize*attribute.array.BYTES_PER_ELEMENT);
  const vertices=original.attributes.position.count,index=new Uint32Array(vertices),sources=[],map=new Map();
  for(let vertex=0;vertex<vertices;vertex++){
    let key='';
    for(let attribute=0;attribute<views.length;attribute++){
      const bytes=views[attribute],stride=strides[attribute],offset=vertex*stride;
      for(let i=0;i<stride;i++)key+=String.fromCharCode(bytes[offset+i]);
    }
    let mapped=map.get(key);
    if(mapped===undefined){mapped=sources.length;map.set(key,mapped);sources.push(vertex);}
    index[vertex]=mapped;
  }
  return applyGeometryMap(original,{index,sources:new Uint32Array(sources)});
}
