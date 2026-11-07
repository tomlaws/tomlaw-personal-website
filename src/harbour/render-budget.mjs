// A background scene should leave headroom for the rest of the browser.
// Lower resolution only after sustained slow frames; keep every scene effect.
export function createRenderBudget(onChange = () => {}, {
  initialPixels = 1_000_000, minimumPixels = 600_000, sampleCount = 60,
  gpuBudgetMs = Infinity, targetFrameMs = 42,
} = {}) {
  let pixels = initialPixels, samples = 0, frameTotal = 0, cpuTotal = 0, gpuTotal = 0, severe = 0;
  function lower(factor) {
    const next = Math.max(minimumPixels, Math.round(pixels * factor));
    if (next < pixels) { pixels = next; onChange(pixels); }
  }
  return {
    get pixels() { return pixels; },
    observe(frameMs, cpuMs, completeMs = cpuMs) {
      if (!Number.isFinite(frameMs) || !Number.isFinite(cpuMs) || frameMs <= 0) return;
      // Occluded browsers may intentionally deliver one frame per second.
      if (frameMs > 250 && Math.max(cpuMs, completeMs) < 25) return;
      if (Number.isFinite(gpuBudgetMs) && completeMs > 150) {
        if (++severe >= 2) { lower(.7); severe = 0; samples = frameTotal = cpuTotal = gpuTotal = 0; }
        return;
      }
      severe = 0;
      frameTotal += Math.min(frameMs, 100); cpuTotal += cpuMs; gpuTotal += completeMs; samples++;
      if (samples < sampleCount) return;
      const slow = frameTotal / samples > targetFrameMs || cpuTotal / samples > 20 || gpuTotal / samples > gpuBudgetMs;
      samples = frameTotal = cpuTotal = gpuTotal = 0;
      if (slow) lower(.85);
    },
  };
}
