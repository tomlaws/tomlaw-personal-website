import { harbourTime } from '../hong-kong-time.mjs';
import { connectPortfolio } from './portfolio-bridge.mjs';

const liveWorkers = new Set();
import.meta.hot?.dispose(() => { for (const dispose of [...liveWorkers]) dispose(); });

export function startWorkerRenderer({onFailure = () => {}} = {}) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById('world');
    const worker = new Worker(new URL('./webgpu-worker.js', import.meta.url), {type:'module'});
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();
    let settled = false, disposed = false, disconnect = () => {};
    const send = message => { if (!disposed) worker.postMessage(message); };
    const viewport = () => ({width:innerWidth, height:innerHeight, dpr:devicePixelRatio});
    const resize = () => send({type:'resize', viewport:viewport()});
    const visibility = () => send({type:'visibility', hidden:document.hidden});
    const motion = () => send({type:'motion', reducedMotion:preference.matches});
    function dispose() {
      if (disposed) return; disposed = true;
      liveWorkers.delete(dispose);
      disconnect(); worker.terminate();
      removeEventListener('resize', resize); removeEventListener('pagehide', dispose);
      document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion);
    }
    liveWorkers.add(dispose);
    function fail(error) { if (disposed) return; dispose(); if (settled) onFailure(error); else reject(error); }
    worker.addEventListener('error', event => { event.preventDefault(); fail(new Error(event.message || 'Render worker failed')); });
    worker.addEventListener('message', ({data}) => {
      if (data.type === 'error') fail(new Error(data.message));
      if (data.type === 'diagnostic') console.info(`[${data.label}]`, JSON.stringify(data.data));
      if (data.type !== 'ready' || disposed || settled) return;
      settled = true;
      document.documentElement.dataset.renderer = data.backend;
      document.documentElement.dataset.renderThread = 'worker';
      canvas.dataset.renderer = data.backend;
      const loading = document.getElementById('loading'); loading.classList.add('ready'); loading.hidden = true;
      console.info(`[harbour-renderer] ${data.backend} (worker)`);
      if (new URLSearchParams(location.search).has('profile')) console.info('[startup-profile]', JSON.stringify({readyMs:Math.round(performance.now()-started)}));
      disconnect = connectPortfolio({
        setTime:night => send({type:'time', night}),
        setActive:active => send({type:'active', active}),
        setScroll:(progress,rise) => send({type:'scroll', progress,rise}),
      });
      resolve({dispose, backend:data.backend});
    });
    addEventListener('resize', resize); addEventListener('pagehide', dispose, {once:true});
    document.addEventListener('visibilitychange', visibility); preference.addEventListener('change', motion);
    try {
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({type:'init', canvas:offscreen, state:{...viewport(), search:location.search,
        hidden:document.hidden, reducedMotion:preference.matches, night:harbourTime().night}}, [offscreen]);
    } catch (error) { fail(error); }
  });
}
