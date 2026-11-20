// Three reports shader-link failures through debug callbacks rather than
// throwing. Promote them to renderer failures so an empty frame cannot be
// announced as ready and the existing worker/main-thread fallback can run.
export function captureShaderErrors(renderer) {
  let failure;
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    const details = [gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)]
      .filter(Boolean).join('\n');
    failure ??= new Error(`Harbour shader failed${details ? ': '+details : ''}`);
  };
  return { check() { if (failure) throw failure; } };
}
