const arrayTypes={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array,Uint8ClampedArray};

// JSON scene structure + aligned, unquantised typed arrays. No geometry or
// texture compression that changes values is used; HTTP/gzip handles transport.
export function encodeSceneData(value){
  const buffers=[];
  function pack(object){
    if(!object||typeof object!=='object')return object;
    if(Array.isArray(object))return object.map(pack);
    const result={};
    for(const [key,child] of Object.entries(object)){
      if(key==='array'&&arrayTypes[object.type]&&Array.isArray(child)){
        result[key]={binary:buffers.length};buffers.push({array:new arrayTypes[object.type](child),stride:object.itemSize??1});
      }else result[key]=pack(child);
    }
    return result;
  }
  const data=pack(value);
  const header=new TextEncoder().encode(JSON.stringify({version:2,data,buffers:buffers.map(({array,stride})=>({type:array.constructor.name,length:array.length,stride}))}));
  const start=Math.ceil((header.length+4)/8)*8;
  const buffer=new ArrayBuffer(start+buffers.reduce((sum,{array})=>sum+Math.ceil(array.byteLength/8)*8,0));
  new DataView(buffer).setUint32(0,header.length,true);new Uint8Array(buffer,4,header.length).set(header);
  let offset=start;
  for(const {array,stride} of buffers){
    // XOR neighbouring records and shuffle byte planes to improve ordinary
    // gzip compression. This is reversible bit manipulation, not quantisation.
    const source=new Uint8Array(array.buffer),output=new Uint8Array(buffer,offset,array.byteLength),size=array.BYTES_PER_ELEMENT;
    for(let byte=0;byte<size;byte++)for(let i=0;i<array.length;i++)output[byte*array.length+i]=source[i*size+byte]^(i>=stride?source[(i-stride)*size+byte]:0);
    offset+=Math.ceil(array.byteLength/8)*8;
  }
  return buffer;
}

export function decodeSceneData(buffer){
  const length=new DataView(buffer).getUint32(0,true);
  if(length>32*1024*1024||length+4>buffer.byteLength)throw new Error('Invalid prepared scene header');
  const header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length)));
  if(header.version!==2||!Array.isArray(header.buffers))throw new Error('Unsupported prepared scene');
  let offset=Math.ceil((length+4)/8)*8;
  const arrays=header.buffers.map(({type,length,stride})=>{
    const Type=arrayTypes[type];
    if(!Type||!Number.isSafeInteger(length)||length<0||!Number.isSafeInteger(stride)||stride<1||offset+length*Type.BYTES_PER_ELEMENT>buffer.byteLength)throw new Error('Incomplete prepared scene buffer');
    const array=new Type(length),size=Type.BYTES_PER_ELEMENT,source=new Uint8Array(buffer,offset,array.byteLength),output=new Uint8Array(array.buffer);
    for(let byte=0;byte<size;byte++)for(let i=0;i<length;i++)output[i*size+byte]=source[byte*length+i]^(i>=stride?output[(i-stride)*size+byte]:0);
    offset+=Math.ceil(array.byteLength/8)*8;return array;
  });
  if(offset!==buffer.byteLength)throw new Error('Unexpected prepared scene bytes');
  function unpack(object){
    if(!object||typeof object!=='object')return object;
    if(Object.keys(object).length===1&&Number.isInteger(object.binary)){
      if(!arrays[object.binary])throw new Error('Invalid prepared scene reference');
      return arrays[object.binary];
    }
    for(const key of Object.keys(object))object[key]=unpack(object[key]);
    return object;
  }
  return unpack(header.data);
}

export async function readSceneData(response){
  if(!response.ok)throw new Error(`Prepared scene HTTP ${response.status}`);
  let buffer=await response.arrayBuffer();const bytes=new Uint8Array(buffer);
  if(bytes[0]===0x1f&&bytes[1]===0x8b)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return decodeSceneData(buffer);
}
