import assert from 'node:assert/strict';
import { Scene, OrthographicCamera, DirectionalLight, WebGLRenderTarget } from 'three';
import { ClippingGroup } from 'three/webgpu';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createAdaptiveRenderQuality, harbourRenderProfile, mapPixelRatio,
  scaleEffectResolution, setSunShadowResolution } from '../src/harbour/render-quality.mjs';
import { shouldUpdateReflection, animationDelta } from '../src/harbour/frame-pacing.mjs';
import { createWaterReflection } from '../src/harbour/water-reflection.mjs';
import { createNodeWaterReflection } from '../src/harbour/webgpu-reflection.mjs';
import { createNodePostProcessing } from '../src/harbour/webgpu-post.mjs';

let viewport = {width:390,height:680,dpr:3}, resizes = 0;
const quality = createAdaptiveRenderQuality({viewport:() => viewport,onChange:() => resizes++});
assert.equal(quality.pixelRatio(),1);
for (let i=0;i<120;i++) quality.observe(50,4,12);
assert.equal(quality.pixelRatio(),1,'Intentional frame pacing does not lower mobile quality');
quality.observe(90,2,70);
assert.equal(quality.pixelRatio(),1,'One slow frame cannot resize the drawing buffer');
for (let i=0;i<300;i++) quality.observe(80,3,40);
assert.equal(quality.pixelRatio(),.75,'Sustained GPU overload reaches the bounded mobile floor');
const settled = resizes;
for (let i=0;i<100;i++) quality.observe(80,3,40);
assert.equal(resizes,settled,'Reaching the floor does not keep requesting resizes');
viewport = {width:1440,height:900,dpr:2};
for (let i=0;i<100;i++) quality.observe(80,30,60);
assert.equal(quality.pixelRatio(),1.5,'Desktop quality is independent of the phone budget');
assert.equal(resizes,settled);

const throttled = createAdaptiveRenderQuality({viewport:() => ({width:390,height:680,dpr:3})});
for (let i=0;i<120;i++) throttled.observe(1000,4,12);
assert.equal(throttled.pixelRatio(),1,'Browser throttling alone does not lower quality');
const severe = createAdaptiveRenderQuality({viewport:() => ({width:390,height:680,dpr:3})});
severe.observe(300,3,200); severe.observe(300,3,200);
assert.ok(severe.pixelRatio()<1,'Severe GPU stalls reduce work promptly without pausing');

for (const width of [320,390,430,650,651,1440]) {
  const profile = harbourRenderProfile(width), mobile = width<=650;
  assert.equal(profile.reflectionResolution,mobile?512:1024);
  assert.equal(profile.shadowResolution,mobile?1024:2048);
  assert.equal(profile.bloomScale,mobile?.5:1);
  assert.equal(mapPixelRatio(3,width,930),mobile?1:1.5);
}
let scale = .5;
const bloom = new UnrealBloomPass();
scaleEffectResolution(bloom,() => scale);
bloom.setSize(400,800);
assert.equal(bloom.renderTargetBright.width,100);
assert.equal(bloom.renderTargetBright.height,200);
assert.equal(bloom.renderTargetsHorizontal.length,5,'Lower-resolution bloom retains all blur levels');
scale = 1; bloom.setSize(400,800);
assert.equal(bloom.renderTargetBright.width,200,'Desktop bloom restores its original resolution');
bloom.dispose();

const sun = new DirectionalLight();
sun.shadow.map = new WebGLRenderTarget(2048,2048);
sun.shadow.mapSize.set(2048,2048);
assert.equal(setSunShadowResolution(sun,1024),true);
assert.equal(sun.shadow.map.width,1024);
assert.equal(sun.shadow.needsUpdate,true);
assert.equal(setSunShadowResolution(sun,1024),false,'An unchanged profile does not resize shadows');
setSunShadowResolution(sun,2048); assert.equal(sun.shadow.map.width,2048); sun.shadow.map.dispose();

// Inspect actual reflection targets through both rendering paths without a GPU.
for (const backend of ['webgl','webgpu']) {
  let target = null, captured;
  const renderer = {getRenderTarget:() => target,setRenderTarget:value => {target=value;},
    render() { captured=target; }};
  const scene = new Scene(), camera = new OrthographicCamera(-10,10,8,-8,.1,80);
  camera.position.set(-18,17,18); camera.lookAt(0,0,0);
  const world = {ocean:{level:-.35},worldSize:28,worldCenter:[0,0]};
  let mirror;
  if (backend==='webgpu') {
    const clip = new ClippingGroup(); scene.add(clip);
    mirror=createNodeWaterReflection(renderer,scene,camera,world,clip,{resolution:512});
  } else mirror=createWaterReflection(renderer,scene,camera,{level:-.35,size:28,resolution:512});
  const geometry=mirror.mesh.geometry.attributes.position.array.slice();
  mirror.update(); assert.equal(captured.width,512); assert.equal(captured.height,512);
  assert.equal(target,null,'Reflection restores the main render target');
  mirror.setResolution(1024); mirror.update(); assert.equal(captured.width,1024);
  assert.deepEqual(mirror.mesh.geometry.attributes.position.array,geometry,'Effect resizing preserves the water geometry');
  mirror.dispose();
}
const renderer = {}, camera = new OrthographicCamera();
const post=createNodePostProcessing(renderer,new Scene(),camera,{profile:harbourRenderProfile(390)});
post.setTime(0); post.setTime(1); post.setQuality(harbourRenderProfile(1440));
post.setQuality(harbourRenderProfile(390)); post.dispose();

let previous, time=0, lastMirror=-Infinity, reflections=0;
for (let frame=0;frame<120;frame++) {
  const timestamp=frame*1000/60;
  time+=animationDelta(previous,timestamp); previous=timestamp;
  if (shouldUpdateReflection(390,false,timestamp,lastMirror)) { reflections++; lastMirror=timestamp; }
}
assert.ok(Math.abs(time-119/60)<1e-10,'Animations advance in real time while reflection frames are reused');
assert.ok(reflections>=14&&reflections<=17,'Phone reflections run near 8 Hz independently of animation');
assert.equal(shouldUpdateReflection(390,true,1,0),true,'Camera and lighting changes refresh immediately');
console.log('Mobile rendering: bounded adaptation, matching backend budgets, smaller live effects and continuous animation passed.');
