import { Matrix4 } from 'three';

// Keep Three's complete UnrealBloomPass and reuse only its finished glow.
// The current sharp scene is still rendered and composited on every frame.
export function cacheBloomPass(pass, camera, interval, now = () => performance.now()) {
  const render = pass.render.bind(pass), resize = pass.setSize.bind(pass);
  const view = new Matrix4(), projection = new Matrix4();
  const tints = pass.bloomTintColors.map(color => color.clone());
  let valid = false, refreshed = -Infinity, strength, radius, threshold;
  pass.setSize = (...args) => { valid = false; return resize(...args); };
  pass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
    const time = now();
    const changed = !view.equals(camera.matrixWorld) || !projection.equals(camera.projectionMatrix)
      || strength !== pass.strength || radius !== pass.radius || threshold !== pass.threshold
      || tints.some((color, i) => !color.equals(pass.bloomTintColors[i]));
    if (!valid || changed || time - refreshed >= interval() || pass.renderToScreen || maskActive) {
      render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      valid = true; refreshed = time;
      view.copy(camera.matrixWorld); projection.copy(camera.projectionMatrix);
      strength = pass.strength; radius = pass.radius; threshold = pass.threshold;
      tints.forEach((color, i) => color.copy(pass.bloomTintColors[i]));
      return;
    }
    const autoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      pass._fsQuad.material = pass.blendMaterial;
      pass.copyUniforms.tDiffuse.value = pass.renderTargetsHorizontal[0].texture;
      renderer.setRenderTarget(readBuffer);
      pass._fsQuad.render(renderer);
    } finally { renderer.autoClear = autoClear; }
  };
}
