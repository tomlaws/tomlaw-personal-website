// Pause expensive map rendering for an entire touch gesture and its momentum.
// A tap or programmatic scroll resumes after the same short idle interval.
export function createMobileGesture({ enabled, setSuspended, delay = 450, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let touching = false, suspended = false, timer;
  const pause = () => {
    if (!enabled()) return false;
    if (!suspended) { suspended = true; setSuspended(true); }
    clearTimer(timer); timer = undefined;
    return true;
  };
  const resume = () => {
    clearTimer(timer); timer = undefined;
    if (touching || !suspended) return;
    suspended = false; setSuspended(false);
  };
  const scheduleResume = () => {
    clearTimer(timer);
    if (!touching && suspended) timer = setTimer(resume, delay);
  };
  return {
    touchStart() { if (pause()) touching = true; },
    touchEnd(event) { touching = Boolean(event?.touches?.length); if (!touching) scheduleResume(); },
    scroll() { if (pause()) scheduleResume(); },
    scrollEnd() { if (!touching) resume(); },
    dispose() { touching = false; resume(); },
  };
}
