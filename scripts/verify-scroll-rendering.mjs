import assert from 'node:assert/strict';
import { Color, OrthographicCamera, WebGLRenderTarget, AdditiveBlending, CustomBlending, AddEquation, SrcAlphaFactor, OneFactor, ZeroFactor } from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createPortfolioOutput, preserveBloomCoverage } from '../src/harbour/portfolio-output.mjs';
import { cacheBloomPass } from '../src/harbour/cached-bloom.mjs';
import { createViewportChange } from '../src/harbour/frame-resize.mjs';
import { createWorkerRenderHost, createBrowserRenderHost } from '../src/harbour/render-host.mjs';
import { estimatedWorkCompletion, nextBackgroundFrame, backgroundFrameBudget, shouldUpdateReflection, animationDelta } from '../src/harbour/frame-pacing.mjs';

// Drive the real UnrealBloomPass, recording its draws without a browser/GPU.
const camera = new OrthographicCamera(); camera.updateMatrixWorld();
let time = 0, interval = 1000 / 15, draws = [], target, allowRefresh = true;
const clear = new Color('#102030');
const renderer = {
  autoClear: true,
  getClearColor: out => out.copy(clear), getClearAlpha: () => 1,
  setClearColor() {}, clear() {},
  setRenderTarget(value) { target = value; },
  render(mesh) { draws.push({target, material:mesh.material, autoClear:this.autoClear}); },
};
const bloom = new UnrealBloomPass(undefined, .62, .62, .72);
cacheBloomPass(bloom, camera, () => interval, () => time, () => allowRefresh);
bloom.setSize(400, 800);
const input = new WebGLRenderTarget(400, 800), output = input.clone();
function draw() { draws = []; bloom.render(renderer, output, input, 0, false); return draws.length; }
assert.equal(draw(), 13, 'First frame retains threshold, ten blur draws, composite and additive blend');
const glow = bloom.renderTargetsHorizontal[0].texture;
time = 33;
assert.equal(draw(), 1, 'Intermediate frame blends cached glow onto the live scene');
assert.equal(draws[0].target, input, 'The current beauty buffer receives the glow');
assert.equal(draws[0].material, bloom.blendMaterial);
assert.equal(draws[0].material.blending, AdditiveBlending);
assert.equal(draws[0].autoClear, false, 'Cached glow cannot clear the sharp scene');
assert.equal(bloom.copyUniforms.tDiffuse.value, glow);
assert.equal(renderer.autoClear, true);
time = 67; assert.equal(draw(), 13, 'Animated lights refresh at 15 Hz');
allowRefresh = false; time = 140;
assert.equal(draw(), 1, 'A reflection frame defers the due glow blur');
time = 150; allowRefresh = true;
assert.equal(draw(), 13, 'The next available frame refreshes deferred glow');
allowRefresh = false; time = 284;
assert.equal(draw(), 13, 'The maximum glow age prevents indefinite deferral');
time = 285; camera.position.y++; camera.updateMatrixWorld();
assert.equal(draw(), 13, 'View changes bypass effect staggering');
allowRefresh = true;
time++; camera.position.x++; camera.updateMatrixWorld();
assert.equal(draw(), 13, 'Camera motion invalidates immediately');
time++; camera.zoom = 1.2; camera.updateProjectionMatrix();
assert.equal(draw(), 13, 'Projection changes invalidate immediately');
for (const property of ['strength', 'radius', 'threshold']) {
  time++; bloom[property] += .1; assert.equal(draw(), 13, `${property} updates cannot reuse stale lighting`);
}
time++; bloom.bloomTintColors[0].x += .1; assert.equal(draw(), 13);
time++; bloom.setSize(430, 900); assert.equal(draw(), 13, 'Resizing invalidates cached targets');
assert.equal(bloom.renderTargetsHorizontal.length, 5, 'Every original blur level is retained');
interval = 0; time++; assert.equal(draw(), 13); time++; assert.equal(draw(), 13, 'Desktop keeps every bloom update');
interval = 1000 / 15;
const render = renderer.render;
renderer.render = () => { throw Error('Fixture draw failed'); };
time++;
assert.throws(draw, /Fixture draw failed/);
assert.equal(renderer.autoClear, true, 'A failed cached draw restores state for renderer fallback');
renderer.render = render;
// Keep precisely the old additive RGB while retaining the scene's coverage.
// The same blend material is used on full refreshes and cached-glow frames.
preserveBloomCoverage(bloom);
assert.equal(bloom.blendMaterial.blending,CustomBlending);
assert.equal(bloom.blendMaterial.blendEquation,AddEquation);
assert.equal(bloom.blendMaterial.blendSrc,SrcAlphaFactor);
assert.equal(bloom.blendMaterial.blendDst,OneFactor);
assert.equal(bloom.blendMaterial.blendSrcAlpha,ZeroFactor);
assert.equal(bloom.blendMaterial.blendDstAlpha,OneFactor);
time+=100;assert.equal(draw(),13);time++;assert.equal(draw(),1);
assert.equal(draws[0].material,bloom.blendMaterial);
const finalOutput=createPortfolioOutput();
assert.equal(finalOutput.pass.needsSwap,false,'A final canvas pass must not alternate MSAA/depth buffers');
assert.equal(finalOutput.pass.material.depthWrite,false);
const shader=finalOutput.pass.material.fragmentShader;
assert.ok(shader.indexOf('uBackground * (1. - gl_FragColor.a)')<shader.indexOf('// tone mapping'));
assert.ok(shader.includes('NeutralToneMapping')&&shader.includes('sRGBTransferOETF'),'Keep Three tone and colour transforms');
assert.ok(shader.includes('gl_FragColor.a = 1.'),'The final page-owned canvas remains opaque');
finalOutput.setBackground('#123456',1.1);
assert.ok(finalOutput.pass.uniforms.uBackground.value.r>0);
finalOutput.pass.dispose();
bloom.dispose(); input.dispose(); output.dispose();

// Chrome/toolbar notifications must not trigger expensive identical resizes.
let viewport = {width:430,height:680,dpr:2}, changes = [];
const resize = createViewportChange(() => viewport, value => changes.push({...value}));
for (let i=0; i<120; i++) assert.equal(resize(), false);
viewport.height = 690; assert.equal(resize(), true);
assert.equal(resize(), false);
viewport = {width:430,height:690,dpr:3}; assert.equal(resize(), true);
viewport.width = 932; assert.equal(resize(), true, 'Orientation changes still resize');
assert.equal(changes.length, 3);
let workerResizes = 0;
const worker = createWorkerRenderHost({}, {...viewport,search:''}, () => {});
worker.onResize(() => workerResizes++);
for (let i=0; i<120; i++) worker.receive({type:'resize',viewport:{...viewport}});
assert.equal(workerResizes, 0);
worker.receive({type:'resize',viewport:{...viewport,width:900}});
assert.equal(workerResizes, 1);

const values = {innerWidth:430,innerHeight:680,devicePixelRatio:2,matchMedia:() => ({}),
  document:{getElementById:() => ({})},location:{search:''}};
let listener, removed, browserResizes = 0;
values.addEventListener = (type, callback) => { listener = callback; };
values.removeEventListener = (type, callback) => { removed = callback; };
const saved = new Map(Object.keys(values).map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
try {
  for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  const browser = createBrowserRenderHost(), disconnect = browser.onResize(() => browserResizes++);
  for (let i=0; i<120; i++) listener();
  assert.equal(browserResizes, 0, 'Main-thread fallback also ignores duplicate viewport notifications');
  globalThis.innerHeight++; listener(); assert.equal(browserResizes, 1);
  disconnect(); assert.equal(removed, listener);
} finally {
  for (const [key,value] of saved) {
    if (value) Object.defineProperty(globalThis,key,value); else delete globalThis[key];
  }
}

// Simulate delayed compositor callbacks rather than inventing GPU duration
// from their lateness. Actual timed/observed GPU work must still be budgeted.
for (const callbackDelay of [8.33, 16.67, 50, 120, 400]) {
  const completed = 100 + callbackDelay;
  const estimate = estimatedWorkCompletion(100, completed, 3, undefined, 100);
  assert.equal(estimate, 103);
  assert.ok(nextBackgroundFrame(100, 100, estimate) <= 134, 'Scrolling cannot create a second callback-delay cooldown');
}
assert.equal(estimatedWorkCompletion(100, 160, 3, undefined, 145), 145);
assert.equal(estimatedWorkCompletion(100, 160, 3, 48, 145), 148);
assert.ok(nextBackgroundFrame(100, 100, 148) >= 164, 'Expensive measured frames still reserve compositor headroom');
const normal = backgroundFrameBudget(430, false), busy = backgroundFrameBudget(430, true);
assert.deepEqual(normal,{fps:30,duty:.85}); assert.deepEqual(busy,normal,'Scrolling keeps the same smooth phone cadence');
assert.deepEqual(backgroundFrameBudget(1440,true),{fps:30,duty:.75},'Desktop retains its original budget');
assert.ok(nextBackgroundFrame(0,0,30,busy.fps,busy.duty)<1000/24,'A 30 ms phone frame must not be throttled below 24 FPS');
assert.equal(shouldUpdateReflection(430,false,124,0,true,true),false);
assert.equal(shouldUpdateReflection(430,false,125,0,true,true),true,'Moving ferry reflections retain the 8 Hz budget while scrolling');
assert.equal(shouldUpdateReflection(430,true,1,0,true,true),true,'Important reflection changes still refresh immediately');
let previous=0, elapsed=0;
for(let frame=1;frame<=60;frame++){
  const timestamp=frame*1000/busy.fps;
  elapsed+=animationDelta(previous,timestamp);previous=timestamp;
}
assert.ok(Math.abs(elapsed-2)<1e-10,'The city clock keeps real speed at the gesture frame rate');
let scrolling;
const detach = worker.connect({setScrolling:value => {scrolling=value;}});
worker.receive({type:'scrolling',scrolling:true});assert.equal(scrolling,true);
worker.receive({type:'scrolling',scrolling:false});assert.equal(scrolling,false);
detach();
console.log('Scroll rendering: cached/staggered bloom, steady 30 FPS budgets, reflections, real-time animation, resize suppression and callback-safe GPU pacing passed.');
