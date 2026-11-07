// The original PMREM textures, stored without quantisation or resampling.
export function decodeEnvironmentData(buffer) {
  const view=new DataView(buffer),headerBytes=view.getUint32(0,true);
  if(headerBytes>65536||headerBytes+4>buffer.byteLength)throw new Error('Invalid harbour environment header');
  const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,headerBytes)));
  if(header.version!==1||header.entries.length!==2)throw new Error('Unsupported harbour environment data');
  let offset=Math.ceil((4+headerBytes)/4)*4;
  const result=header.entries.map(entry=>{
    if(entry.bytes!==entry.width*entry.height*8||offset+entry.bytes>buffer.byteLength)throw new Error('Incomplete harbour environment texture');
    const data=new Uint16Array(buffer,offset,entry.bytes/2);offset+=entry.bytes;
    return {...entry,data};
  });
  if(offset!==buffer.byteLength)throw new Error('Unexpected harbour environment bytes');
  return result;
}

export async function readEnvironmentResponse(response){
  if(!response.ok)throw new Error(`Environment HTTP ${response.status}`);
  let buffer=await response.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  // Static hosts may send the .gz file with Content-Encoding:gzip, in which
  // case fetch has already decoded it. Inspect the actual body to avoid a
  // second decompression and an unnecessary procedural-generation fallback.
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  return decodeEnvironmentData(buffer);
}
