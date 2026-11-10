// Keep a steady average cadence despite RAF quantisation, with explicit GPU
// headroom. Reset overdue deadlines after suspension instead of catching up.
export function nextBackgroundFrame(previousDeadline, started, completed, fps = 24, duty = .6) {
  const interval = 1000 / fps;
  const anchor = !Number.isFinite(previousDeadline) || started - previousDeadline > interval * 2
    ? started : previousDeadline;
  const work = Math.max(0, completed - started);
  return Math.max(anchor + interval, completed + work * (1 - duty) / duty);
}

// Keep the full-resolution reflection but update it at a lower cadence on
// phones, leaving more GPU time for scrolling and the main animated scene.
export function shouldUpdateReflection(width, dirty, timestamp, lastUpdate) {
  return width > 650 || dirty || timestamp - lastUpdate >= 1000 / 12;
}

// Animations use elapsed time rather than slowing down when frames are sparse.
// Bound unusually long stalls; hidden and paused scenes reset the previous frame.
export function animationDelta(previousTimestamp, timestamp) {
  if (previousTimestamp === undefined || !Number.isFinite(timestamp) || !Number.isFinite(previousTimestamp)) return 0;
  return Math.min(1, Math.max(0, (timestamp - previousTimestamp) / 1000));
}
