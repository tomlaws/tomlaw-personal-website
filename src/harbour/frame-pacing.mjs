// Keep a steady average cadence despite RAF quantisation, with explicit GPU
// headroom. Reset overdue deadlines after suspension instead of catching up.
export function nextBackgroundFrame(previousDeadline, started, completed, fps = 30, duty = .75) {
  const interval = 1000 / fps;
  const anchor = !Number.isFinite(previousDeadline) || started - previousDeadline > interval * 2
    ? started : previousDeadline;
  const work = Math.max(0, completed - started);
  return Math.max(anchor + interval, completed + work * (1 - duty) / duty);
}

const normalBudget = Object.freeze({fps:30,duty:.75});
const scrollBudget = Object.freeze({fps:24,duty:.6});
// Keep animation live while reserving more of a phone's GPU for page scrolling.
export function backgroundFrameBudget(width, scrolling) {
  return width > 0 && width <= 650 && scrolling ? scrollBudget : normalBudget;
}

// A completed fence gives no completion timestamp. A delayed RAF may include
// page scheduling or scrolling time, so only count observed unfinished work
// when GPU timestamps are unavailable. Never add a second rest for that delay.
export function estimatedWorkCompletion(started, completed, cpuMs, gpuMs, lastBusyAt = started) {
  if (Number.isFinite(gpuMs)) return started + Math.max(cpuMs, gpuMs);
  return Math.max(started + cpuMs, Math.min(completed, lastBusyAt));
}

// Moving boats need a live reflection, but a second scene render every frame
// competes with the main scene. Refresh at a bounded rate on all devices.
export function shouldUpdateReflection(width, dirty, timestamp, lastUpdate, motion = true, scrolling = false) {
  return dirty || (motion && timestamp - lastUpdate >= 1000 / (width <= 650 ? 8 : 12));
}

// A wall-time limit alone recaptures the whole city on every slow frame.
// Leave at least one ordinary scene frame between routine mirror captures;
// ferry/boat animation still refreshes near 8 Hz on phones, including scrolling.
export function createReflectionSchedule() {
  let frame = 0, lastFrame = -Infinity, lastUpdate = -Infinity;
  return (width, dirty, timestamp, motion = true) => {
    frame++;
    if (!dirty && (frame - lastFrame < 2 || !shouldUpdateReflection(width, false, timestamp, lastUpdate, motion))) return false;
    lastFrame = frame;
    lastUpdate = timestamp;
    return true;
  };
}

// Animations use elapsed time rather than slowing down when frames are sparse.
// Bound unusually long stalls; hidden and paused scenes reset the previous frame.
export function animationDelta(previousTimestamp, timestamp) {
  if (previousTimestamp === undefined || !Number.isFinite(timestamp) || !Number.isFinite(previousTimestamp)) return 0;
  return Math.min(1, Math.max(0, (timestamp - previousTimestamp) / 1000));
}
