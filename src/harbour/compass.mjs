import * as T from 'three';

// North follows the harbour-facing diagonal of the diorama. SVG angles run clockwise from
// the needle's initial upward direction; camera-space +Y points up the screen.
export const MAP_NORTH = new T.Vector3(-1, 0, 1).normalize();

export function compassBearing(camera) {
  const north = MAP_NORTH.clone().applyQuaternion(camera.getWorldQuaternion(new T.Quaternion()).invert());
  if (Math.hypot(north.x, north.y) < 1e-8) return null;
  return T.MathUtils.radToDeg(Math.atan2(north.x, north.y));
}
