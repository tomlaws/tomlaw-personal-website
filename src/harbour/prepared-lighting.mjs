import { DataTexture, RGBAFormat, HalfFloatType } from 'three';

// Three's node PMREM looks up -Y; its WebGL sampler looks up +Y. Convert the
// packed faces and mip tiles by permuting texels, preserving every half-float.
export function orientWebGLLighting({width,height,data}) {
  const cubeSize=height/4,maxMip=Math.log2(cubeSize),output=data.slice();
  if(!Number.isInteger(maxMip)||maxMip<4)throw new Error('Unsupported lighting dimensions');
  for(let mip=maxMip;mip>=-2;mip--){
    const size=2**Math.max(4,mip),ox=Math.max(4-mip,0)*48,oy=4*(cubeSize-size);
    for(let face=0;face<6;face++){
      const source=face===1?4:face===4?1:face;
      for(let y=0;y<size;y++){
        const from=((oy+(source>2?size:0)+size-1-y)*width+ox+source%3*size)*4;
        const to=((oy+(face>2?size:0)+y)*width+ox+face%3*size)*4;
        output.set(data.subarray(from,from+size*4),to);
      }
    }
  }
  return output;
}

// Reversible RGBA16 deltas and byte planes make the original smooth PMREM
// textures smaller on the wire. This is integer arithmetic, not quantisation.
export function encodePreparedLighting(entries) {
  const header=new TextEncoder().encode(JSON.stringify({version:1,codec:'rgba16-delta-x',
    entries:entries.map(({data,...entry})=>entry)}));
  const start=Math.ceil((4+header.length)/4)*4;
  const buffer=new ArrayBuffer(start+entries.reduce((sum,e)=>sum+e.data.byteLength,0));
  new DataView(buffer).setUint32(0,header.length,true);new Uint8Array(buffer,4,header.length).set(header);
  let offset=start;
  for(const {data,width} of entries){
    const bytes=new Uint8Array(buffer,offset,data.byteLength),stride=width*4;
    for(let i=0;i<data.length;i++){
      const delta=(data[i]-(i%stride>=4?data[i-4]:0))&65535;
      bytes[i]=delta&255;bytes[i+data.length]=delta>>8;
    }
    offset+=data.byteLength;
  }
  return buffer;
}

export function decodePreparedLighting(buffer) {
  if(buffer.byteLength<4)throw new Error('Incomplete prepared lighting');
  const size=new DataView(buffer).getUint32(0,true);
  if(size>65536||size+4>buffer.byteLength)throw new Error('Invalid prepared lighting header');
  const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,size)));
  if(header.version!==1||header.codec!=='rgba16-delta-x'||header.entries?.length!==2)
    throw new Error('Unsupported prepared lighting');
  let offset=Math.ceil((4+size)/4)*4;
  const entries=header.entries.map(entry=>{
    const {width,height,bytes}=entry;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096||
      bytes!==width*height*8||offset+bytes>buffer.byteLength)throw new Error('Invalid lighting texture');
    const data=new Uint16Array(bytes/2),source=new Uint8Array(buffer,offset,bytes),stride=width*4;
    for(let i=0;i<data.length;i++){
      const delta=source[i]|source[i+data.length]<<8;
      data[i]=(delta+(i%stride>=4?data[i-4]:0))&65535;
    }
    offset+=bytes;return {...entry,data};
  });
  if(offset!==buffer.byteLength||entries[0].name!=='day'||entries[1].name!=='night')
    throw new Error('Invalid prepared lighting entries');
  return entries;
}

export async function readPreparedLighting(response) {
  if(!response.ok)throw new Error(`Prepared lighting HTTP ${response.status}`);
  let buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
  if(bytes[0]===0x1f&&bytes[1]===0x8b)
    buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return decodePreparedLighting(buffer);
}

export async function loadPreparedLighting(url,fetcher=fetch) {
  const response=await fetcher(url,{signal:AbortSignal.timeout(10_000)});
  const entries=await readPreparedLighting(response);
  return entries.map(entry=>{
    const texture=new DataTexture(entry.data,entry.width,entry.height,RGBAFormat,HalfFloatType);
    Object.assign(texture,{mapping:entry.mapping,minFilter:entry.minFilter,magFilter:entry.magFilter,
      colorSpace:entry.colorSpace,flipY:entry.flipY,generateMipmaps:false,needsUpdate:true});
    return texture;
  });
}
