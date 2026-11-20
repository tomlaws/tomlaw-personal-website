import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Scene,OrthographicCamera,Color,DataUtils,WebGLRenderTarget,HalfFloatType} from 'three';
import {readEnvironmentResponse} from '../src/harbour/environment-data.mjs';
import {orientWebGLLighting,encodePreparedLighting,decodePreparedLighting,readPreparedLighting,
  loadPreparedLighting} from '../src/harbour/prepared-lighting.mjs';
import {compileWebGLView} from '../src/harbour/startup-work.mjs';
import {createWaterReflection} from '../src/harbour/water-reflection.mjs';
import {loadPreparedData} from '../src/harbour/prepared-data.mjs';
import {readSceneData} from '../src/harbour/scene-codec.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');
const source=JSON.parse(await readFile('src/harbour/environment-asset.json'));
const asset=JSON.parse(await readFile('src/harbour/prepared-lighting-asset.json'));
const original=await readEnvironmentResponse(new Response(await readFile('public/lighting/'+source.file)));
const packed=await readFile('public/lighting/'+asset.file),raw=gunzipSync(packed);
assert.equal(asset.sourceSha256,source.sha256,'Prepared lighting is current');
assert.equal(hash(raw),asset.sha256,'Prepared lighting has its declared fingerprint');
assert.ok(packed.length<1_000_000,'Full-precision lighting stays under the 1 MB download budget');
const decoded=decodePreparedLighting(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
for(let i=0;i<2;i++){
  const restored=orientWebGLLighting(decoded[i]);
  assert.deepEqual(Buffer.from(restored.buffer),Buffer.from(original[i].data.buffer,
    original[i].data.byteOffset,original[i].data.byteLength),'All original PMREM texels survive packing and orientation conversion');
  assert.equal(decoded[i].width,original[i].width);assert.equal(decoded[i].height,original[i].height);
}
const zenith=Array.from(decoded[0].data.subarray((128*768+384)*4,(128*768+384)*4+3),DataUtils.fromHalfFloat);
assert.ok(zenith.every((v,i)=>Math.abs(v-new Color('#3f8ed4').toArray()[i])<.002),'WebGL +Y reflects the blue sky');
assert.deepEqual(new Uint8Array(encodePreparedLighting(decoded)),new Uint8Array(raw),'Lighting encoding is deterministic');
for(const body of [packed,raw]){
  const result=await readPreparedLighting(new Response(body));
  assert.deepEqual(result.map(e=>e.data),decoded.map(e=>e.data),'Lighting works with raw and HTTP-decompressed responses');
}
await assert.rejects(readPreparedLighting(new Response('',{status:503})),/503/);
assert.throws(()=>decodePreparedLighting(new ArrayBuffer(3)),/Incomplete/);
assert.throws(()=>decodePreparedLighting(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength-4)),/Invalid/);
const textures=await loadPreparedLighting('https://assets.example/lighting',async(url,options)=>{
  assert.ok(options.signal instanceof AbortSignal);return new Response(packed);
});
for(let i=0;i<2;i++){
  assert.deepEqual(textures[i].image.data,decoded[i].data);
  assert.equal(textures[i].mapping,decoded[i].mapping);textures[i].dispose();
}
await assert.rejects(loadPreparedLighting('https://assets.example/missing',async()=>new Response('',{status:404})),/404/);

// Match WebGLRenderer's synchronous parameter capture, asynchronous completion.
const previous={name:'previous'},mainTarget=new WebGLRenderTarget(10,10,{type:HalfFloatType});
let target=previous,finish,seededPlanes,compiled;
const planes=[],renderer={autoClear:true,clippingPlanes:planes,
  getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},
  render(empty){assert.equal(empty.children.length,0,'Warmup draws no scene geometry');
    assert.equal(this.autoClear,false,'Warmup cannot clear a presented target');seededPlanes=this.clippingPlanes.length;},
  compileAsync(scene,camera){compiled={scene,camera,target,planes:this.clippingPlanes.length};
    assert.equal(seededPlanes,this.clippingPlanes.length,'Warm the actual clipping variant');
    return new Promise(resolve=>finish=resolve);},
};
const scene=new Scene(),camera=new OrthographicCamera(-10,10,8,-8,.1,80);
camera.position.set(-18,17,18);camera.lookAt(0,0,0);
const main=compileWebGLView(renderer,scene,camera,mainTarget);
assert.equal(compiled.target,mainTarget,'Warm linear HDR rather than screen colour');
assert.equal(target,previous);assert.equal(renderer.autoClear,true,'Render state restores while the driver is still busy');
finish();await main;
const mirror=createWaterReflection(renderer,scene,camera,{level:-.35,resolution:512});
mirror.mesh.visible=false;
const reflection=mirror.compile();
assert.equal(compiled.planes,1);assert.equal(compiled.target.width,512);
assert.equal(renderer.clippingPlanes,planes);assert.equal(target,previous);
assert.equal(mirror.mesh.visible,false,'Precompilation preserves visibility');
finish();await reflection;
renderer.compileAsync=()=>{throw Error('Driver preparation failed');};
await assert.rejects(mirror.compile(),/Driver preparation failed/);
assert.equal(renderer.clippingPlanes,planes);assert.equal(target,previous);
assert.equal(mirror.mesh.visible,false);
mirror.dispose();mainTarget.dispose();

const worldAsset=JSON.parse(await readFile('src/harbour/world-asset.json'));
const worldBytes=await readFile('public/world/'+worldAsset.file);
const expected=await readSceneData(new Response(worldBytes));
let requests=0,workers=0,terminated=0;
const fetcher=async(url,options)=>{requests++;assert.ok(options.signal instanceof AbortSignal);return new Response(worldBytes);};
const direct=await loadPreparedData('https://assets.example/world',{inWorker:true,fetcher,
  createWorker:()=>{workers++;throw Error('Must not create a nested worker');}});
assert.equal(workers,0);assert.equal(requests,1);assert.deepEqual(direct.world,expected.world);
class Decoder {
  constructor(){workers++;}
  postMessage(){queueMicrotask(()=>this.onmessage({data:{scene:expected}}));}
  terminate(){terminated++;}
}
const offloaded=await loadPreparedData('https://assets.example/world',{inWorker:false,createWorker:()=>new Decoder(),fetcher});
assert.equal(offloaded,expected);assert.equal(workers,1);assert.equal(terminated,1);
assert.equal(requests,1,'The main thread still offloads scene decoding');
class FailingDecoder extends Decoder {postMessage(){queueMicrotask(()=>this.onmessage({data:{error:'Fixture decode failure'}}));}}
const warn=console.warn;console.warn=()=>{};
try{
  const fallback=await loadPreparedData('https://assets.example/world',{inWorker:false,createWorker:()=>new FailingDecoder(),fetcher});
  assert.deepEqual(fallback.world,expected.world);assert.equal(terminated,2);assert.equal(requests,2);
}finally{console.warn=warn;}
const config=JSON.parse(await readFile('vercel.json'));
for(const path of ['/assets/:file*','/lighting/:file*','/geometry/:file*'])
  assert.ok(config.headers.find(entry=>entry.source===path)?.headers.some(h=>h.key==='Cache-Control'&&h.value.includes('immutable')));
assert.ok(!config.headers.some(entry=>['/','/:path*'].includes(entry.source)),'HTML must stay revalidatable for deployments');
console.log(`Startup: ${packed.length} B lossless lighting, exact HDR/reflection warmup, state restoration, direct worker decoding and hashed-asset caching passed.`);
