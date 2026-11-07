import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// There is no horizon in this view: the camera is orthographic and looks down on the
// island, so a sky cannot be painted as a backdrop behind it — anything drawn behind
// the island is water. The sky therefore has to be made of things that live in it.
//
// A handful of low, soft clouds drift over the district, kept high enough to clear
// every roof on their longest reach. They cast shadows, and that is what carries the
// height: in this projection a shadow on the island or the sea is the only thing that
// can say "up there" about an object with nothing beneath it.
export function addSky({ root, m }) {
  // One merged blob, shared by every cloud, so the whole sky costs a single batch:
  // the puffs are laid out once here and the variety comes from scale and heading.
  const puffs = [
    [1.00, .70, .92, 0, 0, 0],
    [.76, .58, .72, -.86, .05, .10],
    [.68, .50, .64, .88, .02, -.08],
    [.54, .42, .52, .30, .21, .25],
    [.48, .36, .46, -.44, .17, -.22],
    [.40, .30, .38, 1.44, -.04, .06],
    [.34, .26, .32, -1.42, -.02, -.05],
  ];
  const geometry = mergeGeometries(puffs.map(([sx, sy, sz, x, y, z]) =>
    new T.SphereGeometry(1, 12, 8).scale(sx, sy, sz).translate(x, y, z)), false);

  const group = new T.Group(); group.name = 'Drifting clouds'; root.add(group);
  // x, height, z, scale, drift. The wind is one slow easterly for all of them and only
  // the speed differs, so they spread apart over time rather than moving as a block.
  // The height band starts well above the tallest roof and stops short of the top of
  // the frame, so they sit in the sky without leaving it.
  const CLOUDS = [
    [-8.00, 11.60, -5.50, 1.05, .115],
    [-1.50, 13.40, -9.50, 1.25, .085],
    [4.50, 10.40, -3.00, .85, .140],
    [9.00, 12.20, 1.50, 1.10, .070],
    [-12.00, 10.60, 3.00, .95, .160],
    [.50, 14.40, 6.50, 1.15, .100],
    [-6.00, 12.00, 10.50, .90, .190],
  ];
  const WEST = -17, EAST = 13;
  const clouds = CLOUDS.map(([x, y, z, scale, drift], i) => {
    const cloud = new T.Mesh(geometry, m.cloud);
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    cloud.rotation.y = i * .7;
    cloud.castShadow = true;
    cloud.receiveShadow = false;
    group.add(cloud);
    return { cloud, drift, baseY: y, phase: i * 1.3 };
  });

  function animate(time, dt = .016) {
    for (const { cloud, drift, baseY, phase } of clouds) {
      cloud.position.x += drift * dt;
      if (cloud.position.x > EAST) cloud.position.x = WEST;
      cloud.position.y = baseY + Math.sin(time * .11 + phase) * .24;
    }
  }

  return { animate, clouds: clouds.length };
}
