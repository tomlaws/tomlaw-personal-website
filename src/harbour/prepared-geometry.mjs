import { BufferAttribute } from 'three';

// Store only the lossless welding map. Positions, normals, UVs and window-light
// attributes still come from the current live world, never a second model.
export async function geometrySignature(geometry) {
  const parts=[];
  for(const [name,attribute] of Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b))){
    parts.push(new TextEncoder().encode(`${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}\n`));
    parts.push(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  }
  const bytes=new Uint8Array(parts.reduce((sum,part)=>sum+part.byteLength,0));
  let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
}

export function encodeGeometryMaps(entries) {
  const header=new TextEncoder().encode(JSON.stringify({version:2,entries:entries.map(({signature,index,sources})=>({signature,indexCount:index.length,sourceCount:sources.length}))}));
  const start=Math.ceil((4+header.length)/4)*4;
  const buffer=new ArrayBuffer(start+entries.reduce((size,{index,sources})=>size+4*(index.length+sources.length),0));
  new DataView(buffer).setUint32(0,header.length,true);new Uint8Array(buffer,4,header.length).set(header);
  let offset=start;
  // Zigzag deltas compress the nearly sequential indices without quantisation.
  for(const {index,sources} of entries){for(const values of [index,sources]){
    const output=new Uint32Array(buffer,offset,values.length);let previous=0;
    for(let i=0;i<values.length;i++){const delta=values[i]-previous;output[i]=(delta<<1)^(delta>>31);previous=values[i];}
    offset+=values.length*4;
  }}
  return buffer;
}

export function decodeGeometryMaps(buffer) {
  const length=new DataView(buffer).getUint32(0,true);
  if(length>65536||length+4>buffer.byteLength)throw new Error('Invalid geometry map header');
  const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length)));
  if(header.version!==2||!Array.isArray(header.entries))throw new Error('Unsupported geometry maps');
  let offset=Math.ceil((4+length)/4)*4;
  const entries=header.entries.map(entry=>{
    const {indexCount,sourceCount}=entry;
    if(!Number.isSafeInteger(indexCount)||!Number.isSafeInteger(sourceCount)||indexCount<0||sourceCount<0||offset+4*(indexCount+sourceCount)>buffer.byteLength)throw new Error('Incomplete geometry maps');
    const index=new Uint32Array(buffer,offset,indexCount);offset+=indexCount*4;
    const sources=new Uint32Array(buffer,offset,sourceCount);offset+=sourceCount*4;
    for(const values of [index,sources]){let previous=0;for(let i=0;i<values.length;i++){const value=values[i];previous+=(value>>>1)^-(value&1);values[i]=previous;}}
    return {...entry,index,sources};
  });
  if(offset!==buffer.byteLength)throw new Error('Unexpected geometry map bytes');
  return entries;
}

export function applyGeometryMap(original,{index,sources}) {
  const vertices=original.attributes.position.count;
  if(index.length!==vertices||index.some(value=>value>=sources.length)||sources.some(value=>value>=vertices))throw new Error('Invalid geometry map indices');
  const geometry=original.clone();
  for(const [name,attribute] of Object.entries(original.attributes)){
    const {array,itemSize}=attribute;
    const values=new array.constructor(sources.length*itemSize);
    for(let i=0;i<sources.length;i++)for(let axis=0;axis<itemSize;axis++)values[i*itemSize+axis]=array[sources[i]*itemSize+axis];
    geometry.setAttribute(name,new BufferAttribute(values,itemSize,attribute.normalized));
  }
  geometry.setIndex(new BufferAttribute(sources.length>65535?index:new Uint16Array(index),1));
  return geometry;
}

export async function readGeometryMaps(response){
  if(!response.ok)throw new Error(`Geometry maps HTTP ${response.status}`);
  let buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
  if(bytes[0]===0x1f&&bytes[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return decodeGeometryMaps(buffer);
}
