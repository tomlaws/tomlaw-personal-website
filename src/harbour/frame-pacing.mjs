// Keep a steady average cadence despite RAF quantisation, with explicit GPU
// headroom. Reset overdue deadlines after suspension instead of catching up.
export function nextBackgroundFrame(previousDeadline, started, completed, fps = 24, duty = .6) {
  const interval = 1000 / fps;
  const anchor = !Number.isFinite(previousDeadline) || started - previousDeadline > interval * 2
    ? started : previousDeadline;
  const work = Math.max(0, completed - started);
  return Math.max(anchor + interval, completed + work * (1 - duty) / duty);
}
