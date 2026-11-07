import * as T from 'three';
import { CITY_LAYOUT as site } from './layout.mjs';
import { surfaceGrain } from './surfaces.mjs';

// A narrow neon infill squeezed into the back row. Two stacked shells carry a
// lit arcade beneath a dense service roof, so the block reads as a sliver of
// signage, conduit, and ducting wedged between the studio and the east kerb.
export const ARCADE_WIDTH = 1.50;
export const ARCADE_DEPTH = 2.20;

export function buildArcade({ mesh, staticRoot, box, cyl, sphere, rod, tube, torus, material, m, assets, group, shell, plate, serviceUnit, drainpipe, planter, place }) {
  const ink = surfaceGrain(material('#fdf9ff', { metalness: .06, roughness: .58 }), .008, 4);
  const W = ARCADE_WIDTH, D = ARCADE_DEPTH;
  const arcade = group(...site.arcade);
  arcade.name = 'Voltage arcade';

  // Ground floor: one wide shopfront, a side door, and a small service hatch.
  shell(W, D, 1.74, .02, ink, arcade, {
    front: [{ width: 1.04, height: 1.14, x: 0, y: .20, type: 'arcade', depth: .66, mullions: 'none' }],
    right: [
      { width: .84, height: .92, x: -.04, y: .22, type: 'records', depth: .44 },
      { width: .62, height: .32, x: .04, y: 1.40, type: 'study', depth: .32, mullions: 'none', lit: false },
    ],
    left: [{ width: .60, height: 1.42, x: 0, y: .14, type: 'door', depth: .34, mullions: 'none' }],
  });
  plate(W + .10, D + .10, .03, .10, 0, m.rose, arcade);
  plate(W + .05, D + .05, .02, .06, 1.80, m.rose, arcade);

  // The upper floor steps back and in, so the silhouette reads as two volumes.
  const upper = new T.Group(); upper.position.set(0, 1.86, -.05); arcade.add(upper);
  shell(W - .16, D - .16, 1.66, .02, ink, upper, {
    front: [{ width: .74, height: 1.04, x: -.14, y: .28, type: 'lounge', depth: .50, mullions: 'cross' }],
    right: [{ width: .66, height: .62, x: 0, y: .40, type: 'studio', depth: .38 }],
  });
  plate(W - .14, D - .14, .02, .07, 1.66, m.metal, upper);

  // Service roof: cistern, condenser, dish, and a mast carrying the beacon.
  cyl(.26, .42, m.rail, -.26, 1.94, .34, upper, .23, 16);
  for (const dx of [-.15, .15]) for (const dz of [-.15, .15]) rod([-.26 + dx, 1.73, .34 + dz], [-.26 + dx, 1.83, .34 + dz], .011, m.rail, upper);
  serviceUnit(upper, .26, 1.73, -.30);
  const dish = cyl(.25, .045, m.rail, -.30, 2.02, -.62, upper, .25, 24); dish.rotation.x = -.62;
  const rim = torus(.25, .014, m.metal, -.30, 2.02, -.62, upper); rim.rotation.x = -.62;
  rod([-.30, 2.02, -.62], [-.42, 2.26, -.50], .012, m.metal, upper);
  cyl(.013, 1.16, m.rail, .34, 2.30, .60, upper);
  for (const y of [2.50, 2.70]) rod([.22, y, .60], [.46, y, .60], .009, m.rail, upper);
  box(.08, .18, .042, m.metal, .44, 2.42, .60, upper, .008);
  cyl(.008, .84, m.rail, -.46, 2.18, -.32, upper);
  sphere(.028, .029, .028, m.pink, .34, 2.90, .60, upper).castShadow = false;
  sphere(.020, .021, .020, m.teal, -.46, 2.62, -.32, upper).castShadow = false;

  // Conduit, clamps, and a rolled shutter dress the street-facing east wall.
  tube([[.80, -1.78, .72], [.80, -.60, .72], [.80, .40, .72], [.80, 1.30, .54]], .022, m.rail, upper, 20);
  for (const y of [-1.38, -.78, .12, .68]) box(.062, .03, .05, m.metal, .79, y, .72, upper, .006);
  for (let i = 0; i < 9; i++) box(.014, .052, .42, m.metal, .757, .42 + i * .056, .82, arcade, .003);
  box(.05, .10, .46, m.metal, .75, .95, .82, arcade, .008);
  box(.04, .34, .10, m.dark, .75, .60, .56, arcade, .012);

  // A maintenance ladder climbs the quiet west wall, facing the studio.
  for (const z of [-.70, -.46]) rod([-.79, .30, z], [-.79, 1.80, z], .012, m.metal, arcade);
  for (let i = 0; i < 8; i++) rod([-.79, .44 + i * .18, -.70], [-.79, .44 + i * .18, -.46], .009, m.rail, arcade);

  drainpipe(.44, 3.34, 1.14, arcade);
  planter(.13, arcade, -.44, .14, 1.00);

  const selection = place('Voltage arcade', 'A sliver of neon wedged between the studio and the street. Coin-op cabinets burn behind the shopfront, conduit and a rolled shutter climb the street wall, and a cistern, dish, and beacon crowd the service roof.', ...site.arcade, 1.10, 4.30);
  selection.userData.focusZoom = 2.6;
  return { building: { name: 'Voltage arcade', design: 'stacked neon arcade', group: arcade }, selection };
}
