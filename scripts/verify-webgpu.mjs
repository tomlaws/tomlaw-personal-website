import { resizeWebGpuBuffer } from '../src/harbour/frame-resize.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Mesh, Group, BoxGeometry, BufferGeometry, MeshPhysicalMaterial, Float32BufferAttribute, Scene, OrthographicCamera, WebGPUCoordinateSystem, NeutralToneMapping, SRGBColorSpace, BackSide, Vector3, Vector2, FramebufferTexture, RenderTarget } from 'three';
import { ClippingGroup, ViewportTextureNode } from 'three/webgpu';
import { portHarbourMaterials } from '../src/harbour/webgpu-materials.mjs';
import { createNodeSky, DAY_SKY, mixedSky } from '../src/harbour/webgpu-sky.mjs';
import { createNodePostProcessing } from '../src/harbour/webgpu-post.mjs';
import { createNodeWaterReflection } from '../src/harbour/webgpu-reflection.mjs';
import { isolateFramebufferTextures } from '../src/harbour/webgpu-compat.mjs';
import { cacheViewPass } from '../src/harbour/cached-view-pass.mjs';
import { indexStaticBatches,indexStaticBatchesAsync } from '../src/harbour/webgpu-geometry.mjs';
import { createRenderBudget } from '../src/harbour/render-budget.mjs';
import { nextBackgroundFrame } from '../src/harbour/frame-pacing.mjs';
import { createWorkerRenderHost } from '../src/harbour/render-host.mjs';
import { mapPixelRatio } from '../src/harbour/render-quality.mjs';
import { decodeEnvironmentData,readEnvironmentResponse } from '../src/harbour/environment-data.mjs';
import { createWorkQueue,warmScenePipelines } from '../src/harbour/startup-work.mjs';
import {CompactLighting} from '../src/harbour/compact-lighting.mjs';
import {PointLight,HemisphereLight} from 'three';
import {createCoastalLighting} from '../src/harbour/coastal-lighting.mjs';
import {createGpuFrameTimer} from '../src/harbour/gpu-frame-timer.mjs';

// Reassigning canvas dimensions clears even a completed WebGPU frame.
const sizeFixture={width:800,height:600,dpr:1.5,resizes:0,
  getSize(target){return target.set(this.width,this.height);},
  getPixelRatio(){return this.dpr;},
  setDrawingBufferSize(width,height,dpr){Object.assign(this,{width,height,dpr});this.resizes++;},
};
assert.equal(resizeWebGpuBuffer(sizeFixture,800,600,1.5),false);
assert.equal(sizeFixture.resizes,0,'An unchanged viewport retains the rendered first frame');
assert.equal(resizeWebGpuBuffer(sizeFixture,810,600,1.5),true);
assert.equal(resizeWebGpuBuffer(sizeFixture,810,600,2),true);
assert.equal(sizeFixture.resizes,2,'Real viewport and DPR changes resize exactly once each');

// Off-map traffic must not change the shader's light count or recompile every
// material. It must still produce no headlight illumination beyond the road.
const trafficScene=new Scene(),trafficCars=Array.from({length:4},()=>{
  const g=new Group();g.userData.headlightPosition=[.4,.3,0];g.userData.headlightTarget=[2.5,.05,0];
  return {g};
});
const trafficLighting=createCoastalLighting(trafficScene,{cars:trafficCars});
for(const {light} of trafficLighting.headlamps)light.userData.nightIntensity=1.7;
const lightCounts=[];
for(let phase=0;phase<8;phase++){
  trafficCars.forEach(({g},index)=>{g.visible=Boolean((phase>>index%3)&1);g.position.x=index+phase;g.updateMatrixWorld(true);});
  trafficLighting.update();
  let count=0;trafficScene.traverseVisible(object=>{if(object.isLight)count++;});lightCounts.push(count);
  for(const {car,light} of trafficLighting.headlamps){
    assert.equal(light.intensity,car.g.visible?1.7:0,'Hidden traffic emits no headlight light');
    assert.equal(light.position.x,car.g.position.x+.4,'Headlights retain their original moving pose');
  }
}
assert.equal(new Set(lightCounts).size,1,'Vehicle visibility never changes the light/pipeline count');

const unsupportedTimer=createGpuFrameTimer({getExtension:()=>null});
unsupportedTimer.begin();unsupportedTimer.end();assert.equal(unsupportedTimer.read(),undefined);unsupportedTimer.dispose();
let queryAvailable=false,queryDisjoint=false,queryDeleted=false;
const gpuClock=createGpuFrameTimer({
  getExtension:()=>({TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2}),createQuery:()=>({}),
  QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,beginQuery(){},endQuery(){},
  getParameter:()=>queryDisjoint,getQueryParameter:(_,kind)=>kind===3?queryAvailable:12_000_000,
  deleteQuery(){queryDeleted=true;},
});
gpuClock.begin();gpuClock.end();assert.equal(gpuClock.read(),undefined,'GPU queries never block for an unavailable result');
queryAvailable=true;assert.equal(gpuClock.read(),12,'GPU time is measured independently of RAF scheduling');
queryDisjoint=true;assert.equal(gpuClock.read(),undefined,'Disjoint measurements use the conservative fallback');
gpuClock.dispose();assert.equal(queryDeleted,true);

const sharedLighting=new CompactLighting(),testPoint=new PointLight('#ffdf88',2,4,2),testSky=new HemisphereLight();
testPoint.position.set(3,4,5);testPoint.updateMatrixWorld(true);
const pointList=sharedLighting.createNode([testPoint,testSky]);
assert.equal(pointList.points.length,1);
assert.equal(sharedLighting.createNode([...pointList.getLights()]).points.length,1,'Material environment copies retain every point light');
const positionBuffer=pointList.positionNode;
pointList.setLights([testPoint,testSky]);
assert.equal(pointList.positionNode,positionBuffer,'Compiling another material never replaces live light buffers');
const lightCamera=new OrthographicCamera();lightCamera.position.set(0,0,10);lightCamera.updateMatrixWorld(true);
pointList.updateBefore({camera:lightCamera});
assert.deepEqual(pointList.positions[0].toArray(),[3,4,-5,4]);
assert.deepEqual(pointList.colours[0].toArray(),[testPoint.color.r*2,testPoint.color.g*2,testPoint.color.b*2,2]);
testPoint.intensity=3;pointList.updateBefore({camera:lightCamera});
assert.equal(pointList.colours[0].x,testPoint.color.r*3,'Changing night lighting updates the same buffer');
assert.equal(sharedLighting.createNode([testPoint]).hasLights,true,'Point-only scenes remain illuminated');

const envAsset=JSON.parse(readFileSync('src/harbour/environment-asset.json','utf8'));
const envBytes=gunzipSync(readFileSync(`public/lighting/${envAsset.file}`));
assert.equal(createHash('sha256').update(envBytes).digest('hex'),envAsset.sha256,'Prepared lighting keeps its original half-float bytes');
const environments=decodeEnvironmentData(envBytes.buffer.slice(envBytes.byteOffset,envBytes.byteOffset+envBytes.byteLength));
assert.deepEqual(environments.map(({name,width,height})=>[name,width,height]),[['day',768,1024],['night',768,1024]],'No sky reflection resampling or resolution reduction');
for(const entry of environments)assert.equal(entry.data.byteLength,entry.width*entry.height*8);
for(const body of [readFileSync(`public/lighting/${envAsset.file}`),envBytes]){
  const decoded=await readEnvironmentResponse(new Response(body));
  assert.deepEqual(decoded.map(entry=>entry.data),environments.map(entry=>entry.data),'Prepared lighting works whether the HTTP server decompresses it or serves gzip bytes');
}
assert.throws(()=>decodeEnvironmentData(new ArrayBuffer(4)),'Corrupt prepared lighting is rejected for procedural fallback');

const queue=createWorkQueue(2);let active=0,peak=0;
const queuedResults=await Promise.allSettled(Array.from({length:7},(_,i)=>queue(async()=>{
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
  if(i===3)throw new Error('Expected compilation rejection');return i;
})));
assert.equal(peak,2,'Startup never launches an unbounded driver compilation burst');
assert.equal(queuedResults.filter(result=>result.status==='fulfilled').length,6,'A failed preparation does not stall the queue');
const compileMethod=()=>{},copyMethodFixture=()=>{};
const warmTarget={texture:{type:'half-float'}},warmAllocations=[];
const warmRenderer={backend:{device:{createRenderPipelineAsync:compileMethod}},copyFramebufferToTexture:copyMethodFixture,
  getRenderTarget:()=>warmTarget,_textures:{updateTexture:(texture,options)=>warmAllocations.push(options)}};
await warmScenePipelines(warmRenderer,async()=>warmRenderer.copyFramebufferToTexture({}));
assert.equal(warmAllocations[0].renderTarget,warmTarget,'Warmup transmission snapshots use the HDR target format, not the canvas format');
await assert.rejects(warmScenePipelines(warmRenderer,async()=>{throw new Error('Expected startup failure');}));
assert.equal(warmRenderer.backend.device.createRenderPipelineAsync,compileMethod);
assert.equal(warmRenderer.copyFramebufferToTexture,copyMethodFixture,'Temporary warmup hooks are restored after failure');
const rejectCompile=async()=>{throw new Error('Expected driver rejection');};
warmRenderer.backend.device.createRenderPipelineAsync=rejectCompile;
await assert.rejects(warmScenePipelines(warmRenderer,()=>new Promise(resolve=>{
  warmRenderer.backend.device.createRenderPipelineAsync({}).then(resolve);
})),/Expected driver rejection/,'Driver errors cannot leave startup hanging in r180');
assert.equal(warmRenderer.backend.device.createRenderPipelineAsync,rejectCompile);


for (const ratio of [0.5, 1, 1.25, 1.5, 2, 3, NaN]) {
  assert.ok(mapPixelRatio(ratio) >= 1, 'Map resolution never falls below one pixel per CSS pixel');
  assert.ok(mapPixelRatio(ratio) <= 1.5, 'Retina rendering stays bounded');
}
assert.equal(mapPixelRatio(1.25), 1.25, 'Retain fractional display scaling without upscaling a smaller image');

// Reusing static vertices keeps the entire expanded triangle/attribute stream.
const indexedRoot = new Group(), batchGroup = new Group(); batchGroup.name='Coastal static batches'; indexedRoot.add(batchGroup);
const quad = new BufferGeometry();
quad.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1,0],3));
quad.setAttribute('harbourLightUV',new Float32BufferAttribute([0,0,1,0,0,1,0,1,1,0,1,1],2));
quad.setAttribute('harbourEmission',new Float32BufferAttribute(new Array(18).fill(.8),3));
const originalAttributes=Object.fromEntries(Object.entries(quad.attributes).map(([name,attribute])=>[name,[...attribute.array]]));
const batchMesh=new Mesh(quad,new MeshPhysicalMaterial());batchGroup.add(batchMesh);
assert.deepEqual(indexStaticBatches(indexedRoot),{before:6,after:4});
const cooperativeRoot=new Group(),cooperativeGroup=new Group();cooperativeGroup.name='Coastal static batches';cooperativeRoot.add(cooperativeGroup);
for(let index=0;index<2;index++)cooperativeGroup.add(new Mesh(quad.clone(),batchMesh.material));
let yields=0;
assert.deepEqual(await indexStaticBatchesAsync(cooperativeRoot,async()=>{yields++;}),{before:12,after:8,prepared:0});
assert.equal(yields,2,'Index preparation yields between batches without dropping vertices');
cooperativeGroup.children.forEach(mesh=>mesh.geometry.dispose());
const expanded=batchMesh.geometry.toNonIndexed();
for(const [name,values] of Object.entries(originalAttributes))assert.deepEqual([...expanded.attributes[name].array],values,`${name} survives indexing unchanged`);
expanded.dispose();batchMesh.geometry.dispose();batchMesh.material.dispose();

const cacheCamera=new OrthographicCamera();cacheCamera.updateMatrixWorld();
let cacheTime=0,passes=0,cacheDpr=1;const cacheSize=new Vector2(800,600);
const cachedPass={updateBefore(){passes++;}};
const invalidate=cacheViewPass(cachedPass,{getSize:out=>out.copy(cacheSize),getPixelRatio:()=>cacheDpr},cacheCamera,100,()=>cacheTime);
cachedPass.updateBefore();cacheTime=16;cachedPass.updateBefore();assert.equal(passes,1,'Complete effect pass reuses its output');
cacheCamera.position.x++;cacheCamera.updateMatrixWorld();cachedPass.updateBefore();assert.equal(passes,2,'Camera changes refresh immediately');
cacheTime=120;cachedPass.updateBefore();assert.equal(passes,3,'Scene motion receives periodic refreshes');
cacheSize.x=900;cachedPass.updateBefore();assert.equal(passes,4,'Viewport resize invalidates effects');
cacheDpr=.8;cachedPass.updateBefore();assert.equal(passes,5,'Adaptive DPR invalidates effects');
invalidate();cachedPass.updateBefore();assert.equal(passes,6,'Lighting changes invalidate effects');
const gpuBudget=createRenderBudget(()=>{}, {initialPixels:750_000,minimumPixels:350_000,sampleCount:24,gpuBudgetMs:20,targetFrameMs:60});
for(let i=0;i<60;i++)gpuBudget.observe(1000,5,8);
assert.equal(gpuBudget.pixels,750_000,'Browser throttling alone does not lower quality');
for(let i=0;i<24;i++)gpuBudget.observe(50,5,12);
assert.equal(gpuBudget.pixels,750_000,'Intentional background frame pacing does not lower quality');
for(let i=0;i<24;i++)gpuBudget.observe(50,5,35);
assert.equal(gpuBudget.pixels,637_500,'GPU overload adapts even when CPU submission is cheap');
for(let i=0;i<8;i++)gpuBudget.observe(1000,5,300);
assert.equal(gpuBudget.pixels,350_000,'Severe GPU overload reacts promptly and respects the floor');
assert.ok(Math.abs(nextBackgroundFrame(1000/24,50,60)-2000/24)<.001,'Late RAFs retain the intended average cadence');
assert.ok(nextBackgroundFrame(0,0,80)>=80/.6,'Slow frames leave GPU headroom');
assert.ok(Math.abs(nextBackgroundFrame(0,1000,1010)-1000-1000/24)<.001,'Resuming does not trigger a burst of catch-up frames');

const workerState={search:'',width:800,height:600,dpr:1,hidden:false,reducedMotion:false,night:1};
const workerMessages=[],workerCommands=[];const workerHost=createWorkerRenderHost({},workerState,message=>workerMessages.push(message));
const detach=workerHost.connect({setTime:value=>workerCommands.push(['time',value]),setActive:value=>workerCommands.push(['active',value]),setScroll:value=>workerCommands.push(['scroll',value])});
let resizes=0,motions=0,disposals=0;
workerHost.onResize(()=>resizes++);workerHost.onMotion(()=>motions++);workerHost.onDispose(()=>disposals++);
workerHost.receive({type:'resize',viewport:{width:900,height:700,dpr:.8}});
workerHost.receive({type:'visibility',hidden:true});workerHost.receive({type:'motion',reducedMotion:true});
workerHost.receive({type:'active',active:false});workerHost.receive({type:'scroll',progress:.5});workerHost.receive({type:'time',night:.7});
assert.deepEqual([workerHost.width,workerHost.height,workerHost.dpr,workerHost.hidden,workerHost.reducedMotion],[900,700,.8,true,true]);
assert.deepEqual(workerCommands,[['active',false],['scroll',.5],['time',.7]]);
assert.deepEqual([resizes,motions],[1,1]);workerHost.ready('webgpu');assert.deepEqual(workerMessages,[{type:'ready',backend:'webgpu'}]);
detach();workerHost.receive({type:'scroll',progress:1});assert.equal(workerCommands.length,3);
workerHost.receive({type:'dispose'});assert.equal(disposals,1);

// Reproduce alternating reflection/main transmission captures without a GPU.
// Shared Source/image metadata used to resize/reallocate both snapshots at
// every capture; after a resize it could also leave one GPU texture stale.
isolateFramebufferTextures();
const copyMethod = FramebufferTexture.prototype.copy;
assert.equal(isolateFramebufferTextures(),false,'The upstream compatibility fix is idempotent');
assert.equal(FramebufferTexture.prototype.copy,copyMethod);
const viewport = new ViewportTextureNode(), mainTarget = new RenderTarget(867,1152), reflectionTarget = new RenderTarget(1024,1024);
const capture = target => {
  const renderer = {getRenderTarget:()=>target,copyFramebufferToTexture(){}};
  viewport.updateReference({renderer}); viewport.updateBefore({renderer});
  return viewport.getTextureForReference(target);
};
const mainSnapshot = capture(mainTarget), reflectionSnapshot = capture(reflectionTarget);
assert.notEqual(mainSnapshot.source,reflectionSnapshot.source,'Camera captures own independent framebuffer sources');
assert.notEqual(mainSnapshot.image,reflectionSnapshot.image,'Capture dimensions are independent');
const versions = [mainSnapshot.version,reflectionSnapshot.version];
for(let i=0;i<16;i++) {capture(reflectionTarget);capture(mainTarget);}
assert.deepEqual([mainSnapshot.version,reflectionSnapshot.version],versions,'Reflection refreshes never invalidate the main-camera glass snapshot');
mainTarget.setSize(640,480);reflectionTarget.setSize(640,480);
capture(mainTarget);capture(reflectionTarget);
assert.ok(mainSnapshot.version>versions[0]&&reflectionSnapshot.version>versions[1],'Both snapshots invalidate independently on resize');
assert.deepEqual([mainSnapshot.image.width,reflectionSnapshot.image.width],[640,640]);
mainTarget.dispose();reflectionTarget.dispose();mainSnapshot.dispose();reflectionSnapshot.dispose();viewport.defaultFramebuffer.dispose();

const root = new Group(), finish = new MeshPhysicalMaterial({ color: '#407b91', emissive: '#ffdf88', emissiveIntensity: .5 });
const pane = new BoxGeometry(1, 1, .02), count = pane.attributes.position.count;
pane.setAttribute('harbourEmission', new Float32BufferAttribute(new Float32Array(count*3).fill(.4),3));
pane.setAttribute('harbourLightUV', new Float32BufferAttribute(new Float32Array(count*2).fill(.5),2));
pane.setAttribute('harbourRoundWindow', new Float32BufferAttribute(new Float32Array(count).fill(1),1));
const frame = new BoxGeometry(.1, 2, .1), before = [...pane.attributes.position.array], beforeFrame=[...frame.attributes.position.array];
root.add(new Mesh(pane,finish),new Mesh(frame,finish));
const night={value:1}, features=portHarbourMaterials(root,night);
assert.equal(root.children[0].material,finish,'Lighting retains the original live material object');
assert.equal(features.get(finish).soft,true);
assert.ok(finish.emissiveNode.isNode,'Window emission is a portable TSL graph');
assert.deepEqual([...pane.attributes.position.array],before,'Migration preserves glazing geometry');
assert.deepEqual([...frame.attributes.position.array],beforeFrame,'Migration preserves structural geometry');
assert.ok(frame.attributes.harbourEmission.array.every(value=>value===0),'Unlit uses of a shared finish remain unlit');
for (const kind of ['vehicle','ferry']) {
  const geometry=new BoxGeometry(1,1,1),material=new MeshPhysicalMaterial();
  if(kind==='vehicle') {
    geometry.setAttribute('vehicleLightUV',new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2).fill(.5),2));
    geometry.setAttribute('vehicleLightGain',new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));
  } else material.name='Star Ferry warm passenger glazing';
  const group=new Group();group.add(new Mesh(geometry,material));portHarbourMaterials(group,night);
  assert.ok(material.emissiveNode.isNode,`${kind} keeps its custom lit glass`);
  if(kind==='vehicle')assert.ok(material.colorNode.isNode);
  geometry.dispose();material.dispose();
}
const sky=createNodeSky(DAY_SKY);
assert.ok(sky.mesh.material.isNodeMaterial);assert.ok(sky.mesh.material.fragmentNode.isNode);
assert.equal(sky.mesh.material.side,BackSide,'The reflected sky remains visible from inside its dome');
assert.equal(sky.mesh.material.fog,false);
assert.equal(sky.mesh.material.depthWrite,false);
for(const t of [0,.5,1])sky.set(mixedSky(t));sky.dispose();
const camera=new OrthographicCamera(-10,10,8,-8,.1,80);camera.coordinateSystem=WebGPUCoordinateSystem;
const fakeRenderer={toneMapping:NeutralToneMapping,outputColorSpace:SRGBColorSpace,coordinateSystem:WebGPUCoordinateSystem};
const pipeline=createNodePostProcessing(fakeRenderer,new Scene(),camera);
pipeline.setTime(0);pipeline.setTime(1);pipeline.setBackground('#05121f');pipeline.dispose();
const scene=new Scene(),clippedWorld=new ClippingGroup();scene.add(clippedWorld);
const mirror=createNodeWaterReflection(fakeRenderer,scene,camera,{ocean:{level:-.35},worldSize:24,worldCenter:[0,0]},clippedWorld);
assert.equal(mirror.mesh.material.transparent,true,'The water composite keeps its alpha blend');
assert.equal(mirror.mesh.material.depthWrite,false,'The mirror never occludes the clear water layer');
assert.equal(mirror.mesh.material.fog,false,'The unlit water composite is not fogged twice');
assert.ok(mirror.mesh.material.fragmentNode.isNode);
assert.deepEqual(clippedWorld.clippingPlanes[0].normal,new Vector3(0,1,0));
assert.equal(clippedWorld.enabled,true,'Main and reflection retain the same clipping-plane shader layout');
assert.ok(clippedWorld.clippingPlanes[0].distanceToPoint(new Vector3(0,-100,0))>0,'The main-view plane lies safely below the complete map');
let currentTarget=null,reflectionDraws=0;
fakeRenderer.getRenderTarget=()=>currentTarget;
fakeRenderer.setRenderTarget=target=>{currentTarget=target;};
fakeRenderer.render=()=>{reflectionDraws++;assert.equal(clippedWorld.clippingPlanes[0].constant,.35,'Only reflection clips the submerged world');};
fakeRenderer.compileAsync=async()=>fakeRenderer.render();
await mirror.compile();mirror.update();
assert.equal(reflectionDraws,2);
assert.equal(clippedWorld.clippingPlanes[0].constant,1e6,'Reflection restores the non-cutting main plane');
assert.equal(currentTarget,null,'Reflection restores its render target');
mirror.dispose();
pane.dispose();frame.dispose();finish.dispose();
console.log('WebGPU: portable glazing, vehicle/ferry light, reflection sky and post-processing graphs passed; geometry retained.');
