// Keep a steady average cadence despite RAF quantisation, with explicit GPU
// headroom. Reset overdue deadlines after suspension instead of catching up.
export function nextBackgroundFrame(previousDeadline, started, completed, fps = 30, duty = .75) {
  const interval = 1000 / fps;
  const anchor = !Number.isFinite(previousDeadline) || started - previousDeadline > interval * 2
    ? started : previousDeadline;
  const work = Math.max(0, completed - started);
  return Math.max(anchor + interval, completed + work * (1 - duty) / duty);
}

// Polling a fence on RAF includes up to one refresh of idle scheduling time.
// Without a GPU timer (notably on Safari), don't count that wait as GPU work.
export function estimatedWorkCompletion(started, completed, cpuMs, gpuMs) {
  if (Number.isFinite(gpuMs)) return started + Math.max(cpuMs, gpuMs);
  return Math.max(started + cpuMs, completed - 1000 / 60);
}

// Moving boats need a live reflection, but a second scene render every frame
// competes with the main scene. Refresh at a bounded rate on all devices.
export function shouldUpdateReflection(width, dirty, timestamp, lastUpdate, motion = true) {
  return dirty || (motion && timestamp - lastUpdate >= 1000 / (width <= 650 ? 8 : 12));
}

// Animations use elapsed time rather than slowing down when frames are sparse.
// Bound unusually long stalls; hidden and paused scenes reset the previous frame.
export function animationDelta(previousTimestamp, timestamp) {
  if (previousTimestamp === undefined || !Number.isFinite(timestamp) || !Number.isFinite(previousTimestamp)) return 0;
  return Math.min(1, Math.max(0, (timestamp - previousTimestamp) / 1000));
}
