// Count visible time so switching tabs does not turn a slow load into an error.
// Workers have no document and use an ordinary elapsed-time deadline.
export function startLoadingTimeout(onTimeout, {
  timeoutMs,
  document: page = globalThis.document,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let remaining = timeoutMs, started, timer, stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimer(timer);
    page?.removeEventListener('visibilitychange', visibility);
  };
  const expire = () => { stop(); onTimeout(); };
  function visibility() {
    if (stopped) return;
    if (timer !== undefined) {
      remaining -= Math.max(0, now() - started);
      clearTimer(timer); timer = undefined;
    }
    if (!page?.hidden) {
      started = now();
      timer = setTimer(expire, Math.max(0, remaining));
    }
  }
  page?.addEventListener('visibilitychange', visibility);
  visibility();
  return stop;
}
