import { harbourTime } from '../hong-kong-time.mjs';
import { connectPortfolio } from './portfolio-bridge.mjs';
import { embeddedTopInset } from './embedded-viewport.mjs';

// Keep browser/DOM work out of the rendering core, which also runs off-thread.
export function createBrowserRenderHost() {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  return {
    thread:'main',
    canvas: document.getElementById('world'), search: location.search,
    get width() { return innerWidth; }, get height() { return innerHeight; },
    get topInset() { return embeddedTopInset(location.search, innerWidth); },
    get dpr() { return devicePixelRatio; }, get hidden() { return document.hidden; },
    get reducedMotion() { return preference.matches; },
    night: () => harbourTime().night,
    setNight(value) { document.body.classList.toggle('night', value > .55); },
    ready(backend) {
      document.documentElement.dataset.renderer = backend;
      document.documentElement.dataset.renderThread = 'main';
      this.canvas.dataset.renderer = backend;
      const loading = document.getElementById('loading'); loading.classList.add('ready'); loading.hidden = true;
      console.info(`[harbour-renderer] ${backend}`);
      if (parent !== window) parent.postMessage({type:'harbour:state',ready:true,...harbourTime()},location.origin);
    },
    diagnostic(label, data) { console.info(`[${label}]`, JSON.stringify(data)); },
    onResize(callback) { addEventListener('resize', callback); return () => removeEventListener('resize', callback); },
    onMotion(callback) { preference.addEventListener('change', callback); return () => preference.removeEventListener('change', callback); },
    onDispose(callback) { addEventListener('pagehide', callback, {once:true}); return () => removeEventListener('pagehide', callback); },
    connect: connectPortfolio,
  };
}

export function createWorkerRenderHost(canvas, state, send) {
  const resize = new Set(), motion = new Set(), dispose = new Set();
  let controls;
  return {
    thread:'worker',
    canvas, search: state.search,
    get width() { return state.width; }, get height() { return state.height; },
    get topInset() { return embeddedTopInset(state.search, state.width); },
    get dpr() { return state.dpr; }, get hidden() { return state.hidden; },
    get reducedMotion() { return state.reducedMotion; },
    night: () => state.night,
    setNight() {},
    ready(backend) { send({type:'ready', backend}); },
    diagnostic(label, data) { send({type:'diagnostic', label, data}); },
    onResize(callback) { resize.add(callback); return () => resize.delete(callback); },
    onMotion(callback) { motion.add(callback); return () => motion.delete(callback); },
    onDispose(callback) { dispose.add(callback); return () => dispose.delete(callback); },
    connect(value) { controls = value; return () => { controls = undefined; }; },
    receive(message) {
      if (message.type === 'resize') { Object.assign(state, message.viewport); for (const callback of resize) callback(); }
      if (message.type === 'visibility') state.hidden = message.hidden;
      if (message.type === 'motion') { state.reducedMotion = message.reducedMotion; for (const callback of motion) callback(); }
      if (message.type === 'time') { state.night = message.night; controls?.setTime(message.night); }
      if (message.type === 'active') controls?.setActive(message.active);
      if (message.type === 'scroll') controls?.setScroll(message.progress,message.rise);
      if (message.type === 'dispose') for (const callback of [...dispose]) callback();
    },
  };
}
