import * as T from 'three/webgpu';
import { createCoastalLighting } from './coastal-lighting.mjs';
import { loadHarbourWorld } from './prepared-world-loader.mjs';
import { CITY_LAYOUT as site } from './layout.mjs';
import { fitMapCamera } from './camera-framing.mjs';
import { homeView } from './camera-home.mjs';
import { createHarbourTime } from './harbour-time.mjs';
import { createRenderProfiler } from './render-profiler.mjs';
import { harbourTheme } from '../harbour-theme.mjs';
import { portfolioCameraPose, keepMobileMapVisible, fitScrollFrame } from './portfolio-camera.mjs';
import { mapPixelRatio } from './render-quality.mjs';
import { portHarbourMaterials } from './webgpu-materials.mjs';
import { createNodeEnvironment, mixedSky } from './webgpu-sky.mjs';
import { createNodeWaterReflection } from './webgpu-reflection.mjs';
import { createNodePostProcessing } from './webgpu-post.mjs';
import { isolateFramebufferTextures } from './webgpu-compat.mjs';
import { createBrowserRenderHost } from './render-host.mjs';
import { nextBackgroundFrame } from './frame-pacing.mjs';
import { warmScenePipelines } from './startup-work.mjs';
import { CompactLighting } from './compact-lighting.mjs';
import { createFrameResize } from './frame-resize.mjs';

export async function startWebGPU({ host = createBrowserRenderHost(), onFailure = () => {} } = {}) {
  const canvas = host.canvas;
  const params = new URLSearchParams(host.search);
  const startupAt = performance.now();
  let stageAt = startupAt;
  const report = (name,started) => {
    if(params.has('profile'))host.diagnostic('startup-stage',{name,ms:Math.round(performance.now()-started),totalMs:Math.round(performance.now()-startupAt)});
  };
  const stage = name => {
    const now = performance.now();
    if (params.has('profile')) host.diagnostic('startup-stage', {name,ms:Math.round(now-stageAt),totalMs:Math.round(now-startupAt)});
    stageAt = now;
  };
  const capturing = params.has('capture');
  const temporalQA = import.meta.env.DEV && params.has('qaTemporal');
  isolateFramebufferTextures();
  const renderer = new T.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if(import.meta.env.DEV&&params.get('qaLighting')==='compact')renderer.lighting=new CompactLighting();
  let cleanup = () => { renderer.onDeviceLost = () => {}; renderer.dispose(); renderer.backend.device?.destroy(); };
  let stopped = false;
  const stop = () => { stopped = true; cleanup(); };
  const disconnectDispose = host.onDispose(stop);
  import.meta.hot?.dispose(stop);
  const checkAlive = () => { if (stopped) { cleanup(); throw new DOMException('Renderer disposed', 'AbortError'); } };
  let validationDevice, validationOpen = false;
  const preparedWorld=(async()=>{
    const started=performance.now();
    const world=await loadHarbourWorld({procedural:import.meta.env.DEV&&params.get('qaWorld')==='procedural',
      diagnostic:(label,data)=>{if(params.has('profile'))host.diagnostic(label,data);},
    });
    report('world-load',started);checkAlive();
    return world;
  })().then(world=>({world}),error=>({error}));
  try {
    const adapterStarted=performance.now();
    await renderer.init();
    report('adapter',adapterStarted);stageAt=performance.now();
    checkAlive();
    if (!renderer.backend.isWebGPUBackend) throw new Error('A native WebGPU adapter is unavailable');
    const backend = 'webgpu';
    validationDevice = renderer.backend.device;
    if (validationDevice) { validationDevice.pushErrorScope('validation'); validationOpen = true; }
    const ratio = () => mapPixelRatio(host.dpr);
    renderer.setPixelRatio(ratio()); renderer.setSize(host.width, host.height, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.VSMShadowMap;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = .98;
    renderer.setClearColor(0x000000);
    const scene = new T.Scene(); scene.background = new T.Color(0x000000);
    scene.fog = new T.Fog('#bedfe9', 70, 240);
    const environment = await createNodeEnvironment(renderer); scene.environment = environment.texture;
    stage('environment');
    checkAlive();
    const home = homeView(site.center);
    const camera = new T.OrthographicCamera(-10, 10, 8, -8, .1, 80);
    camera.coordinateSystem = renderer.coordinateSystem; camera.position.copy(home.position);
    const look = () => { camera.lookAt(home.target); camera.updateMatrixWorld(true); };
    look();
    const prepared=await preparedWorld;
    if(prepared.error)throw prepared.error;
    const world=prepared.world;
    checkAlive();
    const clippedWorld = new T.ClippingGroup(); clippedWorld.add(world.root); scene.add(clippedWorld);
    const lighting = createCoastalLighting(scene, world);
    lighting.sun.shadow.autoUpdate = false; lighting.sun.shadow.needsUpdate = true;
    const timeLighting = createHarbourTime(scene, world, lighting);
    portHarbourMaterials(world.root, timeLighting.windowUniform);
    const glint = new T.PointLight('#fff2d2', 40, 30, 1.6);
    glint.position.set(-1.5, 2.4, 11); scene.add(glint);
    const mirror = createNodeWaterReflection(renderer, scene, camera, world, clippedWorld);
    const post = createNodePostProcessing(renderer, scene, camera, {search:host.search});
    let scrollTarget = 0, scrollAmount = 0, riseTarget=0, portfolioFrame, cameraDirty=false, reflectionDirty = true;
    let active = true, motion = !capturing && !temporalQA && !host.reducedMotion;
    let time = 0, previousFrame, nextFrameAt = -Infinity, lastShadow = -Infinity, lastNight;
    function pose() {
      const value = portfolioCameraPose(home, scrollAmount, host.width <= 650);
      camera.position.copy(value.position); camera.zoom = value.zoom; look();
      if(portfolioFrame)fitScrollFrame(camera,world.framingPoints,portfolioFrame,host.width,host.height,riseTarget*value.phase,value.zoomFactor);
      camera.updateProjectionMatrix();
      cameraDirty=false;
    }
    function resize() {
      if(renderer.getPixelRatio()!==ratio())renderer.setPixelRatio(ratio());
      renderer.setSize(host.width, host.height, false);
      camera.position.copy(home.position); camera.zoom = 1; look();
      const aspect = host.width / host.height, sideSpace = host.width > 650 ? .34 : 0;
      fitMapCamera(camera, world.framingPoints, aspect * (1 - sideSpace), 1.12);
      const halfHeight = (camera.top - camera.bottom) / 2, centerX = (camera.left + camera.right) / 2;
      camera.left = centerX - halfHeight * aspect * (1 + sideSpace);
      camera.right = centerX + halfHeight * aspect * (1 - sideSpace);
      const shift = halfHeight * (host.width <= 650 ? .55 : T.MathUtils.clamp((aspect - 1.1) * .30, 0, .20));
      camera.top += shift; camera.bottom += shift;
      if(host.width<=650)keepMobileMapVisible(camera,world.framingPoints,host.height,portfolioCameraPose(home,0,true).zoom);
      portfolioFrame={left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom};
      pose();
      reflectionDirty = true;
    }
    const pendingResize=createFrameResize(resize);
    const requestResize=()=>{pendingResize.request();reflectionDirty=true;};
    function setTime(value) {
      const t = T.MathUtils.clamp(value, 0, 1), haze = T.MathUtils.smoothstep(t, .35, .95);
      if (t === lastNight) return; lastNight = t;
      timeLighting.set(t); host.setNight(t);
      mirror.setNight(t);
      glint.intensity = T.MathUtils.lerp(40, 5, t);
      world.materials.warm.emissiveIntensity = T.MathUtils.lerp(.55, 2.4, t);
      world.materials.teal.emissiveIntensity = T.MathUtils.lerp(.60, 1.3, t);
      world.materials.pink.emissiveIntensity = T.MathUtils.lerp(.55, 1.5, t);
      scene.fog.color.set('#bedfe9').lerp(new T.Color('#25384e'), t);
      scene.fog.near = T.MathUtils.lerp(70, 16, haze); scene.fog.far = T.MathUtils.lerp(240, 65, haze);
      renderer.toneMappingExposure = T.MathUtils.lerp(.98, .72, t);
      environment.update(t); scene.environmentIntensity = T.MathUtils.lerp(.82, .38, t);
      post.setTime(t); post.setBackground(harbourTheme(t)['--background']);
      mirror.updateSky(mixedSky(t)); lighting.sun.shadow.needsUpdate = true; reflectionDirty = true;
    }
    resize(); world.animate(0); lighting.update(); setTime(host.night());
    stage('materials-and-lights');
    // Warm the actual HDR/clipped targets, with bounded asynchronous driver work.
    // Avoid both a giant first-submit compilation spike and unused canvas variants.
    await warmScenePipelines(renderer,async()=>{
      await mirror.compile();checkAlive();await post.compileScene();checkAlive();await post.compileEffects();checkAlive();
    });
    stage('pipeline-warmup');
    mirror.update();
    stage('first-reflection');
    checkAlive();
    // Compile the post-processing node graph and validate its first submitted frame.
    post.render();
    stage('first-main-and-effects');
    if (renderer.backend.device) await renderer.backend.device.queue.onSubmittedWorkDone();
    stage('gpu-ready');
    checkAlive();
    if (validationOpen) {
      const error = await validationDevice.popErrorScope(); validationOpen = false;
      if (error) throw new Error(`WebGPU validation: ${error.message}`);
    }
    // The page can finish layout or resize while shaders initialize off-thread.
    // Refit from the latest host dimensions before declaring the scene ready;
    // otherwise the old drawing buffer gets stretched into the new viewport.
    resize();
    const onMotion = () => { motion = !capturing && !temporalQA && !host.reducedMotion; if (!motion) { scrollTarget = scrollAmount = riseTarget = 0; pose(); } reflectionDirty = true; };
    const disconnectMotion = host.onMotion(onMotion), disconnectResize = host.onResize(requestResize);
    const disconnect = host.connect({
      setTime,
      setActive(value) { active = value; reflectionDirty = true; },
      setScroll(value,rise=0) { scrollTarget = motion ? value : 0; riseTarget=motion?rise:0; cameraDirty=true; reflectionDirty=true; },
    });
    const profiler = params.has('profile') ? createRenderProfiler(renderer, data => host.diagnostic('render-profile', data)) : null;
    let disposed = false;
    cleanup = () => {
      if (disposed) return; disposed = true;
      renderer.setAnimationLoop(null); disconnectResize(); disconnectMotion();
      validationDevice?.removeEventListener('uncapturederror', onGPUError);
      disconnectDispose();
      disconnect();
      post.dispose(); mirror.dispose(); environment.dispose(); renderer.dispose();
      renderer.backend.device?.destroy();
    };
    let failed = false;
    function fail(error) { if (failed || disposed) return; failed = true; cleanup(); onFailure(error); }
    function onGPUError(event) { event.preventDefault(); fail(new Error(`WebGPU rendering failed: ${event.error.message}`)); }
    validationDevice?.addEventListener('uncapturederror', onGPUError);
    renderer.onDeviceLost = info => fail(new Error(`WebGPU device lost: ${info.message}`));
    let framePending = false, qaFrame = 0;
    renderer.setAnimationLoop(async timestamp => {
      if (framePending) return;
      if (failed || host.hidden || (!active && !reflectionDirty)) { previousFrame = undefined; return; }
      if (!motion && !reflectionDirty && !temporalQA) { previousFrame = undefined; return; }
      if (temporalQA && qaFrame >= 16) return;
      if (performance.now() < nextFrameAt) return;
      const started = performance.now(), frameMs = previousFrame === undefined ? 0 : timestamp - previousFrame;
      const delta = previousFrame === undefined ? 0 : Math.min(frameMs / 1000, .05); previousFrame = timestamp;
      try {
        framePending = true;
        pendingResize.flush();
        profiler?.begin(timestamp); if (motion) time += delta;
        const moving = Math.abs(scrollAmount - scrollTarget) > .0001;
        if (moving) {
          const amount=active?1-Math.exp(-delta*7):1;
          scrollAmount = T.MathUtils.lerp(scrollAmount, scrollTarget, amount);
        }
        if(moving||cameraDirty){
          pose(); reflectionDirty = true;
        }
        world.animate(time); lighting.update(); look(); profiler?.mark('animation');
        // Schedule the shared sun atlas before either camera consumes it.
        if (timestamp - lastShadow >= 1000 / 6) { lighting.sun.shadow.needsUpdate = true; lastShadow = timestamp; }
        // The live mirror follows every presented frame. The alternating QA
        // fixture remains useful for testing independent transmission buffers.
        const updateMirror = !temporalQA || qaFrame % 2 === 0;
        if (updateMirror) {
          mirror.update(); reflectionDirty = false;
        }
        profiler?.mark('reflection');
        post.render(); profiler?.mark('mainAndEffects');
        const submissionMs = performance.now() - started;
        if (renderer.backend.device) await renderer.backend.device.queue.onSubmittedWorkDone();
        const completedAt = performance.now(), completeMs = completedAt - started;
        profiler?.end(timestamp,{cpuMs:submissionMs,completeMs});
        // Keep desktop/browser headroom rather than immediately filling the
        // GPU queue again. At most 24 FPS, and <=60% duty when GPU-bound.
        nextFrameAt = nextBackgroundFrame(nextFrameAt, started, completedAt);
        if (temporalQA) host.diagnostic('temporal-qa', { frame: qaFrame++, mirror: updateMirror, ...await post.temporalSample() });
      } catch (error) { fail(error); }
      finally { framePending = false; }
    });
    host.ready(backend);
    return { renderer, dispose: cleanup, backend };
  } catch (error) {
    const cancelled = stopped;
    stopped = true;
    if (validationOpen) await validationDevice.popErrorScope().catch(() => {});
    cleanup(); disconnectDispose();
    if (cancelled) throw new DOMException('Renderer disposed', 'AbortError');
    throw error;
  }
}
