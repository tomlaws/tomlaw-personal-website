import * as T from 'three';
import { CITY_LAYOUT as site, CITY_BOUNDS as bounds } from './layout.mjs';
import { surfaceGrain } from './surfaces.mjs';

// All walking surfaces share one level, slab scale, and crossing alignment.
export const WALK_Y = .052;
const ROAD_Y = .023;
const FRONT = { center: .20, low: -.48, high: .88 };
const EAST = { center: 3.22, low: 2.54, high: 3.90 };

export function buildPedestrianWays({ mesh, box, cyl, flatShape, material, m, staticRoot }) {
  // One paving across every walking surface, in the island's own pale concrete, so the
  // footways and the ground beneath them read as a single surface. The three zones had only
  // ever differed by a shade, so they share this one material — which retires two draw calls
  // rather than leaving three identical ones in the batch. It is a touch smoother than the
  // ground itself, these being laid slabs rather than poured concrete, and the viaduct deck
  // keeps the near-white so the structure still reads brighter than what it stands over.
  const paving = surfaceGrain(material('#dcd9d5', { roughness: .55, metalness: .04 }), .005, 3);
  const plaza = paving, terrace = paving;
  const joint = material('#b5b8bc');
  const west = bounds.minX + .20;
  const tactile = material('#f4d6d0');
  function polygon(points, close = true) {
    const shape = new T.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    if (close) shape.closePath();
    return shape;
  }
  function rectangle(x0, z0, x1, z1) {
    return polygon([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  }
  function surface(shape, mat, name) {
    const object = flatShape(shape, mat, WALK_Y);
    object.name = name;
    return object;
  }
  function face(points, mat, name) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    geo.computeVertexNormals();
    // Keep all sloping paving and curb faces pointed upward.
    if (geo.attributes.normal.getY(0) < 0) { geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); }
    const object = mesh(geo, mat); object.name = name;
    return object;
  }

  // A single paved forecourt reaches every shop, garden, and the street edge.
  // Crossing recesses are cut into its outline, so ramps never overlap a slab.
  const inner = polygon([
    [west, site.streetNorth], [west, 4.6775],
    [FRONT.low, 4.6775], [FRONT.low, 4.3425], [FRONT.high, 4.3425], [FRONT.high, 4.6775],
    [5.25, 4.6775],
  ], false);
  // Continue the outline after the front edge with the rounded street corner.
  inner.absarc(5.25, -4.37, .3075, -Math.PI / 2, 0, false);
  inner.lineTo(5.5575, -EAST.high); inner.lineTo(5.2225, -EAST.high);
  inner.lineTo(5.2225, -EAST.low); inner.lineTo(5.5575, -EAST.low);
  inner.lineTo(5.5575, -site.streetNorth); inner.closePath();
  const zones = [
    { area: site.courtyard, mat: plaza, name: 'Flush water-court paving' },
    { area: site.terrace, mat: terrace, name: 'Cafe terrace paving' },
    { area: site.marketPad, mat: plaza, name: 'Market stall paving' },
  ];
  // Each insert replaces the shared paving instead of overlapping it.
  for (const { area, mat, name } of zones) {
    const { x, z, width, depth } = area, shape = rectangle(x - width / 2, z - depth / 2, x + width / 2, z + depth / 2);
    inner.holes.push(shape); surface(shape, mat, name);
  }
  surface(inner, paving, 'Continuous pedestrian forecourt');

  surface(polygon([
    [west, 6.6825], [FRONT.low, 6.6825], [FRONT.low, 7.06], [FRONT.high, 7.06],
    [FRONT.high, 6.6825], [7.80, 6.6825], [7.80, 7.80], [west, 7.80],
  ]), paving, 'Bus-stop sidewalk');
  surface(polygon([
    [7.2025, site.streetNorth], [7.80, site.streetNorth], [7.80, 4.6775], [7.2025, 4.6775],
    [7.2025, EAST.high], [7.58, EAST.high], [7.58, EAST.low], [7.2025, EAST.low],
  ]), paving, 'Eastern sidewalk');

  // Quiet, regularly coursed joints: large slabs, with the same dimensions on
  // every route. The forecourts remain open; no raised outline boxes in the plaza.
  const exclusions = [
    ...site.gardens.map(({ x, z, width, depth }) => [x - width / 2 - .03, z - depth / 2 - .03, x + width / 2 + .03, z + depth / 2 + .03]),
    [FRONT.low, 4.3425, FRONT.high, 4.80], [FRONT.low, 6.60, FRONT.high, 7.06],
    [5.2225, EAST.low, 5.70, EAST.high], [7.10, EAST.low, 7.58, EAST.high],
  ];
  function seam(x0, z0, x1, z1) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    let intervals = [[alongX ? x0 : z0, alongX ? x1 : z1]];
    for (const [a, b, c, d] of exclusions) {
      if (alongX ? z0 < b || z0 > d : x0 < a || x0 > c) continue;
      const lo = alongX ? a : b, hi = alongX ? c : d;
      intervals = intervals.flatMap(([l, r]) => hi <= l || lo >= r ? [[l, r]] : [[l, Math.min(r, lo)], [Math.max(l, hi), r]].filter(([s, e]) => e - s > .025));
    }
    for (const [a, b] of intervals) {
      if (b - a < .025) continue;
      const obj = box(alongX ? b - a : .006, .001, alongX ? .006 : b - a, joint, alongX ? (a + b) / 2 : x0, WALK_Y + .0005, alongX ? z0 : (a + b) / 2, staticRoot, 0);
      obj.castShadow = false;
    }
  }
  function coursed(x0, z0, x1, z1, alongX = true) {
    const start = alongX ? z0 : x0, end = alongX ? z1 : x1;
    const rows = Math.max(1, Math.round((end - start) / .58));
    for (let row = 0; row < rows; row++) {
      const a = start + (end - start) * row / rows, b = start + (end - start) * (row + 1) / rows;
      if (row) alongX ? seam(x0, a, x1, a) : seam(a, z0, a, z1);
      const lo = alongX ? x0 : z0, hi = alongX ? x1 : z1;
      for (let t = Math.ceil((lo - (row % 2) * .60) / 1.20) * 1.20 + (row % 2) * .60; t < hi - .12; t += 1.20) {
        if (t < lo + .12) continue;
        alongX ? seam(t, a, t, b) : seam(a, t, b, t);
      }
    }
  }
  // Two continuous promenades and three north–south links organize the block.
  coursed(west + .02, 2.60, 5.18, 3.65);
  coursed(west + .02, -2.45, 5.45, -1.30);
  coursed(-10.25, -1.30, -8.65, 2.60, false);
  coursed(-4.15, -1.30, -2.80, 2.60, false);
  coursed(2.00, -1.30, 3.08, 2.60, false);
  coursed(west + .02, 6.71, 7.78, 7.78);
  coursed(7.23, site.streetNorth + .02, 7.78, 4.65, false);
  coursed(FRONT.low, 3.65, FRONT.high, 4.34, false);
  coursed(west + .02, -9.45, 5.45, -8.95);
  coursed(-7.0, -6.12, 3.0, -5.35);
  // Destination paving shares the same alignment with slightly larger slabs.
  for (const { area } of zones) {
    const { x, z, width: w, depth: d } = area;
    for (let zz = z - d / 2 + .80; zz < z + d / 2 - .1; zz += .80)seam(x - w / 2, zz, x + w / 2, zz);
    for (let xx = x - w / 2 + 1.30; xx < x + w / 2 - .1; xx += 1.30)seam(xx, z - d / 2, xx, z + d / 2);
  }

  // Curbs taper down at each crossing instead of continuing through the ramp.
  function curb(axis, fixed, start, end, openings = []) {
    let p = start;
    const point = (t, y) => axis === 'x' ? [t, y, fixed] : [fixed, y, t];
    function strip(a, b, ya = .069, yb = .069) {
      if (b <= a) return;
      const A = point(a, ya), B = point(b, yb), offset = axis === 'x' ? 2 : 0;
      const a0 = [...A], a1 = [...A], b0 = [...B], b1 = [...B];
      a0[offset] -= .0425; a1[offset] += .0425; b0[offset] -= .0425; b1[offset] += .0425;
      face([a0, b0, b1, a1], m.curb, 'Dressed stone curb');
      // Exposed curb face provides real contact depth against the asphalt.
      for (const sign of [-1, 1]) {
        const lowA = point(a, .003), lowB = point(b, .003), topA = [...A], topB = [...B];
        for (const v of [lowA, lowB, topA, topB]) v[offset] += sign * .0425;
        const points = [lowA, lowB, topB, topA];
        if (sign === (axis === 'x' ? 1 : -1)) points.reverse();
        face(points, m.curb, 'Curb riser');
      }
    }
    for (const [a, b] of openings) { strip(p, a - .17); strip(a - .17, a, .069, ROAD_Y); strip(b, b + .17, ROAD_Y, .069); p = b + .17; }
    strip(p, end);
  }
  curb('x', 4.72, west, 5.25, [[FRONT.low, FRONT.high]]);
  curb('z', 5.60, site.streetNorth, 4.37, [[EAST.low, EAST.high]]);
  curb('x', 6.64, west, 7.80, [[FRONT.low, FRONT.high]]);
  curb('z', 7.16, site.streetNorth, 4.72, [[EAST.low, EAST.high]]);
  const corner = new T.Shape();
  corner.absarc(5.25, -4.37, .3925, -Math.PI / 2, 0, false);
  corner.lineTo(5.5575, -4.37); corner.absarc(5.25, -4.37, .3075, 0, -Math.PI / 2, true); corner.closePath();
  mesh(new T.ExtrudeGeometry(corner, { depth: .066, bevelEnabled: false, curveSegments: 16 }), m.curb, 0, .003, 0).rotation.x = -Math.PI / 2;

  function ramp(axis, center, edge, inward) {
    const width = .68, depth = .42;
    const point = (u, v, y) => axis === 'z' ? [center + u, y, edge + v * inward] : [edge + v * inward, y, center + u];
    face([point(-width, 0, ROAD_Y), point(width, 0, ROAD_Y), point(width, depth, WALK_Y), point(-width, depth, WALK_Y)], paving, 'Dropped pedestrian crossing');
    const at = .29, y = ROAD_Y + (WALK_Y - ROAD_Y) * at / depth;
    const p = point(0, at, y + .002);
    box(axis === 'z' ? 1.18 : .16, .003, axis === 'z' ? .16 : 1.18, tactile, ...p, staticRoot, .005);
    for (let i = 0; i < 12; i++)for (let j = 0; j < 2; j++) {
      const v = at - .041 + j * .082, pos = point(-.55 + i * .10, v, ROAD_Y + (WALK_Y - ROAD_Y) * v / depth + .007);
      cyl(.009, .006, tactile, ...pos, staticRoot, .009, 8);
    }
  }
  ramp('z', FRONT.center, 4.7625, -1); ramp('z', FRONT.center, 6.64, 1);
  ramp('x', EAST.center, 5.6425, -1); ramp('x', EAST.center, 7.16, 1);
  for (let i = 0; i < 7; i++) {
    box(.095, .008, 1.54, m.marking, FRONT.center - .57 + i * .19, .028, 5.70, staticRoot, .002);
    box(1.20, .008, .095, m.marking, 6.40, .028, EAST.center - .57 + i * .19, staticRoot, .002);
  }
  // Leave the crossing approaches free of unrelated lane dashes.
  for (let x = bounds.minX + .70; x < bounds.maxX - .50; x += 1.16) {
    if (x > FRONT.low - .20 && x < FRONT.high + .20) continue;
    box(.30, .008, .018, m.marking, x, .026, 5.70, staticRoot, 0);
  }
  for (let z = site.streetNorth + .60; z < 4.40; z += 1.10) {
    if (z > EAST.low - .20 && z < EAST.high + .20) continue;
    box(.018, .008, .30, m.marking, 6.40, .026, z, staticRoot, 0);
  }
}
