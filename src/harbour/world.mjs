import * as T from 'three';
import { CITY_LAYOUT as site, CITY_BOUNDS as bounds } from './layout.mjs';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createWindowSystem } from './interiors.mjs';
import { buildArchitecture } from './architecture.mjs';
import { addStreetDetails, signalState } from './street-details.mjs';
import { surfaceGrain } from './surfaces.mjs';
import { buildPedestrianWays, WALK_Y } from './pedestrian.mjs';
import { addCyberpunkDetails, addNeonDistrict, letteringGeometry } from './cyberpunk.mjs';
import { addCitySystems } from './city-systems.mjs';
import { buildElevatedRail } from './rail.mjs';
import { addSky } from './sky.mjs';

// Coordinates are model units. The beveled street block occupies 20 × 19, with open space between landmarks.
export const WORLD_SIZE = site.size;
export const WALKER_COUNT = 0;
export const RESIDENT_COUNT = 0;
export function createWorld({ assets = null } = {}) {
  const root = new T.Group(); root.name = 'Lantern Quarter';
  const staticRoot = new T.Group(); root.add(staticRoot);
  const placements = [];
  const places = [], leaves = [], lanterns = [], walkers = [], cyclists = [], cars = [], birds = [], steam = [], ripples = [];
  let seed = 12037;
  const rand = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const range = (a, b) => a + (b - a) * rand();
  const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .85, metalness: .02, ...extra });
  const m = {
    base: material('#c4c8cd'), ground: material('#dcd9d5', { roughness: .62, metalness: .03 }), stone: material('#d0cfca'), curb: material('#bfbfbb'),
    asphalt: new T.MeshPhysicalMaterial({ color: '#b4b6b8', roughness: .40, metalness: .06, clearcoat: .45, clearcoatRoughness: .28 }), marking: material('#fffdf6'), cream: material('#f4e9c8'),
    peach: material('#ffbc85'), rose: material('#ff9cc3'), blue: material('#93c3f8'), sage: material('#90e5b3'),
    roof: material('#ffeac8'), copper: material('#f0b276', { metalness: .25, roughness: .5 }),
    metal: material('#dae4f8', { metalness: .08, roughness: .52 }), rail: material('#dbe6f6', { metalness: .12, roughness: .46 }),
    wood: material('#f2c894'), woodDark: material('#d9b184'), trunk: material('#ddc7ab'), soil: material('#b4ab9e'),
    leaf: material('#8adb8a'), leafLight: material('#b9e88a'), leafDark: material('#79d0a0'),
    glass: material('#d8ecfa', { metalness: .18, roughness: .18 }), dark: material('#d2d8ea'),
    warm: material('#fff0c4', { emissive: '#ffcf8a', emissiveIntensity: .34 }),
    teal: material('#b0efe3', { emissive: '#5fd7e0', emissiveIntensity: .38 }),
    pink: material('#ffa2cc', { emissive: '#f79ac8', emissiveIntensity: .34 }),
    water: material('#9fd8f5', { roughness: .09, metalness: .25, transparent: true, opacity: .88 }),
    // The two halves of the sea, deliberately far apart in value: the lower half the
    // deeper blue, so the block still reads as depth, and the upper half a light pastel
    // one. seaShell carries a per-vertex alpha, so the wall of the upper half stays fully
    // opaque — every side of the block is a plain colour — while the pane it holds at the
    // waterline is the one see-through surface in the whole block.
    sea: material('#63a9ef', { roughness: .48, metalness: .05 }),
    seaShell: material('#9ad7ff', { transparent: true, vertexColors: true, roughness: .34, metalness: .10 }),
    // Clouds are pitched a shade paler than the sea so the two still separate.
    cloud: material('#f2f7fe', { roughness: .9, metalness: 0 }),
    tire: material('#c4c9da'), white: material('#fffefa'), coral: material('#ffa189'), yellow: material('#ffd06f'),
  };
  for (const name of ['ground', 'stone', 'curb']) surfaceGrain(m[name], .007, 3);
  surfaceGrain(m.asphalt, .008, 10);
  const boxCache = new Map(), sphereGeo = new T.SphereGeometry(1, 12, 9), cylinderCache = new Map();
  const vec = p => new T.Vector3(...p);
  function mesh(geo, mat, x = 0, y = 0, z = 0, parent = staticRoot) {
    const obj = new T.Mesh(geo, mat); obj.position.set(x, y, z); obj.castShadow = true; obj.receiveShadow = true; parent.add(obj); return obj;
  }
  function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = staticRoot, radius = .012) {
    radius = Math.min(radius, w / 3, h / 3, d / 3);
    const key = [w, h, d, radius].join(',');
    if (!boxCache.has(key)) boxCache.set(key, radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, radius) : new T.BoxGeometry(w, h, d));
    return mesh(boxCache.get(key), mat, x, y, z, parent);
  }
  function sphere(rx, ry, rz, mat, x, y, z, parent = staticRoot) { const obj = mesh(sphereGeo, mat, x, y, z, parent); obj.scale.set(rx, ry, rz); return obj; }
  function cyl(r, h, mat, x, y, z, parent = staticRoot, top = r, sides = 20) {
    const key = `${top / r},${sides}`;
    if (!cylinderCache.has(key)) cylinderCache.set(key, new T.CylinderGeometry(top / r, 1, 1, sides));
    const obj = mesh(cylinderCache.get(key), mat, x, y, z, parent); obj.scale.set(r, h, r); return obj;
  }
  function tube(points, r, mat, parent = staticRoot, segments = 20) {
    return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vec)), segments, r, 6, false), mat, 0, 0, 0, parent);
  }
  function rod(a, b, r, mat, parent = staticRoot) {
    const start = vec(a), end = vec(b), delta = end.clone().sub(start);
    const o = cyl(r, delta.length(), mat, ...start.clone().add(end).multiplyScalar(.5).toArray(), parent, r, 8);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return o;
  }
  function torus(radius, thickness, mat, x, y, z, parent = staticRoot) { return mesh(new T.TorusGeometry(radius, thickness, 6, 32), mat, x, y, z, parent); }
  function roundedShape(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  function flatShape(shape, mat, y, parent = staticRoot) { const o = mesh(new T.ShapeGeometry(shape, 24), mat, 0, y, 0, parent); o.rotation.x = -Math.PI / 2; return o; }
  function disk(r, mat, x, y, z, sx = 1, sz = 1, parent = staticRoot) {
    const o = mesh(new T.CircleGeometry(r, 40), mat, x, y, z, parent); o.rotation.x = -Math.PI / 2; o.scale.set(sx, sz, 1); return o;
  }
  function place(name, note, x, z, radius, height) {
    const hit = new T.Mesh(new T.CylinderGeometry(radius, radius, height, 16), new T.MeshBasicMaterial({ visible: false }));
    hit.position.set(x, height / 2, z); hit.userData = { name, note, position: new T.Vector3(x, height, z) }; root.add(hit); places.push(hit); return hit;
  }
  const signInks = new Map();
  function sign(text, width, x, y, z, parent = staticRoot, color = '#c4ecf2') {
    box(width + .1, .32, .09, m.dark, x, y, z, parent);
    if (!signInks.has(color)) signInks.set(color, material(color, { emissive: color, emissiveIntensity: 1.35, roughness: .35 }));
    const letters = mesh(letteringGeometry(text, width, .20), signInks.get(color), x, y, z + .048, parent);
    letters.castShadow = false;
  }
  function lamp(x, z, height = 1.55) {
    const g = new T.Group(); g.position.set(x, 0, z); staticRoot.add(g); x = 0; z = 0;
    cyl(.025, height, m.metal, x, height / 2, z, g); cyl(.08, .08, m.metal, x, .08, z, g);
    const cap = sphere(.13, .09, .13, m.warm, x, height, z, g); cap.castShadow = false;
    cyl(.14, .04, m.metal, x, height + .07, z, g); cyl(.07, .07, m.metal, x, height + .12, z, g);
    rememberPlacement('Streetlight', g);
  }
  // Keep measured footprints before batching discards source groups. Overhead
  // canopies are excluded; posts, seats, pots and planted borders remain obstacles.
  function rememberPlacement(name, object) {
    if (!object) return object;
    object.updateWorldMatrix(true, true);
    const footprint = new T.Box3();
    object.traverse(part => {
      if (!part.isMesh) return;
      part.geometry.computeBoundingBox();
      const b = part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld);
      if (b.min.y < WALK_Y + .90) footprint.union(b);
    });
    if (!footprint.isEmpty()) placements.push({ name, x0: footprint.min.x, x1: footprint.max.x, z0: footprint.min.z, z1: footprint.max.z });
    return object;
  }
  const windowSystem = createWindowSystem({ mesh, box, cyl, sphere, material, materials: m });

  // The island stands on a wider platform of sea: the same rounded plan as the island's
  // own base, one step down and a good deal larger, so the map has a defined edge — the
  // plate ends, and the white beyond it is simply nothing. Its top face is sea level,
  // the plane the piers run down to, and it takes the shadow the island and the clouds
  // drop on the water, which is what a separate shadow plane used to fake.
  //
  // It is neither centred on the island nor square. A raised deck is drawn up-screen of
  // its own footprint in an isometric view — the elevated line projects 1.03 units
  // north-west for every unit of height, so its top level lands 7.6 units outside where
  // it stands — and the platform has to hold that too, or the viaduct reads as hanging
  // off the edge of the world. Hence the generous margin to the north-west and the
  // tighter one along the island's own south and east coasts.
  const SEA = { minX: -23, maxX: 12.5, minZ: -25.5, maxZ: 11 };
  // The waterline, and the thickness of the block of water below it. The block is built
  // as two stacked plates so its upper half can be translucent and its lower half solid:
  // the island's foundation and the foot of each pier show through the top layer, while
  // the bottom layer keeps the block reading as deep water rather than a glass tank. The
  // waterline sits below the paving by the island's freeboard — the band of shore the eye
  // reads as land at all — and that is what puts the foundation under the surface where the
  // transparency has something to show.
  // The sea is a block of water, built in four pieces: a solid lower half in a deep
  // saturated blue, a solid pastel shell for the upper half, a liner of that same deep
  // blue just inside the shell, and a translucent pane at the waterline capping the well
  // between them. An outer face cannot be both solid and see-through, so the transparency
  // is confined to the one surface that needs it — the top — and every side of the block
  // reads as a plain, solid colour. The liner is what the eye sees down inside the well,
  // so the water's own cut face is deep blue rather than the pastel of the shell.
  // The freeboard is the whole of the island's visible shore. At a fifth of a unit the
  // paving all but met the water and the land read as half sunk in it, so the level drops
  // to leave a shore with some relief to it. The layer keeps its full height: the block
  // reaches further down for the difference rather than losing any of its depth.
  const SEA_FREEBOARD = 1.30;
  const SEA_LEVEL = -SEA_FREEBOARD, SEA_LAYER = 3.00, SEA_WALL = .13, SEA_LINER = .04;
  const seaWidth = SEA.maxX - SEA.minX, seaDepth = SEA.maxZ - SEA.minZ;
  const seaX = (SEA.minX + SEA.maxX) / 2, seaZ = (SEA.minZ + SEA.maxZ) / 2;
  // The block's plan outline, inset by `w`. Every piece of the block is cut from this.
  const seaPlan = w => roundedShape(seaWidth - w * 2, seaDepth - w * 2, .07);
  // A plate spanning `thickness` down from `top`, or a ring of one when a hole is given.
  function seaPiece(top, thickness, mat, inset, ring = 0) {
    const shape = seaPlan(inset);
    if (ring) shape.holes.push(seaPlan(inset + ring));
    const piece = mesh(new T.ExtrudeGeometry(shape, { depth: thickness - .06, steps: 1, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2, curveSegments: 3 }), mat, seaX, top - thickness + .03, seaZ);
    piece.rotation.x = -Math.PI / 2;
    return piece;
  }
  seaPiece(SEA_LEVEL - SEA_LAYER, SEA_LAYER, m.sea, 0).name = 'Sea depth';
  // The upper half is a ring of solid pastel wall around the well, capped by a pane of the
  // same colour at the waterline. The two are one mesh carrying a per-vertex alpha — the
  // wall and its coping fully opaque, the pane inside them see-through — because an outer
  // face cannot be both solid and see-through, and splitting the piece in two would cost a
  // second draw call for a surface the eye reads as one object.
  function withAlpha(geometry, alpha) {
    const count = geometry.attributes.position.count, tint = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { tint[i * 4] = 1; tint[i * 4 + 1] = 1; tint[i * 4 + 2] = 1; tint[i * 4 + 3] = alpha; }
    geometry.setAttribute('color', new T.BufferAttribute(tint, 4));
    return geometry;
  }
  // The shell stops a centimetre short of the deep half below it, so that no two faces of
  // the block end up coplanar.
  const shellDepth = SEA_LAYER - .07;
  const shellShape = seaPlan(0); shellShape.holes.push(seaPlan(SEA_WALL));
  const shellWall = new T.ExtrudeGeometry(shellShape, { depth: shellDepth, steps: 1, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2, curveSegments: 3 });
  const shellPane = new T.ShapeGeometry(seaPlan(0), 24).translate(0, 0, shellDepth).toNonIndexed();
  const shell = mesh(mergeGeometries([withAlpha(shellWall, 1), withAlpha(shellPane, .45)], false), m.seaShell, seaX, SEA_LEVEL - (SEA_LAYER - .01) + .03, seaZ);
  shell.rotation.x = -Math.PI / 2; shell.name = 'Sea surface';
  // The liner reaches past both ends: up to the rim, so no pastel shows inside the well,
  // and down into the deep half, so the joint between the two halves is buried.
  seaPiece(SEA_LEVEL, SEA_LAYER + .10, m.sea, SEA_WALL + .005, SEA_LINER).name = 'Sea lining';

  // The bedding line the piers reach down to: the floor of that well.
  const SEA_FLOOR = SEA_LEVEL - SEA_LAYER;

  // The island's own base, cut deep so the land runs down into the water rather than
  // floating in it: it reaches from the paving to just past the sea's floor, so the land's
  // cut face stands visible through the well all the way down to the bottom.
  // The island is its own pale concrete — the slab and the paving laid over it — and it is
  // warm and light deliberately. Two earlier attempts failed in opposite directions: a neutral
  // mid grey read as dirt against pastel blues and creams, and a blue-cast grey read as cold
  // stone rather than as concrete. Light, warm and barely tinted is what sits between them.
  // This is m.ground, already carried by static geometry, so it costs no draw calls.
  const landFoot = SEA_FLOOR - .10;
  const base = mesh(new T.ExtrudeGeometry(roundedShape(site.width - .10, site.depth - .10, .07), { depth: (0 - landFoot) - .10, steps: 1, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 2, curveSegments: 3 }), m.ground, site.center[0], landFoot + .05, site.center[1]);
  base.rotation.x = -Math.PI / 2; base.name = `${site.width} × ${site.depth} island`;
  const ground = flatShape(roundedShape(site.width - .12, site.depth - .12, .09), m.ground, .001); ground.position.x = site.center[0]; ground.position.z = site.center[1];
  // A modest curb return gives the street corner a realistic turning radius.
  // One continuous road surface prevents overlapping asphalt at the junction.
  const road = new T.Shape();
  road.moveTo(bounds.minX + .06, -4.7625); road.lineTo(5.25, -4.7625);
  road.absarc(5.25, -4.37, .3925, -Math.PI / 2, 0, false);
  road.lineTo(5.6425, -site.streetNorth); road.lineTo(7.16, -site.streetNorth); road.lineTo(7.16, -4.76);
  road.lineTo(7.94, -4.76); road.lineTo(7.94, -6.64); road.lineTo(bounds.minX + .06, -6.64); road.closePath();
  flatShape(road, m.asphalt, .021);
  buildPedestrianWays({ mesh, box, cyl, flatShape, material, m, staticRoot });
  // Landscape borders define each room; foliage is planted into these beds.
  for (const bed of site.gardens) {
    const { x, z, width: w, depth: d } = bed;
    const g = new T.Group(); g.position.set(x, 0, z); staticRoot.add(g);
    box(w, .065, d, m.soil, 0, .047, 0, g, .01);
    for (const xx of [-w / 2, w / 2]) box(.045, .09, d + .045, m.stone, xx, .06, 0, g, .005);
    for (const zz of [-d / 2, d / 2]) box(w, .09, .045, m.stone, 0, .06, zz, g, .005);
    const count = Math.floor(d / .42);
    for (let i = 0; i < count; i++) {
      const zz = -d / 2 + .23 + i * (d - .46) / (count - 1);
      sphere(w * .39, .10, w * .40, i % 2 ? m.leaf : m.leafDark, 0, .16, zz, g);
      if (w > .8) for (const side of [-1, 1]) sphere(.13, .085, .13, m.leafLight, side * .28, .15, zz, g);
    }
    rememberPlacement(bed.name, g);
  }

  function planter(radius, parent, x, y, z) {
    if (assets) return assets.place('terracotta-planter', parent, x, y, z, radius / .15);
    cyl(radius, .21, m.woodDark, x, y + .1, z, parent, radius * 1.12);
    cyl(radius * .98, .02, m.soil, x, y + .21, z, parent);
    for (let i = 0; i < 5; i++) { const a = i * 2.4; const o = sphere(.08, .2, .075, i % 2 ? m.leafLight : m.leaf, x + Math.cos(a) * radius * .45, y + .37, z + Math.sin(a) * radius * .45, parent); o.rotation.z = Math.cos(a) * .4; o.rotation.x = Math.sin(a) * .4; }
  }
  const architecture = buildArchitecture({ root, staticRoot, mesh, box, cyl, sphere, tube, rod, torus, roundedShape, sign, planter, place, windowSystem, material, m, assets });

  for (const building of architecture.buildings) rememberPlacement(building.name, building.group);

  // The tram runs behind a wider service lane, separate from the shop terraces.
  box(site.width - .6, .12, .52, m.base, site.center[0], .33, site.tramZ);
  for (const z of [site.tramZ - .15, site.tramZ + .15]) box(site.width - .6, .032, .025, m.rail, site.center[0], .41, z, staticRoot, 0);
  for (let x = bounds.minX + .57; x < bounds.maxX - .45; x += .33)box(.04, .023, .42, m.woodDark, x, .39, site.tramZ, staticRoot, 0);
  for (const x of [-11.4, -6.7, -2, 2.7, 7.4]) { cyl(.018, 2.1, m.metal, x, 1.1, site.tramZ - .53); rod([x, 2.1, site.tramZ - .53], [x, 2.1, site.tramZ + .31], .014, m.metal); }
  tube([[-11.4, 2.07, site.tramZ + .01], [-9.05, 1.98, site.tramZ + .01], [-6.7, 2.07, site.tramZ + .01], [-4.35, 1.98, site.tramZ + .01], [-2, 2.07, site.tramZ + .01], [.35, 1.98, site.tramZ + .01], [2.7, 2.07, site.tramZ + .01], [5.05, 1.98, site.tramZ + .01], [7.4, 2.07, site.tramZ + .01]], .007, m.metal, staticRoot, 56);
  const tram = new T.Group(); root.add(tram); tram.name = 'Late tram';
  box(2.12, .23, .46, m.sage, 0, .2, 0, tram, .09); box(2.15, .085, .48, m.cream, 0, .6, 0, tram, .04); box(2.0, .05, .49, m.copper, 0, .18, 0, tram, .02);
  for (const side of [-1, 1]) {
    const pane = box(1.98, .255, .012, windowSystem.glass, 0, .435, side * .233, tram, .01); pane.castShadow = false; pane.receiveShadow = false;
    for (let i = 0; i < 8; i++)box(.016, .29, .03, m.metal, -.96 + i * .274, .425, side * .238, tram, .005);
  }
  for (let i = 0; i < 6; i++) { box(.17, .06, .28, m.woodDark, -.74 + i * .29, .345, 0, tram, .025); box(.045, .18, .29, m.sage, -.82 + i * .29, .42, 0, tram, .018); }
  const windscreen = box(.013, .24, .34, windowSystem.glass, 1.046, .435, 0, tram, .008); windscreen.castShadow = false;
  for (const x of [-1.0, 1.0]) box(.038, .31, .042, m.metal, x, .41, .17, tram, .007);
  box(1.9, .011, .027, m.warm, 0, .551, 0, tram, .006);
  for (const x of [-.65, .65]) for (const z of [-.19, .19]) { const wheel = cyl(.1, .06, m.tire, x, .1, z, tram, .1, 12); wheel.rotation.x = Math.PI / 2; }
  rod([-.1, .67, 0], [.15, .98, 0], .012, m.metal, tram); rod([.15, .98, 0], [.45, .67, 0], .012, m.metal, tram); box(.2, .02, .03, m.metal, .15, .99, 0, tram);
  tram.position.set(-4.8, .43, site.tramZ);

  // A slim timber-and-steel coffee pavilion opens onto a straight terrace.
  const cafe = new T.Group(); cafe.position.set(site.cafe[0], 0, site.cafe[1]); staticRoot.add(cafe);
  box(2.20, .06, 1.87, m.stone, 0, .05, 0, cafe, .012);
  for (let i = 0; i < 11; i++)box(.009, .003, 1.81, m.woodDark, -1 + i * .2, .082, 0, cafe, 0);
  if (assets) assets.place('cafe-roof', cafe);
  else { box(2.24, .065, 1.90, m.roof, 0, 1.61, 0, cafe, .008); for (let i = 0; i < 11; i++)box(.055, .07, 1.8, m.wood, -1 + i * .2, 1.54, 0, cafe, .005); }
  for (const x of [-1.03, 1.03]) for (const z of [-.84, .84]) box(.045, 1.49, .045, m.metal, x, .81, z, cafe, .004);
  box(1.40, .07, .46, m.wood, 0, .75, -.30, cafe, .012); box(1.33, .62, .38, m.sage, 0, .40, -.30, cafe, .012);
  for (let i = 0; i < 12; i++)box(.018, .50, .012, m.wood, -.61 + i * .111, .41, -.101, cafe, .002);
  cyl(.09, .18, m.copper, -.32, .87, -.3, cafe); sphere(.08, .05, .08, m.cream, .28, .83, -.14, cafe);
  sign('MOON COFFEE', 1.15, 0, 1.39, .90, cafe);
  place('Moon coffee', 'Coffee under a glass-and-timber pergola. Straight slats cast shifting shadows across the counter and terrace.', ...site.cafe, 1.15, 1.8);
  rememberPlacement('Coffee pavilion', cafe);
  function table(x, z, umbrella = false) {
    const g = new T.Group(); g.position.set(x, 0, z); staticRoot.add(g);
    const tableName = `Cafe table at ${x}`; x = 0; z = 0;
    cyl(.027, .50, m.metal, x, .30, z, g); cyl(.17, .032, m.metal, x, .045, z, g);
    cyl(.31, .045, m.wood, x, .58, z, g, .31, 40);
    for (const a of [0, Math.PI / 2, Math.PI]) {
      const xx = x + Math.sin(a) * .49, zz = z + Math.cos(a) * .49;
      if (assets) assets.place('bistro-chair', g, xx, 0, zz, 1, a + Math.PI);
      else { cyl(.12, .045, m.cream, xx, .31, zz, g); for (const dx of [-.07, .07]) cyl(.015, .28, m.metal, xx + dx, .16, zz, g); }
    }
    cyl(.035, .07, m.cream, x - .09, .65, z, g); cyl(.029, .05, m.peach, x + .09, .64, z + .07, g);
    if (umbrella) { if (assets) assets.place('parasol', g, x, 0, z); else { cyl(.64, .21, m.cream, x, 1.425, z, g, .045, 32); cyl(.017, 1.4, m.metal, x, .72, z, g); } }
    rememberPlacement(tableName, g);
  }
  for (const t of site.tables) table(t.x, t.z, t.umbrella);
  // A rectangular reflecting pool with a narrow sheet of falling water.
  const fountain = new T.Group(); fountain.position.set(site.water[0], 0, site.water[1]); root.add(fountain);
  if (assets) { assets.place('fountain-bowl', fountain); assets.place('fountain-spout', fountain); }
  else {
    for (const z of [-.48, .48]) box(1.88, .20, .10, m.stone, 0, .16, z, fountain);
    for (const x of [-.88, .88]) box(.12, .20, .88, m.stone, x, .16, 0, fountain);
    box(1.17, .47, .09, m.copper, 0, .34, -.29, fountain);
  }
  const waterSurface = box(1.62, .012, .82, m.water, 0, .195, 0, fountain, .004); waterSurface.castShadow = false;
  const splashMat = new T.MeshBasicMaterial({ color: '#dcebe6', transparent: true, opacity: .22, depthWrite: false, side: T.DoubleSide });
  mesh(new T.PlaneGeometry(1.06, .34), splashMat, 0, .37, -.18, fountain).castShadow = false;
  for (let i = 0; i < 3; i++) { const ring = torus(.045, .005, splashMat.clone(), -.50 + i * .50, .205, -.02, fountain); ring.rotation.x = -Math.PI / 2; ring.castShadow = false; ripples.push(ring); }
  rememberPlacement('Reflecting pool', fountain);
  place('The water court', 'A long limestone pool anchors the rectangular courtyard. Two timber benches face the water from opposite sides, leaving a clear approach from the promenade.', ...site.water, 1.04, .85);
  // A pair of market stalls, soft fabric roofs and little piles of produce.
  function market(x, z, cloth, name, flowers = false) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = site.marketAngle; staticRoot.add(g);
    if (assets) assets.place('market-cart', g);
    else { box(1.06, .07, .61, m.wood, 0, .7, 0, g, .04); box(1, .52, .5, m.woodDark, 0, .41, 0, g); }
    for (const dx of [-.49, .49]) for (const dz of [-.28, .28]) cyl(.016, 1.2, m.woodDark, dx, .66, dz, g);
    if (assets) assets.place(flowers ? 'market-sage' : 'market-rose', g);
    else {
      const fabric = new T.PlaneGeometry(1.26, .91, 18, 12); fabric.rotateX(-Math.PI / 2);
      const positions = fabric.attributes.position;
      for (let i = 0; i < positions.count; i++) { const x = positions.getX(i), z = positions.getZ(i); positions.setY(i, 1.25 + .20 * Math.cos(x / .63 * Math.PI / 2) - .022 * Math.cos(z / .455 * Math.PI)); }
      fabric.computeVertexNormals(); const canvasMaterial = cloth.clone(); canvasMaterial.side = T.DoubleSide; canvasMaterial.shadowSide = T.DoubleSide; mesh(fabric, canvasMaterial, 0, 0, 0, g);
      for (let i = 0; i < 7; i++) { const valance = sphere(.087, .068, .022, i % 2 ? m.cream : cloth, -.53 + i * .177, 1.2, .48, g); valance.castShadow = false; }
    }
    for (let i = 0; i < 3; i++) { box(.27, .07, .35, m.woodDark, -.33 + i * .33, .78, 0, g); for (let j = 0; j < 7; j++) { const xx = -.42 + i * .33 + rand() * .2, zz = -.1 + rand() * .21; sphere(.04, .04, .04, flowers ? m.rose : [m.coral, m.yellow, m.sage][i], xx, .85 + rand() * .025, zz, g); if (flowers) rod([xx, .79, zz], [xx, .94, zz], .005, m.leafDark, g); } }
    rememberPlacement(name, g);
    sign(name.toUpperCase(), .9, 0, .46, .29, g); place(name, flowers ? 'Flowers for no particular occasion. Fresh stems, tiny pots, and a neighborhood cat who thinks this stall belongs to him.' : 'The last peaches of the day, stacked carefully beneath a striped canopy. Wooden crates and a softly lit counter line the square.', x, z, .7, 1.5);
  }
  market(...site.flowers, m.sage, 'Corner flowers', true); market(...site.market, m.peach, 'Night market');

  function tree({ x, z, height = 1.7, size = .63, flowering = false, inGarden = false }) {
    const g = new T.Group(); g.position.set(x, 0, z); root.add(g);
    if (assets) {
      if (!inGarden) rememberPlacement('Street tree bed', assets.place('garden-bed', g));
      const turn = rand() * Math.PI * 2;
      assets.place('tree-trunk', g, 0, 0, 0, [size / .63, height / 1.7, size / .63], turn);
      const canopy = assets.place(flowering ? 'blossom-crown' : 'tree-crown', g, 0, height, 0, [size / .63, size / .63 * (.9 + rand() * .2), size / .63], turn);
      leaves.push({ group: canopy, phase: rand() * 6 });
      return;
    }
    if (!inGarden && flowering) { cyl(.50, .19, m.stone, 0, .11, 0, g); disk(.44, m.soil, 0, .212, 0, 1, 1, g); }
    else if (!inGarden) { box(.84, .12, .70, m.stone, 0, .08, 0, g, .008); box(.70, .02, .57, m.soil, 0, .15, 0, g, .006); }
    tube([[0, .13, 0], [.04, .54, .02], [-.04, height * .63, -.02], [.05, height, .03]], .055, m.trunk, g, 16);
    rod([0, height * .55, 0], [-.27, height * .88, .08], .024, m.trunk, g); rod([.01, height * .61, .02], [.26, height * .94, -.07], .022, m.trunk, g);
    const canopy = new T.Group(); canopy.position.set(0, height, 0); g.add(canopy); leaves.push({ group: canopy, phase: rand() * 6 });
    for (let i = 0; i < 11; i++) { const a = i * 2.4, r = Math.sqrt(rand()) * size * .66; const o = sphere(size * range(.38, .65), size * range(.44, .7), size * range(.38, .65), [m.leaf, m.leafLight, m.leafDark][i % 3], Math.cos(a) * r, range(-.05, .37), Math.sin(a) * r, canopy); o.rotation.y = rand() * 6; }
    for (let i = 0; i < 5; i++) { const a = i * 2.4; sphere(.08, .07, .08, m.leafDark, Math.cos(a) * .36, .17, Math.sin(a) * .36, g); }
  }
  for (const spec of site.trees) tree(spec);
  for (const [x, z] of site.pots) rememberPlacement('Shop entrance pot', planter(.15, staticRoot, x, 0, z));
  // Seat fronts point along local +Z. Anchor each bench to a destination or edge,
  // and use the model's actual foot height so every seat rests on the paving.
  const benchY = WALK_Y - (assets ? new T.Box3().setFromObject(assets.templates.get('bentwood-bench')).min.y : .04);
  function bench(name, x, z, angle) {
    if (assets) { const seat = assets.place('bentwood-bench', staticRoot, x, benchY, z, 1, angle); seat.name = name; return rememberPlacement(name, seat); }
    const g = new T.Group(); g.name = name; g.position.set(x, benchY, z); g.rotation.y = angle; staticRoot.add(g);
    for (let i = 0; i < 4; i++)box(.86, .033, .055, m.wood, 0, .3, -.12 + i * .073, g, .012);
    for (const dx of [-.32, .32]) { rod([dx, .04, -.12], [dx, .3, -.12], .019, m.metal, g); rod([dx, .04, .11], [dx, .3, .11], .019, m.metal, g); rod([dx, .29, -.12], [dx, .57, -.17], .018, m.metal, g); }
    for (let i = 0; i < 3; i++)box(.86, .052, .035, m.wood, 0, .4 + i * .076, -.16, g, .012);
    return rememberPlacement(name, g);
  }
  for (const seat of site.seats) bench(seat.name, seat.x, seat.z, seat.angle);
  for (const [x, z] of Object.values(site.lamps)) lamp(x, z);
  // A short lantern string is secured to the pergola's front corner posts.
  const [cafeX, cafeZ] = site.cafe;
  tube([[cafeX - 1.03, 1.53, cafeZ + .86], [cafeX, 1.40, cafeZ + .86], [cafeX + 1.03, 1.53, cafeZ + .86]], .008, m.metal, staticRoot, 24);
  for (let i = 0; i < 5; i++) { const t = (i + .5) / 5; const x = cafeX - 1.03 + t * 2.06, y = 1.53 - Math.sin(t * Math.PI) * .13; const g = new T.Group(); g.position.set(x, y - .11, cafeZ + .86); root.add(g); sphere(.072, .093, .072, i % 2 ? m.warm : m.pink, 0, 0, 0, g); cyl(.035, .017, m.metal, 0, .096, 0, g); cyl(.035, .018, m.metal, 0, -.092, 0, g); lanterns.push({ g, phase: t * 4 }); }
  // Pocket bus stop, parking meter, trash bins, mail box, and sidewalk sandwich boards.
  const stop = new T.Group(); stop.position.set(site.busStop[0], 0, site.busStop[1]); staticRoot.add(stop);
  stop.rotation.y = Math.PI; // Waiting passengers face the carriageway, with glazing behind them.
  if (assets) stop.position.y = WALK_Y - new T.Box3().setFromObject(assets.templates.get('bus-shelter')).min.y;
  if (assets) assets.place('bus-shelter', stop);
  else {
    for (const x of [-.57, .57]) cyl(.021, 1.32, m.metal, x, .68, 0, stop);
    box(1.65, .05, .65, m.blue, 0, 1.36, 0, stop, .006);
    const stopGlass = box(1.22, .71, .025, windowSystem.glass, 0, .82, -.17, stop, .03); stopGlass.castShadow = false; stopGlass.receiveShadow = false; box(1.1, .05, .21, m.wood, 0, .32, -.05, stop);
  }
  cyl(.017, 1.45, m.metal, 1, .74, .06, stop); box(.24, .33, .06, m.teal, 1, 1.45, .06, stop, .06); place('The last bus', 'A flat glass shelter with timber seating and a softly illuminated route map. The quiet stop catches the passing headlights.', ...site.busStop, .75, 1.6);
  rememberPlacement('Bus shelter', stop);
  const mailbox = new T.Group(); mailbox.position.set(site.mailbox[0], 0, site.mailbox[1]); staticRoot.add(mailbox);
  box(.24, .42, .22, m.blue, 0, .28, 0, mailbox, .07); box(.15, .025, .02, m.dark, 0, .36, .115, mailbox);
  rememberPlacement('Post box', mailbox);
  for (const [x, z] of site.menuBoards) {
    const board = new T.Group(); board.position.set(x, 0, z); staticRoot.add(board);
    const b = box(.29, .47, .035, m.woodDark, 0, .28, 0, board); b.rotation.x = -.12;
    box(.21, .3, .016, m.dark, 0, .31, .028, board); box(.33, .05, .04, m.wood, 0, .55, -.03, board);
    rememberPlacement('Shop menu board', board);
  }
  // Cycles share a designated parking bay beside the bus stop.
  function bicycle(parent, paint = m.blue) {
    const g = new T.Group(); g.userData.wheels = []; parent.add(g); for (const x of [-.25, .25]) { const wheel = new T.Group(); wheel.position.set(x, .19, 0); g.add(wheel); g.userData.wheels.push(wheel); torus(.18, .019, m.tire, 0, 0, 0, wheel); for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3; rod([0, 0, 0], [Math.cos(a) * .165, Math.sin(a) * .165, 0], .003, m.rail, wheel); } }
    rod([-.25, .19, 0], [-.12, .42, 0], .014, paint, g); rod([-.12, .42, 0], [.1, .42, 0], .014, paint, g); rod([.1, .42, 0], [.25, .19, 0], .014, paint, g); rod([-.25, .19, 0], [0, .19, 0], .014, paint, g); rod([0, .19, 0], [-.12, .42, 0], .014, paint, g); rod([0, .19, 0], [.1, .42, 0], .014, paint, g); rod([.1, .42, 0], [.12, .51, 0], .012, m.metal, g); rod([.12, .51, -.07], [.12, .51, .07], .014, m.metal, g); box(.13, .025, .075, m.woodDark, -.14, .45, 0, g, .012); return g;
  }
  const parkedBike = bicycle(staticRoot, m.peach); parkedBike.position.set(site.bicycle[0], WALK_Y - .01, site.bicycle[1]); parkedBike.rotation.y = 0; parkedBike.rotation.x = .14; rememberPlacement('Parked bicycle', parkedBike);

  function car(color, kind = 'compact') {
    const g = new T.Group(); root.add(g); g.name = kind;
    if (assets) { const model = assets.place('retro-car', g); model.traverse(object => { if (object.isMesh && object.material.name.startsWith('Car paint')) { object.material = object.material.clone(); object.material.color.set(color); } }); if (kind === 'taxi') box(.15, .047, .12, m.warm, -.06, .60, 0, g, .022); return g; }
    const paint = material(color, { roughness: .45, metalness: .18 }); box(.81, .22, .41, paint, 0, .24, 0, g, .11); box(.44, .048, .34, paint, -.06, .53, 0, g, .022);
    for (const side of [-1, 1]) {
      const pane = box(.38, .145, .009, windowSystem.glass, -.06, .44, side * .167, g, .021); pane.castShadow = false; pane.receiveShadow = false;
      for (const x of [-.27, .14]) rod([x, .355, side * .165], [x + .028, .525, side * .14], .009, paint, g);
      box(.1, .1, .09, m.woodDark, -.08, .395, side * .072, g, .022);
    }
    const windshield = box(.009, .15, .275, windowSystem.glass, .167, .441, 0, g, .01); windshield.rotation.z = .25; windshield.castShadow = false;
    for (const xx of [-.25, .25]) for (const zz of [-.21, .21]) { const wheel = cyl(.092, .054, m.tire, xx, .12, zz, g, .092, 12); wheel.rotation.x = Math.PI / 2; const hub = cyl(.044, .058, m.rail, xx, .12, zz, g, .044, 10); hub.rotation.x = Math.PI / 2; }
    for (const zz of [-.12, .12]) { box(.027, .048, .075, m.warm, .406, .25, zz, g, .017); box(.025, .045, .065, m.coral, -.406, .25, zz, g, .01); }
    if (kind === 'taxi') box(.15, .047, .12, m.warm, -.06, .56, 0, g, .022); return g;
  }
  cars.push({ g: car('#f2c46c', 'taxi'), u: -7.2, lane: site.carLanes[0], direction: 1, speed: .46 }); cars.push({ g: car('#8fc5de'), u: 1.8, lane: site.carLanes[1], direction: -1, speed: .46 }); cars.push({ g: car('#efa4a2'), u: -3.6, lane: site.carLanes[1], direction: -1, speed: .46 });
  // Cat at the flower stall, with a lazily moving tail.
  const cat = new T.Group(); cat.position.set(site.flowers[0] - .43, WALK_Y, site.flowers[1] + .35); cat.rotation.y = site.marketAngle; root.add(cat); sphere(.1, .08, .17, m.cream, 0, .11, 0, cat); sphere(.07, .07, .065, m.cream, 0, .17, .15, cat); for (const dx of [-.043, .043]) cyl(.025, .065, m.cream, dx, .23, .15, cat, 0, 6);
  const catTail = tube([[0, .1, -.13], [.11, .13, -.23], [.17, .23, -.24]], .02, m.cream, cat, 10);
  // Pigeons on the sidewalk and two small gliding birds above the roofs.
  for (let i = 0; i < 3; i++) { const g = new T.Group(); root.add(g); sphere(.032, .036, .057, m.blue, 0, .04, 0, g); sphere(.021, .023, .025, m.cream, 0, .077, .034, g); g.position.set(range(-.25, .25), WALK_Y, range(1.80, 2.10)); birds.push({ g, base: g.position.clone(), phase: rand() * 6, flying: false }); }
  for (let i = 0; i < 2; i++) { const g = new T.Group(); root.add(g); const left = sphere(.1, .012, .042, m.dark, -.09, 0, 0, g), right = sphere(.1, .012, .042, m.dark, .09, 0, 0, g); sphere(.024, .026, .07, m.dark, 0, 0, 0, g); birds.push({ g, left, right, phase: i * 3, flying: true }); }
  const steamMaterial = new T.MeshBasicMaterial({ color: '#f0f5ee', transparent: true, opacity: .11, depthWrite: false });
  for (let i = 0; i < 14; i++) { const o = sphere(.06, .08, .06, steamMaterial, 0, 0, 0, root); o.castShadow = false; steam.push({ mesh: o, phase: i / 14 }); }

  const cityDetails = addStreetDetails({ staticRoot, mesh, box, cyl, sphere, tube, rod, torus, sign, m, material, windowSystem, rememberPlacement });

  const cyberpunk = addCyberpunkDetails({ root, staticRoot, mesh, box, cyl, sphere, tube, rod, torus, material, m, windowSystem, rememberPlacement });

  // The district-wide neon layer reuses the signage inks and cabinets, so it
  // extends the light without adding a single draw call.
  addNeonDistrict({ staticRoot, mesh, box, rod, m, signs: cyberpunk.signs, materials: cyberpunk.materials });

  const systems = addCitySystems({ root, staticRoot, mesh, box, cyl, sphere, rod, tube, torus, m, material, cyberpunk });

  // The elevated metro runs an L round the island's northern coasts, out over the sea.
  const rail = buildElevatedRail({ root, staticRoot, box, cyl, sphere, rod, m, inks: cyberpunk.materials, place, rememberPlacement, seaLevel: SEA_LEVEL, seaFloor: SEA_FLOOR });

  // The sky is not a backdrop — there is no horizon in this view — so it is made of
  // clouds that drift overhead and drop their shadows on the island and the sea.
  const sky = addSky({ root, m });

  // Static surfaces with the same material are merged to keep this detailed world light.
  const groups = new Map(); staticRoot.updateMatrixWorld(true);
  staticRoot.traverse(o => { if (o.isMesh && !Array.isArray(o.material)) { const key = `${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`; if (!groups.has(key)) groups.set(key, { material: o.material, castShadow: o.castShadow, receiveShadow: o.receiveShadow, geometries: [] }); const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld); groups.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry); } });
  const merged = new T.Group(); merged.name = 'Batched neighborhood';
  for (const group of groups.values()) { const geo = mergeGeometries(group.geometries, false); if (!geo) throw new Error('Unable to batch static world geometry'); const o = new T.Mesh(geo, group.material); o.castShadow = group.castShadow; o.receiveShadow = group.receiveShadow; assets?.prepareMesh(o); merged.add(o); for (const g of group.geometries) g.dispose(); }
  root.remove(staticRoot); root.add(merged);
  // Animate the source transforms off-scene and upload them to shared instanced meshes.
  // Traffic and foliage use a small number of draw calls, even while they move.
  const drivers = new T.Group(), animatedGroups = new Map(), hiddenMatrix = new T.Matrix4().makeScale(0, 0, 0);
  for (const child of [...root.children]) if (child !== merged && !places.includes(child)) drivers.add(child);
  drivers.traverse(o => { if (!o.isMesh || Array.isArray(o.material)) return; const key = `${o.geometry.uuid}:${o.material.uuid}:${o.castShadow}:${o.receiveShadow}`; if (!animatedGroups.has(key)) animatedGroups.set(key, { geometry: o.geometry, material: o.material, sources: [], castShadow: o.castShadow, receiveShadow: o.receiveShadow }); animatedGroups.get(key).sources.push(o); });
  const animatedBatches = [];
  for (const batch of animatedGroups.values()) {
    batch.mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.sources.length); batch.mesh.castShadow = batch.castShadow; batch.mesh.receiveShadow = batch.receiveShadow; assets?.prepareMesh(batch.mesh); batch.mesh.frustumCulled = false; batch.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(batch.mesh); animatedBatches.push(batch);
  }
  windowSystem.attachLights(root);
  function updateInstances() { drivers.updateMatrixWorld(true); for (const batch of animatedBatches) { batch.sources.forEach((source, i) => { let visible = true; for (let p = source; p && p !== drivers; p = p.parent)if (!p.visible) { visible = false; break; } batch.mesh.setMatrixAt(i, visible ? source.matrixWorld : hiddenMatrix); }); batch.mesh.instanceMatrix.needsUpdate = true; } }
  // Building selection uses simple invisible volumes after batching the decorative meshes.
  let lastTime = 0;
  function animate(time, dt = .016) {
    lastTime = time;
    assets?.animate(time);
    cyberpunk.animate(time);
    systems.animate(time);
    cityDetails.animate(time);
    rail.animate(time);
    sky.animate(time, dt);
    architecture.fans.forEach((fan, i) => fan.rotation.y = time * (2.6 + i * .2));
    architecture.mall.animate(time);
    architecture.skyline.animate(time);
    leaves.forEach(({ group, phase }) => { group.rotation.z = Math.sin(time * .7 + phase) * .027; group.rotation.x = Math.cos(time * .55 + phase) * .018; });
    lanterns.forEach(({ g, phase }) => g.rotation.z = Math.sin(time * 1.1 + phase) * .08);
    const signal = signalState(time);
    // Vehicles queue behind the stop line while the crossing has the right of way.
    for (const c of [...cars].sort((a, b) => b.u - a.u)) {
      let next = c.u + c.speed * dt;
      const stop = c.direction > 0 ? -1.02 : -1.3;
      if (signal.cars !== 'green' && c.u <= stop + .001) next = Math.min(next, stop);
      const ahead = cars.find(other => other !== c && other.lane === c.lane && other.direction === c.direction && other.u > c.u);
      if (ahead) next = Math.min(next, ahead.u - .99);
      const start = c.direction > 0 ? bounds.minX - .3 : -bounds.maxX - .3, end = c.direction > 0 ? bounds.maxX + .3 : -bounds.minX + .3;
      c.u = next > end ? start : next;
      c.g.position.set(c.u * c.direction, .025, c.lane); c.g.rotation.y = c.direction > 0 ? 0 : Math.PI; c.g.visible = c.g.position.x > bounds.minX + .51 && c.g.position.x < bounds.maxX - .51;
    }
    // The tram lingers at the station, then passes through the rear edge.
    const tramCycle = time % 72, tramStart = bounds.minX - .84; tram.position.x = tramCycle < 8 ? -4.8 : tramCycle < 52 ? -4.8 + (tramCycle - 8) * .31 : tramStart + (tramCycle - 52) * (-4.8 - tramStart) / 20; tram.visible = tram.position.x > bounds.minX + 1.35 && tram.position.x < bounds.maxX - 1.35;
    ripples.forEach((ring, i) => { const t = (time * .45 + i * .25) % 1; ring.scale.set(.7 + t * 5, (.7 + t * 5) * .78, 1); ring.material.opacity = .26 * (1 - t); });
    steam.forEach(({ mesh, phase }) => { const t = (time * .12 + phase) % 1; mesh.position.set(architecture.smokeOrigin.x + Math.sin(t * 4 + phase) * .1, architecture.smokeOrigin.y + t * .82, architecture.smokeOrigin.z + Math.cos(t * 5) * .05); mesh.scale.setScalar(.035 + t * .09); });
    birds.forEach((b, i) => { if (b.flying) { const a = time * .10 + b.phase; b.g.position.set(Math.cos(a) * 5.0, 4.0 + Math.sin(a * 2) * .13, Math.sin(a) * 5.0); b.g.rotation.y = -a; b.left.rotation.z = Math.sin(time * 3 + b.phase) * .27; b.right.rotation.z = -b.left.rotation.z; } else { b.g.position.x = b.base.x + Math.sin(time * .28 + b.phase) * .1; b.g.position.y = b.base.y + Math.max(0, Math.sin(time * 2 + b.phase)) * .025; b.g.rotation.y = Math.sin(time * .24 + b.phase) * 2; } });
    catTail.rotation.y = Math.sin(time * .7) * .2;
    updateInstances();
  }
  animate(0, 0);
  // The sea platform and the elevated line both run past the island's own boundary,
  // so this is the island's bounds opened up to hold them — it is what the
  // scenery-spill check measures against. Everything the town itself places is still
  // held inside the island.
  const sceneryBounds = { minX: SEA.minX - .1, maxX: SEA.maxX + .1, minZ: SEA.minZ - .1, maxZ: SEA.maxZ + .1 };
  return { root, places, placements, cyberpunk, systems, materials: m, animate, walkers, cars, cyclists, tram, buildings: architecture.buildings, navigationObstacles: [...architecture.footprints, { x: site.water[0], z: site.water[1], width: 1.88, depth: 1.06 }, { x: site.cafe[0], z: site.cafe[1], width: 2.16, depth: 1.82 }, ...[site.flowers, site.market].map(([x, z]) => ({ x, z, width: .64, depth: 1.08 }))], cityFeatures: cityDetails.features, signalState: () => signalState(lastTime), windows: windowSystem.windows, interiorLights: windowSystem.lights.map(entry => entry.light), worldSize: WORLD_SIZE, worldWidth: site.width, worldDepth: site.depth, worldBounds: sceneryBounds, worldCenter: site.center, mall: architecture.mall, skyline: architecture.skyline, layout: site, residentCount: RESIDENT_COUNT, assets: assets?.instances || [], statistics: { staticBatches: merged.children.length, animatedBatches: animatedBatches.length }, get time() { return lastTime; } };
}
