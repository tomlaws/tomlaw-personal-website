import * as T from 'three';
import { CITY_LAYOUT as site } from './layout.mjs';
import { facadeGeometry } from './interiors.mjs';
import { surfaceGrain } from './surfaces.mjs';
import { buildShoppingMall } from './shopping-mall.mjs';
import { buildSkyline } from './skyline.mjs';
import { buildArcade } from './arcade.mjs';

// Buildings are massed as soft volumes rather than boxes, so every shell and every
// slab it carries keeps a real corner radius. The radius handed to each volume is the
// design intent, but a facade also has to stay wide enough to wrap its own glazing, so
// the request is clamped by the widest opening per face and by the volume's half-width.
const MIN_CORNER = .12;
const MIN_BEVEL = .012;

function openingReach(openings) {
  let reach = 0;
  for (const { x = 0, width } of openings || []) reach = Math.max(reach, Math.abs(x) + width / 2);
  return reach;
}

function cornerRadius(w, d, r, openings) {
  const limits = [w / 2, d / 2];
  for (const [face, span] of [['front', w], ['back', w], ['right', d], ['left', d]]) {
    const reach = openingReach((openings || {})[face]);
    if (reach) limits.push((span - 2 * reach) / 2 - .02);
  }
  return Math.max(MIN_BEVEL, Math.min(Math.max(r, MIN_CORNER), ...limits));
}

export function buildArchitecture({ root, staticRoot, mesh, box, cyl, sphere, tube, rod, torus, roundedShape, sign, planter, place, windowSystem, material, m, assets }) {
  const buildings = [], fans = [];
  // Each building runs on three tones. The primary is a near-white with just
  // enough tint to tell one wall from the next; the secondary carries the roof,
  // the floor bands and the shopfront fascia; the accent is only spent on
  // brackets, shutters and pipework, so it stays a highlight rather than a wash.
  const plaster = surfaceGrain(material('#fff9f6'), .008, 5);       // penthouse: blush white
  const brick = surfaceGrain(material('#fff4ea'), .009, 5);         // diner: warm peach white
  const concrete = surfaceGrain(material('#fafdff'), .007, 5);      // apartments: cool blue white
  const greenPlaster = surfaceGrain(material('#f9fffc'), .009, 5);  // bookshop: mint white
  const studioPlaster = surfaceGrain(material('#fdf9ff'), .007, 5); // studio: lilac white

  function group(x, z) { const g = new T.Group(); g.position.set(x, .04, z); staticRoot.add(g); return g; }
  function smallSign(text, width, x, y, z, parent, color = '#e4c7a7', scale = .62) {
    const g = new T.Group(); g.position.set(x, y, z); g.scale.y = scale; parent.add(g); sign(text, width, 0, 0, 0, g, color);
  }
  function plate(w, d, r, height, y, mat, parent, x = 0, z = 0) {
    const geo = new T.ExtrudeGeometry(roundedShape(w, d, cornerRadius(w, d, r)), { depth: height, bevelEnabled: false, curveSegments: 12 });
    const o = mesh(geo, mat, x, y, z, parent); o.rotation.x = -Math.PI / 2; return o;
  }
  function wall(w, h, windows, parent, x, z, angle, mat) {
    windows = windows.map(spec => ({ ...spec, shape: 'rounded', radius: .008 }));
    const face = new T.Group(); face.position.set(x, 0, z); face.rotation.y = angle; parent.add(face);
    mesh(facadeGeometry(w, h, windows, .075, .08), mat, 0, 0, 0, face);
    windows.forEach(spec => windowSystem.addWindow({ shape: 'rounded', depth: .47, ...spec, parent: face }));
  }
  function shell(w, d, h, r, mat, parent, openings) {
    r = cornerRadius(w, d, r, openings);
    if (parent.parent === staticRoot) parent.userData.footprint = { x: parent.position.x, z: parent.position.z, width: w, depth: d };
    wall(w - 2 * r, h, openings.front || [], parent, 0, d / 2, 0, mat);
    wall(w - 2 * r, h, openings.back || [], parent, 0, -d / 2, Math.PI, mat);
    wall(d - 2 * r, h, openings.right || [], parent, w / 2, 0, Math.PI / 2, mat);
    wall(d - 2 * r, h, openings.left || [], parent, -w / 2, 0, -Math.PI / 2, mat);
    for (const [sx, sz, angle] of [[1, 1, 0], [1, -1, Math.PI / 2], [-1, -1, Math.PI], [-1, 1, Math.PI * 1.5]]) {
      mesh(new T.CylinderGeometry(r, r, h, 12, 1, true, angle, Math.PI / 2), mat, sx * (w / 2 - r), h / 2 + .08, sz * (d / 2 - r), parent);
    }
  }
  function railing(w, d, x, y, z, parent) {
    const a = [x - w / 2, y, z - d / 2], b = [x - w / 2, y, z + d / 2], c = [x + w / 2, y, z + d / 2], d0 = [x + w / 2, y, z - d / 2];
    rod(a, b, .013, m.rail, parent); rod(b, c, .013, m.rail, parent); rod(c, d0, .013, m.rail, parent);
    for (let i = 0; i <= 8; i++) cyl(.007, .28, m.metal, x - w / 2 + .1 + (w - .2) * i / 8, y - .14, z + d / 2, parent);
  }
  function serviceUnit(parent, x, y, z) {
    box(.47, .21, .38, m.rail, x, y + .105, z, parent, .04);
    for (let i = 0; i < 5; i++)box(.33, .012, .009, m.dark, x, y + .055 + i * .031, z + .195, parent, 0);
    const ring = torus(.115, .012, m.metal, x, y + .225, z, parent); ring.rotation.x = -Math.PI / 2;
    const rotor = new T.Group(); rotor.position.copy(parent.localToWorld(new T.Vector3(x, y + .233, z))); root.add(rotor);
    for (let i = 0; i < 3; i++) { const blade = box(.14, .01, .038, m.metal, .047, .0, 0, rotor, .014); blade.rotation.y = i * Math.PI * 2 / 3; blade.position.set(Math.cos(i * Math.PI * 2 / 3) * .043, 0, Math.sin(i * Math.PI * 2 / 3) * .043); }
    fans.push(rotor);
  }
  function drainpipe(x, h, z, parent) {
    tube([[x, .08, z], [x, .22, z], [x, h - .12, z], [x - .12, h, z]], .016, m.rail, parent, 12);
    for (let y = .4; y < h; y += .63)box(.065, .025, .046, m.metal, x, y, z, parent, .008);
  }
  const rounded = { shape: 'rounded', radius: .008 };

  // A terracotta diner: straight shopfronts, a flat parapet, and a pitched fabric awning.
  const diner = group(...site.diner);
  shell(2.03, 1.77, 1.49, .18, brick, diner, {
    front: [{ ...rounded, width: 1.55, height: .97, x: 0, y: .29, type: 'kitchen', depth: .67, realLight: true }],
    right: [{ ...rounded, width: .82, height: .98, x: 0, y: .28, type: 'lounge', depth: .45 }],
    left: [{ ...rounded, width: .58, height: 1.21, x: 0, y: .12, type: 'door', depth: .38, mullions: 'none' }],
  });
  plate(2.08, 1.82, .21, .1, 0, m.coral, diner);
  if (assets) assets.place('diner-roof', diner);
  else { plate(2.23, 1.99, .29, .075, 1.57, m.rail, diner); plate(2.16, 1.91, .27, .04, 1.645, m.coral, diner); }
  plate(2.04, 1.79, .2, .045, .2, m.coral, diner);
  if (assets) assets.place('shop-awning', diner, 0, 1.30, .90);
  smallSign('NIGHT KITCHEN', 1.53, 0, 1.425, 1.34, diner, '#ffdba0', .44);
  const dinerStrip = box(1.24, .016, .025, m.pink, 0, 1.305, 1.40, diner, .007); dinerStrip.castShadow = false;
  for (const side of [-1, 1]) {
    rod([side * .88, 1.55, 1.04], [side * .88, 1.36, 1.04], .008, m.metal, diner);
    sphere(.072, .10, .072, m.pink, side * .88, 1.28, 1.04, diner);
    cyl(.032, .017, m.copper, side * .88, 1.38, 1.04, diner);
  }
  // Extraction hood and swept duct serve the visible kitchen below.
  box(.57, .25, .48, m.rail, .39, 1.82, -.36, diner, .075);
  tube([[.39, 1.89, -.36], [.42, 2.04, -.38], [.43, 2.19, -.48]], .085, m.metal, diner, 16);
  cyl(.13, .045, m.rail, .43, 2.23, -.48, diner);
  serviceUnit(diner, -.4, 1.7, -.25);
  drainpipe(-.85, 1.58, -.72, diner);
  for (const xx of [-.81, .81]) box(.055, .018, .76, m.woodDark, xx, .12, 1.06, diner, .01);
  place('Night kitchen', 'Pink neon above the late-night ramen counter. Steam rises past the roof sign while pendant lamps light the kitchen behind clear glass.', ...site.diner, 1.1, 2.35);
  buildings.push({ name: 'Night kitchen', design: 'flat-parapet diner', group: diner });

  // A mixed-use apartment house: a record bar, a projecting balcony, and a stepped penthouse.
  const apartments = group(...site.apartments);
  shell(1.9, 1.87, 2.19, .16, concrete, apartments, {
    front: [
      { ...rounded, width: .92, height: .91, x: -.25, y: .19, type: 'records', depth: .56, realLight: true },
      { ...rounded, width: .33, height: 1.0, x: .52, y: .12, type: 'door', depth: .36, mullions: 'none' },
      { ...rounded, width: 1.29, height: .71, x: 0, y: 1.41, type: 'lounge', depth: .50 },
    ],
    right: [{ ...rounded, width: .88, height: .83, x: -.05, y: .24, type: 'study', depth: .37 }, { ...rounded, width: .88, height: .69, x: -.05, y: 1.41, type: 'bedroom', depth: .37, lit: false }],
  });
  plate(1.98, 1.95, .18, .09, 0, m.blue, apartments);
  plate(2.04, 2.03, .2, .09, 2.28, m.blue, apartments);
  // The upper floor recedes to make room for a real terrace.
  const penthouse = new T.Group(); penthouse.position.set(-.19, 2.36, -.17); apartments.add(penthouse);
  shell(1.47, 1.48, 1.06, .15, plaster, penthouse, {
    front: [{ ...rounded, width: 1.06, height: .76, x: 0, y: .18, type: 'bedroom', depth: .50, mullions: 'none' }],
    right: [{ ...rounded, width: .83, height: .72, x: 0, y: .18, type: 'study', depth: .37 }],
  });
  if (assets) assets.place('apartment-roof', penthouse);
  else plate(1.62, 1.62, .22, .09, 1.16, m.blue, penthouse);
  for (const y of [1.28, 2.32]) {
    plate(1.92, .49, .17, .075, y, m.blue, apartments, 0, 1.0);
    railing(1.81, .41, 0, y + .36, 1.01, apartments);
    planter(.12, apartments, -.71, y + .075, 1.04);
  }
  smallSign('RECORD ROOM', 1.34, 0, 1.20, .956, apartments, '#e4c7a7', .42);
  // A clay-tiled roof crowns the penthouse; planted balconies soften the facade.
  if (!assets) {
    for (const xx of [-.52, .54]) for (const zz of [-.51, .52]) cyl(.017, .49, m.woodDark, xx, 1.495, zz, penthouse);
    for (let i = 0; i < 5; i++)tube([[-.58, 1.73, -.53 + i * .27], [0, 1.79, -.53 + i * .27], [.6, 1.73, -.53 + i * .27]], .019, m.wood, penthouse, 8);
  }
  planter(.16, apartments, -.66, 2.4, .56); planter(.13, apartments, .64, 2.4, .57);
  if (assets) {
    assets.place('trailing-vine', apartments, -.72, 1.52, 1.24, .67);
    assets.place('trailing-vine', apartments, -.73, 2.58, 1.24, .85);
    assets.place('trailing-vine', apartments, .91, 2.49, .50, .78, Math.PI / 2);
  }
  serviceUnit(apartments, .55, 2.40, .96);
  drainpipe(.91, 2.3, -.84, apartments);
  const blade = new T.Group(); blade.position.set(-.79, 1.91, 1.02); apartments.add(blade);
  box(.23, .71, .10, m.dark, 0, 0, 0, blade, .045);
  for (let i = 0; i < 3; i++) { const record = torus(.064, .009, i % 2 ? m.teal : m.pink, 0, .21 - i * .21, .057, blade); record.castShadow = false; }
  rod([0, .25, -.1], [0, .25, 0], .011, m.copper, blade);
  // Rear fire escape, handrails, and service cables are visible when orbiting.
  for (const yy of [1.26, 2.26]) {
    box(.63, .045, .28, m.metal, 0, yy, -1.01, apartments, .01);
    rod([-.31, yy, -1.14], [-.31, yy + .31, -1.14], .009, m.rail, apartments);
    rod([.31, yy, -1.14], [.31, yy + .31, -1.14], .009, m.rail, apartments);
    rod([-.31, yy + .31, -1.14], [.31, yy + .31, -1.14], .009, m.rail, apartments);
  }
  for (const xx of [-.25, .25]) rod([xx, .23, -1.1], [xx, 2.34, -1.1], .012, m.metal, apartments);
  for (let i = 0; i < 12; i++)rod([-.25, .29 + i * .17, -1.1], [.25, .29 + i * .17, -1.1], .009, m.rail, apartments);
  place('Record room', 'A magenta VINYL sign marks the listening bar beneath the apartments. Planted terraces, a clay roof, exposed service cables, and a rear fire escape sit above the warm rooms.', ...site.apartments, 1.14, 4.46);
  buildings.push({ name: 'Record room', design: 'stepped apartments', group: apartments });

  // A converted workshop: twin sawtooth roof bays, clerestory glazing, and a broad bookshop window.
  const books = group(...site.books);
  shell(1.95, 1.85, 1.93, .12, greenPlaster, books, {
    front: [
      { ...rounded, radius: .13, width: 1.51, height: 1.12, x: 0, y: .17, type: 'books', depth: .63, realLight: true },
      { ...rounded, width: .33, height: .33, x: -.47, y: 1.54, type: 'study', depth: .32, mullions: 'none' },
      { ...rounded, width: .33, height: .33, x: .47, y: 1.54, type: 'study', depth: .32, mullions: 'none', lit: false },
    ],
    right: [{ ...rounded, width: .85, height: .85, x: 0, y: .31, type: 'books', depth: .35 }, { ...rounded, width: .81, height: .28, x: 0, y: 1.55, type: 'study', depth: .32, mullions: 'none' }],
    left: [{ ...rounded, width: .51, height: 1.2, x: -.11, y: .12, type: 'door', depth: .32, mullions: 'none' }],
  });
  plate(2.04, 1.94, .16, .09, 0, m.sage, books);
  if (assets) assets.place('barrel-roof', books);
  else {
    for (let i = 0; i < 2; i++) { const roof = box(2.16, .055, 1.18, m.sage, 0, 2.30, -.51 + i * 1.02, books, .008); roof.rotation.x = -.47; }
  }
  smallSign('PAPER & INK', 1.27, 0, 1.415, .955, books);
  tube([[-.14, 1.91, .93], [0, 1.97, 1.03], [0, 1.95, 1.10]], .011, m.copper, books, 10);
  const bookLamp = sphere(.07, .025, .052, m.warm, 0, 1.925, 1.10, books); bookLamp.castShadow = false;
  tube([[-1.0, 2.055, 1.01], [0, 2.055, 1.01], [1.0, 2.055, 1.01]], .025, m.metal, books);
  drainpipe(.94, 2.055, .93, books);
  place('Paper & ink', 'An archive and bookshop beneath a cyan lightbox. The old sawtooth roof shelters deep shelves and a reading desk; an after-hours vending machine waits beside the entrance.', ...site.books, 1.1, 2.72);
  buildings.push({ name: 'Paper & ink', design: 'sawtooth workshop', group: books });

  // The taller studio projects forward to form the eastern edge of the courtyard.
  const studio = group(...site.studio);
  shell(1.78, 2.42, 2.56, .012, studioPlaster, studio, {
    front: [
      { ...rounded, width: 1.15, height: 1.03, x: 0, y: .24, type: 'studio', depth: .54, realLight: true },
      { ...rounded, width: 1.18, height: .76, x: 0, y: 1.61, type: 'studio', depth: .48 },
    ],
    right: [
      { ...rounded, width: .70, height: .94, x: -.52, y: .25, type: 'studio', depth: .39 },
      { ...rounded, width: .61, height: 1.02, x: .48, y: .12, type: 'door', depth: .32, mullions: 'none' },
      { ...rounded, width: 1.52, height: .67, x: 0, y: 1.63, type: 'study', depth: .40 },
    ],
    left: [{ ...rounded, width: 1.24, height: .68, x: 0, y: 1.64, type: 'studio', depth: .37, lit: false }],
  });
  plate(1.90, 2.54, .01, .085, 0, m.copper, studio);
  plate(1.88, 2.50, .01, .065, 1.43, m.copper, studio);
  if (assets) assets.place('studio-roof', studio, 0, 2.64, 0);
  else { const roof = box(1.96, .07, 2.63, m.copper, 0, 2.90, 0, studio, .008); roof.rotation.x = .145; }
  for (const x of [-.79, .79]) box(.065, 2.5, .08, m.copper, x, 1.37, 1.23, studio, .006);
  smallSign('ORCHID ATELIER', 1.31, 0, 1.43, 1.25, studio, '#ead2bb', .43);
  box(1.40, .055, .40, m.copper, 0, 1.32, 1.39, studio, .008);
  for (let i = 0; i < 4; i++)box(.43, .014, .13, m.woodDark, .79, 1.91 + i * .105, -.82, studio, .006);
  drainpipe(-.83, 2.65, -1.13, studio);
  planter(.13, studio, -.70, 0, 1.49);
  place('Orchid studio', 'A violet-lit atelier at the edge of the square. A neon orchid emblem and a rooftop antenna rise above clear windows, easels, and shelves.', ...site.studio, 1.12, 3.2);
  buildings.push({ name: 'Orchid studio', design: 'copper-roof atelier', group: studio });

  const mall = buildShoppingMall({ root, staticRoot, mesh, box, cyl, sphere, rod, sign, planter, place, windowSystem, material, m, assets, group, shell, plate, smallSign, serviceUnit, drainpipe });
  buildings.push(mall.building);
  const skyline = buildSkyline({ root, staticRoot, mesh, box, cyl, sphere, rod, tube, torus, material, m, assets, group, shell, plate, smallSign, serviceUnit, planter, place, windowSystem });
  buildings.push(...skyline.buildings);
  // The back-row infill is registered last so its neon can attach to existing kerbs.
  const arcade = buildArcade({ mesh, staticRoot, box, cyl, sphere, rod, tube, torus, material, m, assets, group, shell, plate, serviceUnit, drainpipe, planter, place });
  buildings.push(arcade.building);
  return { buildings, skyline, footprints: buildings.map(b => b.group.userData.footprint), fans, mall, smokeOrigin: diner.localToWorld(new T.Vector3(.43, 2.26, -.48)) };
}
