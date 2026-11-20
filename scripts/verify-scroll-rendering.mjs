import assert from 'node:assert/strict';
import { Color, OrthographicCamera, WebGLRenderTarget, AdditiveBlending } from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { cacheBloomPass } from '../src/harbour/cached-bloom.mjs';
import { createViewportChange } from '../src/harbour/frame-resize.mjs';
import { createWorkerRenderHost, createBrowserRenderHost } from '../src/harbour/render-host.mjs';
import { estimatedWorkCompletion, nextBackgroundFrame } from '../src/harbour/frame-pacing.mjs';

// Drive the real UnrealBloomPass, recording its draws without a browser/GPU.
const camera = new OrthographicCamera(); camera.updateMatrixWorld();
let time = 0, interval = 1000 / 15, draws = [], target;
const clear = new Color('#102030');
const renderer = {
  autoClear: true,
  getClearColor: out => out.copy(clear), getClearAlpha: () => 1,
  setClearColor() {}, clear() {},
  setRenderTarget(value) { target = value; },
  render(mesh) { draws.push({target, material:mesh.material, autoClear:this.autoClear}); },
};
const bloom = new UnrealBloomPass(undefined, .62, .62, .72);
cacheBloomPass(bloom, camera, () => interval, () => time);
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
time = 68; camera.position.x++; camera.updateMatrixWorld();
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
console.log('Scroll rendering: 13-to-1 intermediate bloom draws, live scene blending, invalidation, duplicate resize suppression and callback-safe GPU pacing passed.');
