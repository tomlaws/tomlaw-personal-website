import { Matrix4, Vector2 } from 'three';

// Retain a completed screen-space effect between updates. Camera, viewport and
// DPR changes always invalidate immediately; scene motion still refreshes it.
export function cacheViewPass(pass, renderer, camera, interval, now = () => performance.now()) {
  const update = pass.updateBefore.bind(pass), view = new Matrix4(), projection = new Matrix4(), size = new Vector2();
  let refreshed = -Infinity, width = 0, height = 0, dpr = 0;
  pass.updateBefore = frame => {
    const time = now(); renderer.getSize(size);
    if (time - refreshed < interval && view.equals(camera.matrixWorld) && projection.equals(camera.projectionMatrix)
      && width === size.x && height === size.y && dpr === renderer.getPixelRatio()) return;
    update(frame); refreshed = time; view.copy(camera.matrixWorld); projection.copy(camera.projectionMatrix);
    width = size.x; height = size.y; dpr = renderer.getPixelRatio();
  };
  return () => { refreshed = -Infinity; };
}
