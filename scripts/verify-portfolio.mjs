import { mobileScrollTransform } from '../src/mobile-scroll.mjs';
import { shouldUpdateReflection } from '../src/harbour/frame-pacing.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { harbourTime } from '../src/hong-kong-time.mjs';
import { connectPortfolio } from '../src/harbour/portfolio-bridge.mjs';
import { harbourTheme } from '../src/harbour-theme.mjs';
import { portfolioCameraPose, smoothScroll } from '../src/harbour/portfolio-camera.mjs';
import { homeView } from '../src/harbour/camera-home.mjs';
import { createPortfolioAtmosphere, neutralToneMap } from '../src/harbour/portfolio-atmosphere.mjs';
import { createRenderBudget } from '../src/harbour/render-budget.mjs';
import { CityContactPass } from '../src/harbour/contact-shadows.mjs';
import { createFrameResize } from '../src/harbour/frame-resize.mjs';
import { setHarbourBackdrop } from '../src/harbour/backdrop.mjs';
import { Color, DepthTexture, Scene, OrthographicCamera } from 'three';

for (const month of ['01', '04', '07', '11']) {
  const noon = harbourTime(new Date(`2026-${month}-15T04:00:00Z`));
  const midnight = harbourTime(new Date(`2026-${month}-15T16:00:00Z`));
  assert.equal(noon.clock, '12:00:00');
  assert.equal(noon.night, 0, `${month}: noon is daylight`);
  assert.equal(midnight.clock, '00:00:00');
  assert.equal(midnight.night, 1, `${month}: midnight is fully dark`);
  let previous = 0;
  let intermediate = false;
  for (let minute = 0; minute <= 240; minute += 5) {
    const time = new Date(`2026-${month}-15T08:00:00Z`);
    time.setUTCMinutes(time.getUTCMinutes() + minute);
    const { night } = harbourTime(time);
    assert.ok(night >= previous, `${month}: sunset progresses continuously toward night`);
    if (night > 0 && night < 1) intermediate = true;
    assert.ok(night - previous < .2, `${month}: no abrupt sunset switch`);
    previous = night;
  }
  assert.ok(intermediate, `${month}: twilight exists`);
}
assert.match(harbourTime(new Date('2026-12-31T16:00:00Z')).date, /01 Jan 2027/);
const runtime = readFileSync('src/harbour/runtime.js', 'utf8');
assert.match(runtime, /document.hidden \|\| \(!portfolioActive && !reflectionDirty && Math\.abs\(scrollAmount-scrollTarget\)<=\.0001\)/);
assert.match(runtime, /motionEnabled/);
assert.match(runtime, /mapPixelRatio/);
assert.match(runtime, /nextBackgroundFrame/);
// Exercise the real frame protocol, including rejected origins/sources and
// out-of-range commands, without creating a WebGL context in Node.
const keys = ['location', 'window', 'parent', 'document', 'addEventListener', 'removeEventListener', 'setInterval', 'clearInterval'];
const saved = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const handlers = new Map(), values = [], activity = [], scroll = [], rises=[];
let cadence, cleared = 0;
const owner = { postMessage() {} };
const backdropStyle={setProperty(name,value){this[name]=value;}};
try {
  Object.assign(globalThis, {
    location: { origin: 'https://tomlaw.dev', search: '' },
    window: {}, parent: owner,
    document: { hidden: false, documentElement:{style:backdropStyle}, addEventListener(name, callback) { handlers.set(name, callback); }, removeEventListener(name) { handlers.delete(name); } },
    addEventListener(name, callback) { handlers.set(name, callback); },
    removeEventListener(name) { handlers.delete(name); },
    setInterval(callback, interval) { cadence = interval; return 1; }, clearInterval() { cleared++; },
  });
  const disconnect = connectPortfolio({setTime:value=>values.push(value),setActive:value=>activity.push(value),setScroll:(value,rise)=>{scroll.push(value);rises.push(rise);}});
  assert.equal(cadence, 30_000);
  assert.ok(values[0] >= 0 && values[0] <= 1);
  assert.equal(backdropStyle['--harbour-background'],harbourTheme(values[0])['--background'],'Frame backing matches the live page colour before rendering');
  const send = (data, override = {}) => handlers.get('message')({origin:location.origin,source:owner,data:{type:'harbour:command',...data},...override});
  send({command:'active',active:false},{origin:'https://unrelated.example'});
  send({command:'active',active:false},{source:{}});
  assert.deepEqual(activity,[]);
  send({command:'active',active:false}); send({command:'active',active:true});
  assert.deepEqual(activity,[false,true]);
  send({command:'scroll',progress:.5},{origin:'https://unrelated.example'});
  send({command:'scroll',progress:.5},{source:{}});
  send({command:'scroll',progress:NaN}); send({command:'scroll',progress:'0.5'});
  assert.deepEqual(scroll,[]);
  send({command:'scroll',progress:-1}); send({command:'scroll',progress:.5}); send({command:'scroll',progress:3});
  assert.deepEqual(scroll,[0,.5,1]);
  assert.deepEqual(rises,[0,0,0],'Older scroll messages have no parallax offset');
  send({command:'scroll',progress:.5,rise:90});
  send({command:'scroll',progress:1,rise:10000});
  send({command:'scroll',progress:1,rise:NaN});
  assert.deepEqual(rises.slice(-3),[90,180,0],'Camera parallax accepts only finite, bounded pixel offsets');
  const initial = values.length;
  send({command:'mode',mode:'day'}); send({command:'mode',mode:'night'});
  assert.equal(values.length,initial,'No manual time override on the background');
  disconnect();
  assert.equal(cleared,1,'Renderer fallback stops the previous daylight timer');
  assert.equal(handlers.size,0,'Renderer fallback disconnects previous frame/visibility listeners');
} finally {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
  }
}
const cameraHome=homeView([-2,-1.5]);
const originalPosition=cameraHome.position.toArray();
// Scroll motion should advance by elapsed time rather than frame count, and
// never snap when the hero goes offscreen.
let manyFrames=0;
for(let i=0;i<10;i++) manyFrames=smoothScroll(manyFrames,1,20);
assert.ok(Math.abs(manyFrames-smoothScroll(0,1,200))<1e-12, 'Camera smoothing is stable at low frame rates');
assert.ok(smoothScroll(0,1,200)<1, 'Camera motion does not jump to the target');
assert.equal(smoothScroll(.4,1,0),.4);

for(const mobile of [false,true]) {
  const start=portfolioCameraPose(cameraHome,0,mobile),end=portfolioCameraPose(cameraHome,1,mobile);
  assert.deepEqual(start.position.toArray(),cameraHome.position.toArray());
  assert.ok(start.zoom>1,'The portfolio map starts larger');
  assert.ok(Math.abs(end.zoom/start.zoom-.9)<1e-12,'Scroll adds a gentle zoom out');
  assert.ok(end.position.distanceTo(start.position)<4,'Scroll orbit remains subtle');
  assert.deepEqual(portfolioCameraPose(cameraHome,-2,mobile),start);
  assert.deepEqual(portfolioCameraPose(cameraHome,2,mobile),end);
  const originalOffset=cameraHome.position.clone().sub(cameraHome.target);
  for(const progress of [.05,.15,.3,.5,.75,1]){
    const pose=portfolioCameraPose(cameraHome,progress,mobile),offset=pose.position.clone().sub(cameraHome.target);
    const rotation=(Math.atan2(offset.x,offset.z)-Math.atan2(originalOffset.x,originalOffset.z))/.14;
    const zoomOut=(1-pose.zoom/start.zoom)/.10;
    assert.ok(Math.abs(rotation-pose.phase)<1e-12&&Math.abs(zoomOut-pose.phase)<1e-12,'Rotation and zoom out use the exact same scroll phase');
  }
}
assert.deepEqual(cameraHome.position.toArray(),originalPosition,'Camera animation leaves the home pose unchanged');
for(const night of [0,.5,1]){
  const style={setProperty(name,value){this[name]=value;}};
  setHarbourBackdrop(night,{style});
  assert.equal(style['--harbour-background'],harbourTheme(night)['--background']);
  assert.equal(style.colorScheme,harbourTheme(night).colorScheme,'The iframe browser backing follows daylight and night');
}
let viewport={width:390,height:844};const appliedSizes=[];
const queuedResize=createFrameResize(()=>appliedSizes.push({...viewport}));
for(let i=0;i<50;i++){viewport={width:390+i,height:844+i};queuedResize.request();}
assert.equal(appliedSizes.length,0,'Rapid resize events preserve the presented image until a render frame can draw');
assert.equal(queuedResize.flush(),true);
assert.deepEqual(appliedSizes,[viewport],'One render frame applies only the newest viewport');
assert.equal(queuedResize.flush(),false,'Unchanged frames do not clear the drawing buffer again');
viewport={width:450,height:1095};queuedResize.request();queuedResize.flush();
assert.deepEqual(appliedSizes[1],viewport,'The final native-resolution viewport is applied');
const depth=new DepthTexture();
const atmosphere=createPortfolioAtmosphere({depthTexture:depth});
assert.ok('tCoverage' in atmosphere.pass.uniforms, 'Backdrop composition accepts antialiased silhouette coverage');
assert.match(atmosphere.pass.material.fragmentShader, /1\. - coverage/, 'Partial coverage blends with the page background');
for(const time of [0,.5,1]) {
  const background=harbourTheme(time)['--background'];
  const exposure = .98 + (.72 - .98) * time;
  atmosphere.setBackground(background, exposure);
  const displayed = neutralToneMap(atmosphere.pass.uniforms.uBackground.value.clone().multiplyScalar(exposure));
  const expected = new Color(background);
  assert.ok(Math.abs(displayed.r-expected.r)<1e-5 && Math.abs(displayed.g-expected.g)<1e-5 && Math.abs(displayed.b-expected.b)<1e-5, 'Tone-mapped backdrop matches the page colour');
}
atmosphere.pass.dispose();depth.dispose();
const budgets=[];
const budget=createRenderBudget(pixels=>budgets.push(pixels));
for(let i=0;i<120;i++)budget.observe(1000,8);
assert.equal(budget.pixels,1_000_000,'Browser background throttling does not lower quality');
for(let i=0;i<60;i++)budget.observe(1000/30,8);
assert.equal(budget.pixels,1_000_000,'Healthy 30 FPS rendering retains full quality');
for(let i=0;i<60;i++)budget.observe(55,28);
assert.equal(budget.pixels,850_000,'Sustained slow frames reduce the background pixel workload');
for(let i=0;i<600;i++)budget.observe(55,28);
assert.equal(budget.pixels,600_000,'Adaptive resolution remains bounded');
assert.ok(budgets.length>0);
const aoCamera=new OrthographicCamera(-10,10,8,-8,.1,80);
aoCamera.updateMatrixWorld();
const ao=new CityContactPass(new Scene(),aoCamera,32,32);
let geometryPasses=0,screenPasses=0;
ao._renderOverride=()=>geometryPasses++;
ao._renderPass=()=>screenPasses++;
ao.render({}, {texture:{}}, {texture:{}});
assert.equal(geometryPasses,1);
ao.lastRefresh=performance.now();
ao.render({}, {texture:{}}, {texture:{}});
assert.equal(geometryPasses,1,'A still camera reuses contact shadows between refreshes');
assert.equal(screenPasses,6,'Cached AO blends onto each live colour frame');
aoCamera.position.x+=1;aoCamera.updateMatrixWorld();
ao.render({}, {texture:{}}, {texture:{}});
assert.equal(geometryPasses,2,'Camera movement refreshes contact shadows immediately');
ao.lastRefresh=-Infinity;
ao.render({}, {texture:{}}, {texture:{}});
assert.equal(geometryPasses,3,'Animated geometry still receives periodic AO refreshes');
ao.setSize(64,64);
assert.equal(ao.cacheValid,false,'Resizing invalidates cached screen-space shadows');
ao.dispose();
assert.notEqual(harbourTheme(0)['--background'],harbourTheme(1)['--background']);
assert.equal(harbourTheme(0).colorScheme,'light');
assert.equal(harbourTheme(1).colorScheme,'dark');
for (const amount of [0,.2,.5,.8,1]) {
  const theme=harbourTheme(amount);
  assert.equal(theme['--background'],`rgb(${theme['--background-rgb']})`);
}
function relativeLuminance(css) {
  const channels=css.match(/[\d.]+/g).map(Number).map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
for(let index=0;index<=100;index++) {
  const theme=harbourTheme(index/100), background=relativeLuminance(theme['--background']);
  for(const key of ['--foreground','--muted']) {
    const text=relativeLuminance(theme[key]);
    assert.ok((Math.max(text,background)+.05)/(Math.min(text,background)+.05)>=4.5,`Readable ${key} throughout twilight (${index}%)`);
  }
}
const repositories=JSON.parse(readFileSync('src/data/github-repositories.json','utf8')).repositories;
assert.equal(new Set(repositories.map(repo=>repo.name)).size,repositories.length);
for (const repo of repositories) {
  assert.equal(new URL(repo.html_url).hostname,'github.com');
  assert.ok(new URL(repo.html_url).pathname.startsWith('/tomlaws/'));
  assert.equal(typeof repo.fork,'boolean');
}
for(const featured of ['wordle','hikee'])assert.ok(repositories.some(repo=>repo.name===featured&&!repo.fork));
const markup=readFileSync('harbour/index.html','utf8');
assert.ok(!markup.includes('<button'),'Background has no map controls');
const app=readFileSync('src/Portfolio.jsx','utf8');
assert.ok(!/nocturne|Live \/ Day|Expand interactive|Have a world/i.test(app));
const modelSource = readFileSync('src/harbour/building-models.mjs', 'utf8');
for (const [, name] of modelSource.matchAll(/hk-models\/([^']+\.glb)/g)) {
  assert.ok(existsSync(`public/hk-models/${name}`), `Bundled landmark ${name}`);
}
assert.ok(existsSync('public/images/hong-kong-night.png'));

console.log('Portfolio: live HK daylight, shared background theme, no map controls, public GitHub metadata and bundled models passed.');

assert.equal(shouldUpdateReflection(390,true,50,0),false,'During mobile motion reuse the recent reflection');
assert.equal(shouldUpdateReflection(390,true,100,0),true,'Mobile motion refreshes within 100ms');
assert.equal(shouldUpdateReflection(390,false,50,0),true,'Refresh immediately when motion settles');
assert.equal(shouldUpdateReflection(900,true,50,0),true,'Desktop reflection remains per-frame');

assert.match(mobileScrollTransform(0,50), /scale\(1\)/, 'Mobile map starts at its full home size');
assert.match(mobileScrollTransform(1,50), /scale\(0\.9\)/, 'Mobile map zooms out at full scroll');
assert.equal(mobileScrollTransform(2,50),mobileScrollTransform(1,50),'Mobile scroll remains bounded');
assert.equal(mobileScrollTransform(-1,50),mobileScrollTransform(0,50),'Mobile scroll does not overshoot its home pose');
