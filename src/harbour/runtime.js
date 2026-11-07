import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createCoastalLighting } from './coastal-lighting.mjs';
import { loadHarbourWorld } from './prepared-world-loader.mjs';
import { CITY_LAYOUT as site } from './layout.mjs';
import { CityContactPass } from './contact-shadows.mjs';
import { fitMapCamera } from './camera-framing.mjs';
import { homeView } from './camera-home.mjs';
import { createWaterReflection } from './water-reflection.mjs';
import {createEnvironmentBlend} from './environment-blend.mjs';
import {createHarbourTime} from './harbour-time.mjs';
import {createRenderProfiler} from './render-profiler.mjs';
import { connectPortfolio } from './portfolio-bridge.mjs';
import { harbourTime } from '../hong-kong-time.mjs';
import { harbourTheme } from '../harbour-theme.mjs';
import { createPortfolioAtmosphere } from './portfolio-atmosphere.mjs';
import { portfolioCameraPose, keepMobileMapVisible, fitScrollFrame } from './portfolio-camera.mjs';
import { mapPixelRatio } from './render-quality.mjs';
import { nextBackgroundFrame } from './frame-pacing.mjs';
import {createGpuFrameTimer} from './gpu-frame-timer.mjs';
import {createFrameResize} from './frame-resize.mjs';
import './map.css';

const $ = id => document.getElementById(id);
const canvas = $('world');
const startupAt=performance.now();
const fullQuality=true;
const preparedWorld=loadHarbourWorld({procedural:import.meta.env.DEV&&new URLSearchParams(location.search).get('qaWorld')==='procedural'}).then(world=>({world}),error=>({error}));
const cyberpunkRoute = false;
if (cyberpunkRoute) { document.body.classList.add('night'); document.title = 'Lantern Quarter · cyberpunk coast'; canvas.setAttribute('aria-label', 'A cyberpunk coastal city at night.'); }
// A capture run — `npm run capture` puts ?capture= in the url — has nobody watching the
// opening card, and leaving it up only risks the screenshot landing on its fade instead of
// on the city behind it. A flag about how the page is being looked at, not what it does.
const capturing = new URLSearchParams(location.search).has('capture');
// The Peak Tram runs continuously while the harbour retains its composed opening pose.
const state = { night: false, time: 0 };
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch {
  $('loading').classList.add('error');
  $('loading').querySelector('p').textContent = 'This little world needs WebGL. Enable hardware acceleration in your browser, then reload.';
  throw new Error('WebGL initialization failed');
}
function pixelRatio() { return mapPixelRatio(devicePixelRatio); }
renderer.setPixelRatio(pixelRatio());
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.VSMShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = T.NeutralToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor('#0a0c1d');

const scene = new T.Scene();
// A plain backdrop lets the map share the page's atmosphere. Glass keeps its
// separate sky environment, while clouds and celestial decorations are absent.
scene.background = new T.Color(0x000000);
// A denser, indigo haze trades distance clarity for the neon depth the
// district is meant to have: signage recedes into coloured murk.
scene.fog = new T.Fog('#0e1128', 22, 58);
// The sky the glass reflects. It is a function of the view direction rather than a picture mapped
// over a sphere, and that distinction is the whole point: a picture over a sphere converges at the
// poles and keeps whatever hard edges it was drawn with, and a polished facade turns both into
// artefacts — bands across the glass, and a starburst where the image pinches. Every term here is
// a smooth function of direction, so there are no edges to reflect.
const environmentGenerator = new T.PMREMGenerator(renderer);
// The dome is built on its own so that it can serve twice: once here, to be photographed into an
// environment, and once at load, to stand in for the visible sky while the district itself is
// photographed for its reflections.
function skyDome({ zenith, horizon, ground, sunColor, sunDirection, cloudColor, cloudCover, cloudScale }) {
  return new T.Mesh(
    new T.SphereGeometry(60, 32, 24),
    new T.ShaderMaterial({
      side: T.BackSide,
      uniforms: {
        uZenith: { value: new T.Color(zenith) }, uHorizon: { value: new T.Color(horizon) },
        uGround: { value: new T.Color(ground) }, uSun: { value: new T.Color(sunColor) },
        uSunDirection: { value: new T.Vector3(...sunDirection).normalize() },
        uCloud: { value: new T.Color(cloudColor) }, uCloudCover: { value: cloudCover },
        uCloudScale: { value: cloudScale },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
      // Sky from zenith down to the horizon, ground below it, and the horizon itself the brightest
      // line in the picture. That band is what a facade throws back when you are looking across at
      // it, and without it a reflection is a uniform wash, which reads as no reflection at all.
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uGround, uSun, uCloud, uSunDirection;
        uniform float uCloudCover, uCloudScale;
        varying vec3 vDirection;
        void main() {
          vec3 d = normalize(vDirection);
          vec3 colour = mix(uHorizon, uZenith, smoothstep(0., .62, d.y));
          colour = mix(colour, uGround, smoothstep(0., -.34, d.y));
          float field = sin(d.y * uCloudScale + d.x * 1.7) * .5 + sin(d.z * 4.1 - d.y * 2.6) * .5;
          colour = mix(colour, uCloud, smoothstep(.25, .95, field) * uCloudCover * smoothstep(.02, .34, d.y));
          // Soft silhouettes near the reflected horizon give neighbouring facades a presence.
          float azimuth=atan(d.x,d.z);
          float skyline=pow(.5+.5*sin(azimuth*7.0),8.0);
          float horizonBand=exp(-pow((d.y-.035)/.18,2.0));
          colour*=1.0-.11*skyline*horizonBand;
          float sun = max(dot(d, normalize(uSunDirection)), 0.);
          colour += uSun * (pow(sun, 900.) * 4. + pow(sun, 24.) * .1);
          gl_FragColor = vec4(colour, 1.);
        }`,
    })
  );
}
function buildSkyEnvironment(options) {
  const dome = skyDome(options);
  const target = environmentGenerator.fromScene(new T.Scene().add(dome), 0);
  dome.geometry.dispose(); dome.material.dispose();
  return target.texture;
}
const DAY_SKY = {
  // A saturated zenith matters more here than it looks: a polished facade throws back the middle
  // of the sky, so this is the colour the towers take on. Pale here and the glass reads grey.
  zenith: '#3f8ed4', horizon: '#f2ead9', ground: '#8fb2c4',
  sunColor: '#fff8e2', sunDirection: [-6, 14, 9], cloudColor: '#ffffff', cloudCover: .5, cloudScale: 6.3,
};
const NIGHT_SKY = {
  zenith: '#0d1a33', horizon: '#4b5b7c', ground: '#101520',
  sunColor: '#ffd9a8', sunDirection: [-6, 3.5, 9], cloudColor: '#28324a', cloudCover: .45, cloudScale: 5.1,
};
const dayEnvironment = buildSkyEnvironment(DAY_SKY);
const nightEnvironment = buildSkyEnvironment(NIGHT_SKY);
const environmentBlend=createEnvironmentBlend(renderer,dayEnvironment,nightEnvironment);
scene.environment = environmentBlend.texture;
// The glass carries its own reflection strength; this is the environment's share of it, and it is
// the one number that decides whether a facade mirrors the sky or merely looks blue.
scene.environmentIntensity = .82;
environmentGenerator.dispose();
// The view stands at Tsim Sha Tsui, and `camera-home.mjs` owns that pose: the camera is high and out
// over the water off the harbour's east end, looking across at Hong Kong Island, so the
// wheel and the IFC land on the right of the picture. Nothing of Tsim Sha Tsui is in the world — the
// camera is standing in it — and the island's own east shore is green below us.
const home = homeView(site.center);
const camera = new T.OrthographicCamera(-10, 10, 8, -8, .1, 80);
camera.position.copy(home.position);
const controls = { target: home.target.clone(), update() { camera.lookAt(this.target); camera.updateMatrixWorld(true); } };
// The camera is posed here and then left alone until somebody turns it. The controls are on, so the
// district can be looked at from anywhere, and the compass in the top right is what puts the view
// back — which is the only reason it earns its place on a page this quiet.
controls.update();
// Nothing catches shadows on the backdrop any more: the sea platform is real
// geometry and takes the island's and the clouds' shadows itself, so a separate
// shadow plane would only paint grey marks on the white behind the map.
// The modelled buildings arrive over the network, so the world waits for them. That wait is
// what the loading card is already covering; everything else on the map is built in code and
// needs no fetching at all.
const prepared=await preparedWorld;
if(prepared.error)throw prepared.error;
const world=prepared.world;
scene.add(world.root);
const lighting = createCoastalLighting(scene, world);
const timeLighting=cyberpunkRoute?null:createHarbourTime(scene,world,lighting);
// A lamp out over the harbour, low and close to the waterline. This is the light that shows up on
// glass, and where it goes is not a matter of taste. A vertical facade reflects what is low and in
// front of it, because the mirror image of a camera looking down arrives pointing at the ground —
// so a light up in the sky glints on roofs and on the water and never lands on a waterfront wall
// at all. Set low and out over the harbour, this one puts a highlight along the waterfront facades
// and a path of glitter on the sea between them, and its range is short enough to leave the rest
// of the island alone.
//
// It burns at two strengths, because the same highlight reads two ways. By day it needs to be
// strong to register at all against a bright sky, and it lands as a single sharp glint on the
// glass. By night the bloom is five times heavier, and that same glint spreads into a white smear
// that swallows the buildings behind it — so it is dimmed to the point where it is a highlight
// again rather than the brightest thing on the map.
const harbourGlint = new T.PointLight('#fff2d2', 40, 30, 1.6);
harbourGlint.position.set(-1.5, 2.4, 11.0);
harbourGlint.castShadow = false;
scene.add(harbourGlint);
// Glass reflects the sky, and nothing else. What a vertical facade throws back is sky: a camera
// looking down at a wall reflects rays that leave the glass going upwards, and upwards from a
// waterfront tower is sky. Reflecting the district itself was tried — the whole scene photographed
// from a cube probe and hung on the glass — and it is worse, not better. A probe placed anywhere on
// this island has the green hill filling every upward ray, so every tower turned green and the
// reflection read as a fault rather than as glass. Saturated blue over a blue sky is both simpler
// and closer to what the eye expects of a waterfront tower.
//
// The island's reflection belongs on the water instead, where the surface is a plane and the
// reflection can be exact: that is the harbour mirror below. setNight() swaps this for the night
// sky along with the rest of the lighting.
let activeSky = DAY_SKY;
// The sea mirrors the island. The glass and the water want different things — the glass wants the
// sky, the water wants an exact mirror of one plane — so they are built separately and neither is
// faked.
const harbourMirror = createWaterReflection(renderer, scene, camera, {
  level: world.ocean.level,
  // The mirror is a plane the size of the plate, and the plate is the map: a smaller one would stop
  // reflecting the island part of the way across the harbour and leave a visible edge in the water.
  size: world.worldSize,
  center: world.worldCenter,
  // The plane's own colour has to match the sea it lies on, because where there is nothing to
  // reflect that is all the water is: a paler one washes the deep teal out of the whole harbour.
  waterColor: '#5fb6d6',
  sky: () => skyDome(activeSky),
});
const nightDistrict = null;
// Settle the harbour into its opening pose before the tram's live clock starts.
world.animate(0, 0);
lighting.update(0);
// The context's own antialiasing stops applying as soon as the scene renders into
// a render target instead of the canvas, which is what left every silhouette hard
// edged next to the offline render. The composer therefore gets a multisampled
// target of its own, and the edges are resolved before the effect chain reads it.
const composerTarget = new T.WebGLRenderTarget(innerWidth, innerHeight, { type: T.HalfFloatType, samples: 4 });
composerTarget.depthTexture = new T.DepthTexture(innerWidth, innerHeight);
const composer = new EffectComposer(renderer, composerTarget);
const beauty = new RenderPass(scene, camera);
composer.addPass(beauty);
const contactShadows = new CityContactPass(scene, camera, innerWidth, innerHeight);
contactShadows.blendIntensity = .42;
contactShadows.updateGtaoMaterial({ radius: .14, thickness: .12, distanceExponent: 1.6, distanceFallOff: 1, scale: .65, samples: 16 });
contactShadows.updatePdMaterial({ radius: 4, lumaPhi: 8, depthPhi: 2, normalPhi: 3 });
composer.addPass(contactShadows);
const bloom = new UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), .62, .62, .72);
if(!cyberpunkRoute){
    // Use the same emitting-channel threshold for every window colour, without
    // hue-specific amplification of the resulting halo.
  bloom.materialHighPassFilter.fragmentShader=bloom.materialHighPassFilter.fragmentShader.replace(
    'vec4 texel = texture2D( tDiffuse, vUv );',
    `vec4 texel=texture2D(tDiffuse,vUv);
     // Preserve ordinary lights, but prevent HDR specular spikes from feeding
     // effectively unlimited energy into every level of the bloom pyramid.
     float sourcePeak=max(texel.r,max(texel.g,texel.b));
     if(sourcePeak>2.5){
       float boundedPeak=2.5+.5*(1.-exp(-(sourcePeak-2.5)/.5));
       texel.rgb*=boundedPeak/sourcePeak;
     }`
  ).replace(
    'float v = luminance( texel.xyz );',
    'float v=max(texel.r,max(texel.g,texel.b));'
  ).replace(
    'float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );',
    // A soft night-time knee retains lower-pane glow instead of illuminating
    // only the part above a hard brightness threshold. Daytime is unchanged.
    `float knee=luminosityThreshold*mix(.75,1.,smoothstep(.70,2.2,luminosityThreshold));
     float alpha=smoothstep(knee,luminosityThreshold+smoothWidth,v);`
  );
  bloom.highPassUniforms.smoothWidth.value=.20;
  bloom.materialHighPassFilter.needsUpdate=true;
}
composer.addPass(bloom);
const output = new OutputPass();
// Post-processing must preserve the beauty depth used by backdrop composition.
output.material.depthTest = false;
output.material.depthWrite = false;
composer.addPass(output);
// Composer swaps reuse the beauty target later in the chain. Keep an isolated
// copy of its live depth so fullscreen passes cannot erase the map silhouette.
const silhouetteTarget=new T.WebGLRenderTarget(1,1,{depthBuffer:true});
silhouetteTarget.depthTexture=new T.DepthTexture();
const atmosphere = createPortfolioAtmosphere({depthTexture: silhouetteTarget.depthTexture});
const renderBeauty = beauty.render.bind(beauty);
beauty.render = (renderer, writeBuffer, readBuffer, ...args) => {
  renderBeauty(renderer, writeBuffer, readBuffer, ...args);
  // Use the beauty pass's current depth, rather than the cached AO depth, so
  // moving ships and vehicles keep a correct silhouette on every frame.
  silhouetteTarget.setSize(readBuffer.width,readBuffer.height);
  renderer.initRenderTarget(silhouetteTarget);
  renderer.copyTextureToTexture(readBuffer.depthTexture,silhouetteTarget.depthTexture);
  atmosphere.pass.uniforms.tDepth.value = silhouetteTarget.depthTexture;
};
composer.addPass(atmosphere.pass);
let scrollTarget = 0, scrollAmount = 0, riseTarget=0, portfolioFrame, cameraDirty=false;
let reflectionDirty = false;
function applyScrollCamera() {
  const pose = portfolioCameraPose(home, scrollAmount, innerWidth <= 650);
  camera.position.copy(pose.position);
  camera.zoom = pose.zoom;
  controls.update();
  if(portfolioFrame)fitScrollFrame(camera,world.framingPoints,portfolioFrame,innerWidth,innerHeight,riseTarget*pose.phase,pose.zoomFactor);
  if(import.meta.env.DEV){
    const params=new URLSearchParams(location.search),peakView=params.get('qaPeak'),wheelView=params.get('qaWheel'),tramView=params.get('qaTram'),jardineView=params.get('qaJardine'),hkcecView=params.get('qaHKCEC');
    const view=tramView??wheelView??peakView??jardineView??hkcecView??params.get('qaIFC');
    const offset={front:[0,2.5,7],side:[7,2.5,0],rear:[peakView||wheelView?3:0,2.5,-7]}[view];
    if(offset){
      const tower=world.buildings.find(building=>building.name===(peakView?'The Peak Tower':jardineView?'Jardine House':hkcecView?'Hong Kong Convention and Exhibition Centre':'Two IFC'));
      const tramBody=tramView?world.peakTram.cars[1].cabins[0].body:null;
      const target=tramView?tramBody.localToWorld(new T.Vector3(0,.55,0)):
        wheelView?world.observationWheel.group.getWorldPosition(new T.Vector3()):tower.group.localToWorld(new T.Vector3(0,peakView?1.55:jardineView?3.3:hkcecView?1.3:14.24,0));
      const viewOffset=tramView?new T.Vector3(...({front:[-5,1.5,0],side:[0,1.5,5],rear:[5,1.5,0]}[view]))
        .applyQuaternion(tramBody.getWorldQuaternion(new T.Quaternion())):new T.Vector3(...offset);
      if(hkcecView)viewOffset.applyQuaternion(tower.group.getWorldQuaternion(new T.Quaternion()));
      camera.position.copy(target).add(viewOffset);controls.target.copy(target);controls.update();camera.zoom=1;
      const halfHeight=tramView?1.35:wheelView?3:jardineView?3.7:peakView?2.65:hkcecView?3.15:2.1;
      camera.left=-halfHeight*innerWidth/innerHeight;camera.right=-camera.left;camera.top=halfHeight;camera.bottom=-halfHeight;
      camera.updateMatrixWorld(true);
    }
  }
  camera.updateProjectionMatrix();
  cameraDirty=false;
}

function resize() {
  const ratio=pixelRatio(),ratioChanged=renderer.getPixelRatio()!==ratio;
  if(ratioChanged)renderer.setPixelRatio(ratio);
  frameMap();
  applyScrollCamera();
  renderer.setSize(innerWidth, innerHeight, false);
  if(ratioChanged)composer.setPixelRatio(ratio);
  composer.setSize(innerWidth, innerHeight);
  contactShadows.setSize(Math.round(innerWidth * .8), Math.round(innerHeight * .8));
  // The reflection and main image are redrawn together in this render frame.
  reflectionDirty = true;
}
const pendingResize=createFrameResize(resize);
const requestResize=()=>{pendingResize.request();reflectionDirty=true;};
// Fit the actual island, sea, buildings and railway in camera space. The old
// island-only divisor clipped the off-centre sea plate even in the home view.
function frameMap() {
  // Fit a stable home pose so a resize halfway through the scroll animation
  // cannot change the baseline framing. The scroll pose is reapplied afterward.
  camera.position.copy(home.position);
  camera.zoom = 1;
  controls.update();
  const aspect = innerWidth / innerHeight;
  const sideSpace = innerWidth > 650 ? .34 : 0;
  fitMapCamera(camera, world.framingPoints, aspect * (1 - sideSpace), 1.12);
  const halfHeight = (camera.top - camera.bottom) / 2;
  const centerX = (camera.left + camera.right) / 2;
  camera.left = centerX - halfHeight * aspect * (1 + sideSpace);
  camera.right = centerX + halfHeight * aspect * (1 - sideSpace);
  if (innerWidth <= 650) {
    camera.top += halfHeight * .55;
    camera.bottom += halfHeight * .55;
    keepMobileMapVisible(camera, world.framingPoints, innerHeight, portfolioCameraPose(home, 0, true).zoom);
  } else {
    // Wide, short windows need headroom beneath the navigation and HK clock.
    const headroom = halfHeight * T.MathUtils.clamp((aspect - 1.1) * .30, 0, .20);
    camera.top += headroom;
    camera.bottom += headroom;
  }
  portfolioFrame={left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom};
  camera.updateProjectionMatrix();
}
addEventListener('resize', requestResize); resize();

function setNight(night) {
  state.night = night;
  document.body.classList.toggle('night', night);
  // The town is painted pastel either way; what changes is how much the sky and
  // the signs contribute. Daylight is bright and flat, dusk lets the neon lead.
  // The resting look is the flat, even daylight of the offline render: a wide
  // soft sky, a gentle sun, almost no haze and only a whisper of bloom.
  lighting.setDay(!night);
  nightDistrict?.setNight(night);
  harbourGlint.intensity = night ? 9 : 40;
  world.cyberpunk.setGlow(night ? 1 : .62);
  world.materials.warm.emissiveIntensity = night ? 3.1 : .55;
  world.materials.teal.emissiveIntensity = night ? 3.9 : .60;
  world.materials.pink.emissiveIntensity = night ? 3.4 : .55;
  // The backdrop is deliberately blank. The map's own boundary is the edge of the sea
  // platform, and anything drawn behind it would compete with that edge: a coloured
  // background reads as more sea, and the sea is now something the scene builds.
  atmosphere.setBackground(harbourTheme(Number(night))['--background']);
  scene.fog.color.set(night ? '#15213f' : '#bedfe9');
  scene.fog.near = night ? 36 : 70;
  scene.fog.far = night ? 90 : 240;
  renderer.setClearColor(night ? (cyberpunkRoute ? '#0b1225' : '#1a1830') : '#bedfe9');
  renderer.toneMappingExposure = night ? 1.02 : .98;
  scene.environment = night ? nightEnvironment : dayEnvironment;
  bloom.strength = night ? .62 : .12;
  bloom.threshold = night ? .72 : 2.2;
  contactShadows.blendIntensity = night ? .32 : .25;
  activeSky = night ? NIGHT_SKY : DAY_SKY;
  harbourMirror.updateSky();
}
function setTimeOfDay(value) {
  const t=T.MathUtils.clamp(value,0,1);
  state.night=t>.55;document.body.classList.toggle('night',state.night);
  timeLighting.set(t);
  harbourMirror.setNight(t);
  harbourGlint.intensity=T.MathUtils.lerp(40,5,t);
  world.materials.warm.emissiveIntensity=T.MathUtils.lerp(.55,2.4,t);
  world.materials.teal.emissiveIntensity=T.MathUtils.lerp(.60,1.3,t);
  world.materials.pink.emissiveIntensity=T.MathUtils.lerp(.55,1.5,t);
  atmosphere.setBackground(harbourTheme(t)['--background']);
  const haze=T.MathUtils.smoothstep(t,.35,.95);
  // Humid harbour air softens the far skyline more than the near waterfront.
  // Reuse material fog and bloom, avoiding extra volumetric render passes.
  scene.fog.color.set('#bedfe9').lerp(new T.Color('#25384e'),t);
  scene.fog.near=T.MathUtils.lerp(70,16,haze);scene.fog.far=T.MathUtils.lerp(240,65,haze);
  // Dim the final image after bloom, preserving the soft window halos rather
  // than weakening their light source below the glow threshold.
  renderer.toneMappingExposure=T.MathUtils.lerp(.98,.72,t);
  environmentBlend.update(t);scene.environment=environmentBlend.texture;
  scene.environmentIntensity=T.MathUtils.lerp(.82,.38,t);
  bloom.strength=T.MathUtils.lerp(.12,.62,t);bloom.threshold=T.MathUtils.lerp(2.2,.70,t);
  bloom.radius=T.MathUtils.lerp(.62,.90,haze);
  contactShadows.blendIntensity=T.MathUtils.lerp(.25,.30,t);
  activeSky={};
  for(const key of Object.keys(DAY_SKY)){
    if(typeof DAY_SKY[key]==='string')activeSky[key]=new T.Color(DAY_SKY[key]).lerp(new T.Color(NIGHT_SKY[key]),t);
    else if(Array.isArray(DAY_SKY[key]))activeSky[key]=DAY_SKY[key].map((v,i)=>T.MathUtils.lerp(v,NIGHT_SKY[key][i],t));
    else activeSky[key]=T.MathUtils.lerp(DAY_SKY[key],NIGHT_SKY[key],t);
  }
  const label=t<.18?'Day':t<.42?'Late afternoon':t<.70?'Dusk':t<.90?'Evening':'Midnight';
  harbourMirror.updateSky();
  renderer.shadowMap.needsUpdate=true;
}
setTimeOfDay(harbourTime().night);
// Let supported drivers compile materials in parallel instead of blocking the
// first visible frame on all landmark shaders at once.
await renderer.compileAsync(scene, camera);
// Taken once more now that the lighting is final, so the water reflects the district it is
// actually sitting in rather than the one it was before the sun and the sky were set.
harbourMirror.update();

canvas.addEventListener('webglcontextlost', e => {
  if(disposed)return;
  e.preventDefault(); renderer.setAnimationLoop(null); $('loading').hidden = false; $('loading').className = 'error';
  $('loading').querySelector('p').textContent = 'The graphics context was interrupted. Reload to return to the harbour.';
});

let portfolioActive = true;
let firstFrameReady=false;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled = !capturing&&!motionPreference.matches;
motionPreference.addEventListener('change', () => {
  motionEnabled = !capturing&&!motionPreference.matches;
  if (!motionEnabled) {
    scrollTarget = scrollAmount = riseTarget = 0;
    applyScrollCamera();
  }
  reflectionDirty = true;
});
const disconnectPortfolio=connectPortfolio({
  isReady:()=>firstFrameReady,
  setTime(value) { setTimeOfDay(value); reflectionDirty = true; },
  setActive(value) { portfolioActive = value; reflectionDirty = true; },
  setScroll(value,rise=0) { scrollTarget = motionEnabled ? value : 0; riseTarget=motionEnabled?rise:0; cameraDirty=true; reflectionDirty=true; },
});

let previousFrame,lastRendered=-Infinity,lastShadowTime=-Infinity;
const gl=renderer.getContext();
let frameFence=null,frameStarted=0,nextFrameAt=-Infinity,frameTimestamp=0,submissionMs=0;
const profiler=new URLSearchParams(location.search).has('profile')?createRenderProfiler(renderer):null;
const gpuTimer=createGpuFrameTimer(gl);
const profilingUncapped=profiler&&new URLSearchParams(location.search).get('profile')!=='idle';
renderer.setAnimationLoop(timestamp => {
  // One completed GPU frame at a time, with the same headroom budget as WebGPU.
  // Keep native resolution rather than reacting to load by blurring the map.
  if(frameFence){
    if(gl.clientWaitSync(frameFence,0,0)===gl.TIMEOUT_EXPIRED)return;
    gl.deleteSync(frameFence);frameFence=null;
    const completed=performance.now();
    const gpuMs=gpuTimer.read();
    profiler?.end(frameTimestamp,{cpuMs:submissionMs,completeMs:completed-frameStarted,gpuMs});
    // A fence checked on the next RAF includes browser scheduling delay. When
    // supported, use the GPU's elapsed-time query rather than treating that
    // delay as rendering work and adding another unnecessary cooldown.
    const workCompleted=gpuMs===undefined?completed:frameStarted+Math.max(submissionMs,gpuMs);
    nextFrameAt=nextBackgroundFrame(nextFrameAt,frameStarted,workCompleted);
    if(!firstFrameReady){
      firstFrameReady=true;
      const readyMs=Math.round(performance.now()-startupAt);
      canvas.dataset.readyMs=String(readyMs);
      if(new URLSearchParams(location.search).has('profile'))console.info('[startup-webgl]',JSON.stringify({readyMs,pixelRatio:renderer.getPixelRatio(),fullQuality}));
      if(parent!==window)parent.postMessage({type:'harbour:state',ready:true,...harbourTime()},location.origin);
      $('loading').classList.add('ready');$('loading').hidden=true;
    }
  }
  // The faded background keeps its last frame. A resize or daylight update
  // may refresh that decoration without running its animation continuously.
  if (document.hidden || (!portfolioActive && !reflectionDirty)) { previousFrame = undefined; return; }
  if (!motionEnabled && !reflectionDirty && $('loading').classList.contains('ready')) { previousFrame = undefined; return; }
  // The background leaves GPU headroom while keeping every display pixel.
  // Explicit throughput profiling can still lift the animation cap.
  // A second minimum-interval check rounded every 24 Hz deadline up to a
  // third 60 Hz RAF, imposing 20 FPS and irregular stalls on otherwise fast
  // frames. The shared deadline already enforces both cadence and GPU rest.
  if(profilingUncapped ? timestamp-lastRendered<1000/60-.5 : performance.now()<nextFrameAt)return;
  lastRendered=timestamp;
  const renderStarted=performance.now();
  const frameMs=previousFrame===undefined?0:timestamp-previousFrame;
  profiler?.begin(timestamp);
  gpuTimer?.begin();
  pendingResize.flush();
  const delta = previousFrame === undefined ? 0 : Math.min((timestamp - previousFrame) / 1000, .05);
  previousFrame = timestamp; if (motionEnabled) state.time += delta;
  const cameraMoving = Math.abs(scrollAmount - scrollTarget) > .0001;
  if (cameraMoving) {
    const amount=portfolioActive?1-Math.exp(-delta*7):1;
    scrollAmount = T.MathUtils.lerp(scrollAmount, scrollTarget, amount);
  }
  if(cameraMoving||cameraDirty){
    applyScrollCamera();
    reflectionDirty = true;
  }
  world.animate(state.time);
  lighting.update();
  controls.update();
  profiler?.mark('animation');
  // Both views use this frame's animation/camera pose and the same shadow
  // atlas. A separate 5 Hz mirror made moving reflections visibly step and
  // fall behind the scene, especially when the animation clock was capped.
  if(timestamp-lastShadowTime>=1000/6){renderer.shadowMap.needsUpdate=true;lastShadowTime=timestamp;}
  harbourMirror.update();reflectionDirty=false;
  profiler?.mark('reflection');
  composer.render();
  profiler?.mark('mainAndEffects');
  gpuTimer?.end();submissionMs=performance.now()-renderStarted;frameTimestamp=timestamp;
  frameStarted=renderStarted;frameFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();
});

let disposed=false;
function dispose(){
  if(disposed)return;disposed=true;
  renderer.setAnimationLoop(null);disconnectPortfolio();
  removeEventListener('resize',requestResize);
  if(frameFence){gl.deleteSync(frameFence);frameFence=null;}
  gpuTimer?.dispose();
  silhouetteTarget.dispose();renderer.dispose();renderer.forceContextLoss();
}
addEventListener('pagehide',dispose,{once:true});
import.meta.hot?.dispose(dispose);
