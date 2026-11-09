// Resizing a drawing buffer clears its presented image. Coalesce browser
// events and apply the latest size only when the next frame can also draw it.
export function createFrameResize(apply) {
  let pending = false;
  return {
    request() { pending = true; },
    flush() {
      if (!pending) return false;
      pending = false;
      apply();
      return true;
    },
  };
}

// Avoid clearing the first presented frame when the viewport did not change.
// Update all dimensions together so a DPR change does not resize twice.
export function resizeWebGpuBuffer(renderer, width, height, pixelRatio) {
  const size = renderer.getSize({ set(x, y) { this.x = x; this.y = y; return this; } });
  if (size.x === width && size.y === height && renderer.getPixelRatio() === pixelRatio) return false;
  renderer.setDrawingBufferSize(width, height, pixelRatio);
  return true;
}
