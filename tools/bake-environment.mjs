import * as T from 'three/webgpu';
import { createNodeEnvironment } from '../src/harbour/webgpu-sky.mjs';

const status=document.getElementById('status');
try {
  const renderer=new T.WebGPURenderer({canvas:document.getElementById('gpu')});
  await renderer.init();
  const environment=await createNodeEnvironment(renderer,{procedural:true});
  const chunks=[],entries=[];
  for (const [index,target] of environment.sourceTargets.entries()) {
    const pixels=await renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height);
    chunks.push(new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength));
    entries.push({name:index?'night':'day',width:target.width,height:target.height,bytes:pixels.byteLength,
      mapping:target.texture.mapping,minFilter:target.texture.minFilter,magFilter:target.texture.magFilter,
      colorSpace:target.texture.colorSpace,flipY:target.texture.flipY});
  }
  const header=new TextEncoder().encode(JSON.stringify({version:1,entries}));
  const size=new Uint32Array([header.byteLength]);
  const padding=new Uint8Array((4-header.byteLength%4)%4);
  const blob=new Blob([size,header,padding,...chunks],{type:'application/octet-stream'});
  const compressed=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const link=document.createElement('a');link.download='harbour-environment.bin.gz';
  link.href=URL.createObjectURL(compressed);link.textContent='Download original reflection lighting';document.body.append(link);
  status.textContent=`Ready: ${entries.map(entry=>`${entry.name} ${entry.width}×${entry.height}`).join(', ')}; ${compressed.size} bytes, lossless half-float data.`;
  environment.dispose();renderer.onDeviceLost=()=>{};renderer.dispose();renderer.backend.device.destroy();
} catch(error) {status.textContent=error.stack;console.error(error);}
