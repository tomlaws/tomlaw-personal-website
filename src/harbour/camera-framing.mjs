import * as T from 'three';

export function fitMapCamera(camera, points, aspect, margin = 1.08) {
  camera.updateMatrixWorld(true);
  const bounds = new T.Box3();
  for (const point of points) bounds.expandByPoint(point.clone().applyMatrix4(camera.matrixWorldInverse));
  const size = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3());
  const halfHeight = Math.max(size.y / 2, size.x / (2 * aspect)) * margin;
  camera.left = center.x - halfHeight * aspect; camera.right = center.x + halfHeight * aspect;
  camera.top = center.y + halfHeight; camera.bottom = center.y - halfHeight;
  camera.clearViewOffset(); camera.updateProjectionMatrix();
}
