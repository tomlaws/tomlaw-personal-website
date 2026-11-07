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
