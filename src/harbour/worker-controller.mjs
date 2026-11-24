import { harbourTime } from '../hong-kong-time.mjs';
import { connectRenderClock } from './render-clock.mjs';
import { startLoadingTimeout } from '../loading-timeout.mjs';
import { createViewportChange } from './frame-resize.mjs';

const liveWorkers = new Set();
import.meta.hot?.dispose(() => { for (const dispose of [...liveWorkers]) dispose(); });

export function startWorkerRenderer({onFailure = () => {}, backend = 'webgpu',
  canvas = document.getElementById('world'), search = location.search,
  viewport = () => ({width:innerWidth, height:innerHeight, dpr:devicePixelRatio}),
  connect = connectRenderClock, signal} = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Renderer disposed','AbortError')); return; }
    const worker = backend === 'webgl'
      ? new Worker(new URL('./webgl-worker.js', import.meta.url), {type:'module'})
      : new Worker(new URL('./webgpu-worker.js', import.meta.url), {type:'module'});
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const started = performance.now();
    let settled = false, disposed = false, disconnect = () => {}, stopTimeout = () => {};
    const send = message => { if (!disposed) worker.postMessage(message); };
    const resize = createViewportChange(viewport, value => send({type:'resize', viewport:value}));
    const visibility = () => send({type:'visibility', hidden:document.hidden});
    const motion = () => send({type:'motion', reducedMotion:preference.matches});
    function dispose() {
      if (disposed) return; disposed = true;
      liveWorkers.delete(dispose);
      stopTimeout(); disconnect(); worker.terminate();
      signal?.removeEventListener('abort', abort);
      removeEventListener('resize', resize); removeEventListener('pagehide', dispose);
      document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion);
    }
    function abort() { dispose(); if (!settled) reject(new DOMException('Renderer disposed','AbortError')); }
    signal?.addEventListener('abort', abort, {once:true});
    liveWorkers.add(dispose);
    function fail(error) { if (disposed) return; dispose(); if (settled) onFailure(error); else reject(error); }
    worker.addEventListener('error', event => { event.preventDefault(); fail(new Error(event.message || 'Render worker failed')); });
    worker.addEventListener('messageerror', () => fail(new Error('Render worker returned invalid data')));
    worker.addEventListener('message', ({data}) => {
      if (disposed) return;
      if (data.type === 'error') fail(new Error(data.message));
      if (data.type === 'diagnostic') console.info(`[${data.label}]`, JSON.stringify(data.data));
      if (data.type !== 'ready' || disposed || settled) return;
      stopTimeout();
      settled = true;
      document.documentElement.dataset.renderer = data.backend;
      document.documentElement.dataset.renderThread = 'worker';
      canvas.dataset.renderer = data.backend;
      const loading = document.getElementById('loading');
      if (loading) { loading.classList.add('ready'); loading.hidden = true; }
      console.info(`[harbour-renderer] ${data.backend} (worker)`);
      if (new URLSearchParams(location.search).has('profile')) console.info('[startup-profile]', JSON.stringify({readyMs:Math.round(performance.now()-started)}));
      disconnect = connect({
        setTime:night => send({type:'time', night}),
        setActive:active => send({type:'active', active}),
        setScrolling:scrolling => send({type:'scrolling', scrolling}),
        setScroll:(progress,rise) => send({type:'scroll', progress,rise}),
      });
      resolve({dispose, backend:data.backend});
    });
    addEventListener('resize', resize); addEventListener('pagehide', dispose, {once:true});
    document.addEventListener('visibilitychange', visibility); preference.addEventListener('change', motion);
    stopTimeout = startLoadingTimeout(() => fail(new Error('Render worker startup timed out')),
      {timeoutMs:45_000});
    try {
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({type:'init', canvas:offscreen, state:{...viewport(), search,
        hidden:document.hidden, reducedMotion:preference.matches, night:harbourTime().night}}, [offscreen]);
    } catch (error) { fail(error); }
  });
}
