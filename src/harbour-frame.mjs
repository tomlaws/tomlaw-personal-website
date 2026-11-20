import { startLoadingTimeout } from './loading-timeout.mjs';

// Observe the scrolling introduction, not the fixed background iframe.
export function connectHarbourFrame({ frame, hero, onReady, onError,
  window: host = window, document: page = document,
  Observer = globalThis.IntersectionObserver, timeoutMs = 90_000 }) {
  let status = 'loading', disposed = false, observer;
  let inView = true, lastActive, lastWindow;
  const visible = () => {
    const bounds = hero.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < host.innerHeight;
  };
  function sync(force = false) {
    if (disposed) return;
    const target = frame.contentWindow;
    const active = status !== 'error' && inView && !page.hidden;
    if (target && (force || target !== lastWindow || active !== lastActive)) {
      target.postMessage({type:'harbour:command', command:'active', active}, host.location.origin);
      lastWindow = target; lastActive = active;
    }
  }
  function fail() {
    if (disposed || status === 'error') return;
    status = 'error'; stopTimeout(); sync(); onError();
  }
  const stopTimeout = startLoadingTimeout(fail, {timeoutMs, document:page});
  function receive(event) {
    if (disposed || status === 'error' || event.origin !== host.location.origin ||
        event.source !== frame.contentWindow) return;
    if (event.data?.type === 'harbour:error') { fail(); return; }
    if (event.data?.type !== 'harbour:state' || event.data.ready !== true) return;
    stopTimeout();
    if (status !== 'ready') { status = 'ready'; onReady(); }
    // Renderer fallback reconnects its listeners. Replay the current visibility.
    sync(true);
  }
  const measure = () => { inView = visible(); sync(); };
  host.addEventListener('message', receive);
  page.addEventListener('visibilitychange', measure);
  if (Observer) {
    observer = new Observer(entries => {
      if (disposed) return;
      const entry = entries.find(item => item.target === hero);
      if (entry) { inView = entry.isIntersecting; sync(); }
    });
    observer.observe(hero);
  } else {
    host.addEventListener('scroll', measure, {passive:true});
    host.addEventListener('resize', measure);
  }
  measure();
  return {
    sync: () => { inView = visible(); sync(true); },
    fail,
    dispose() {
      disposed = true; stopTimeout(); observer?.disconnect();
      host.removeEventListener('message', receive);
      host.removeEventListener('scroll', measure);
      host.removeEventListener('resize', measure);
      page.removeEventListener('visibilitychange', measure);
    },
  };
}
