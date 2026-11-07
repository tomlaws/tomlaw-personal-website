import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld } from '../src/harbour/coastal-world.mjs';

const world = createWorld({ models: {} });
world.root.updateMatrixWorld(true);
const wall = world.ocean.sides;
assert.equal(wall.material.side, T.DoubleSide, 'The far water walls must be visible from inside the harbour');
for (const [origin, direction] of [
  [[-13, -.7, -11], [0, 0, -1]],
  [[11, -.7, 13], [1, 0, 0]],
]) {
  const ray = new T.Raycaster(new T.Vector3(...origin), new T.Vector3(...direction), 0, 2);
  assert.ok(ray.intersectObject(wall).length, 'Each exposed rear water edge has an inward-facing wall');
}
console.log('Harbour edges: both far cutaway walls cover the water boundary from inside.');
