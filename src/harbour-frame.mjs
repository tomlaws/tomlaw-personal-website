import { startLoadingTimeout } from './loading-timeout.mjs';

// Observe the scrolling introduction, not the fixed background iframe.
export function connectHarbourFrame({ frame, channel, hero, onReady, onError,
  window: host = window, document: page = document,
  Observer = globalThis.IntersectionObserver, timeoutMs = 90_000 }) {
  let status = 'loading', disposed = false, observer;
  let inView = true, lastActive, lastWindow, scrolling = false, lastScrolling, scrollTimer;
  const visible = () => {
    const bounds = hero.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < host.innerHeight;
  };
  function sync(force = false) {
    if (disposed) return;
    const target = frame?.contentWindow ?? channel;
    const active = status !== 'error' && inView && !page.hidden;
    const changedWindow = target !== lastWindow;
    if (!active) { scrolling = false; clearTimeout(scrollTimer); }
    if (target && (force || changedWindow || active !== lastActive)) {
      target.postMessage({type:'harbour:command', command:'active', active}, host.location.origin);
      lastWindow = target; lastActive = active;
    }
    if (target && (force || changedWindow || scrolling !== lastScrolling)) {
      target.postMessage({type:'harbour:command', command:'scrolling', scrolling}, host.location.origin);
      lastScrolling = scrolling;
    }
  }
  const endScroll = () => { clearTimeout(scrollTimer); scrolling = false; sync(); };
  const onScroll = () => {
    if (disposed || status === 'error' || !inView || page.hidden || host.innerWidth > 650) return;
    scrolling = true; sync();
    clearTimeout(scrollTimer); scrollTimer = setTimeout(endScroll, 180);
  };
  function fail() {
    if (disposed || status === 'error') return;
    status = 'error'; stopTimeout(); sync(); onError();
  }
  const stopTimeout = startLoadingTimeout(fail, {timeoutMs, document:page});
  function ready() {
    if (disposed || status === 'error') return;
    stopTimeout();
    if (status !== 'ready') { status = 'ready'; onReady(); }
    sync(true);
  }
  function receive(event) {
    if (disposed || status === 'error' || event.origin !== host.location.origin ||
        event.source !== frame.contentWindow) return;
    if (event.data?.type === 'harbour:error') { fail(); return; }
    if (event.data?.type !== 'harbour:state' || event.data.ready !== true) return;
    // Renderer fallback reconnects its listeners. Replay the current visibility.
    ready();
  }
  const measure = () => { inView = visible(); sync(); };
  if (frame) host.addEventListener('message', receive);
  host.addEventListener('scroll', onScroll, {passive:true});
  host.addEventListener('touchmove', onScroll, {passive:true});
  host.addEventListener('scrollend', endScroll);
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
    ready,
    sync: () => { inView = visible(); sync(true); },
    fail,
    dispose() {
      disposed = true; stopTimeout(); observer?.disconnect(); clearTimeout(scrollTimer);
      host.removeEventListener('message', receive);
      host.removeEventListener('scroll', measure);
      host.removeEventListener('resize', measure);
      host.removeEventListener('scroll', onScroll);
      host.removeEventListener('touchmove', onScroll);
      host.removeEventListener('scrollend', endScroll);
      page.removeEventListener('visibilitychange', measure);
    },
  };
}
