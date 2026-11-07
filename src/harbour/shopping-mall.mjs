import * as T from 'three';
import { CITY_LAYOUT as site } from './layout.mjs';
import { surfaceGrain } from './surfaces.mjs';

export function buildShoppingMall({ root, staticRoot, mesh, box, cyl, sphere, rod, sign, planter, place, windowSystem, material, m, assets, group, shell, plate, smallSign, serviceUnit, drainpipe }) {
  const mall = group(...site.mall); mall.name = 'Lantern Galleria';
  mall.userData.footprint = { x: site.mall[0], z: site.mall[1], width: 4.18, depth: 3.40 };
  // Three tones, as everywhere else in the district: a near-white limestone
  // primary, one lavender secondary carrying every roof, floor band and fascia,
  // and a deeper violet spent only on copings, lantern ribs and door reveals.
  const limestone = surfaceGrain(material('#fdfaff'), .006, 4);   // primary: honed limestone
  const lavender = surfaceGrain(material('#d8c8f5'), .004, 5);    // secondary: roofs and bands
  const violet = material('#a97ff0', { roughness: .42 });         // accent: copings and ribs
  const bronze = material('#f0b972', { metalness: .28, roughness: .46 });
  const glass = windowSystem.glass, trim = lavender;
  const steps = [], doors = [];
  const ROOF = 2.65;      // the retail wings' roof deck
  const SIGNTOP = 4.24;   // the sign tower's head, just under the lantern crown

  // Two retail wings enclose a real, double-height atrium, open beneath its roof lantern.
  plate(4.28, 3.53, .012, .02, 0, m.stone, mall);
  box(1.42, .024, 3.4, lavender, 0, .014, 0, mall, .003);
  for (const side of [-1, 1]) {
    const wing = new T.Group(); wing.position.x = side * 1.40; mall.add(wing);
    const front = [
      { width: 1.08, height: .93, x: 0, y: .17, type: side < 0 ? 'boutique' : 'objects', depth: .69, realLight: true, mullions: 'none' },
      { width: 1.08, height: .91, x: 0, y: 1.48, type: side < 0 ? 'bakery' : 'lounge', depth: .67, mullions: 'none' },
    ];
    const sideWindows = [
      { width: 1.10, height: .92, x: -.79, y: .17, type: 'boutique', depth: .46 },
      { width: 1.10, height: .92, x: .79, y: .17, type: 'objects', depth: .46 },
      { width: 1.10, height: .86, x: -.79, y: 1.51, type: 'books', depth: .46 },
      { width: 1.10, height: .86, x: .79, y: 1.51, type: 'bakery', depth: .46, realLight: side > 0 },
    ];
    shell(1.38, 3.40, 2.48, .012, limestone, wing, {
      front,
      [side < 0 ? 'left' : 'right']: sideWindows,
      back: [{ width: 1.04, height: .66, x: 0, y: 1.56, type: 'study', depth: .42, lit: false }],
    });
    // Continuous floor edges and shallow window reveals, rather than decorative color tiles.
    for (const y of [1.29, 2.58]) plate(1.46, 3.48, .012, .065, y, m.stone, wing);
    plate(1.35, 3.35, .012, .035, 2.65, trim, wing);
    // A parapet with a violet coping turns each roof into a deck. The two runs
    // meet on the shell's rounded corner, so the parapet follows the curve
    // rather than poking past it.
    for (const x of [-.64, .64]) box(.075, .38, 3.28, limestone, x, ROOF + .19, 0, wing, .01);
    for (const z of [-1.64, 1.64]) box(1.35, .38, .075, limestone, 0, ROOF + .19, z, wing, .01);
    for (const x of [-.64, .64]) box(.092, .05, 3.28, violet, x, ROOF + .405, 0, wing, .012);
    for (const z of [-1.64, 1.64]) box(1.35, .05, .092, violet, 0, ROOF + .405, z, wing, .012);
    for (const x of [-.615, .615]) box(.045, 2.41, .11, bronze, x, 1.37, 1.74, wing, .005);
    smallSign(side < 0 ? 'FORM · CLOTHING' : 'OBJECT · HOME', 1.03, 0, 1.255, 1.755, wing, '#f0dbc0', .34);
    smallSign(side < 0 ? 'DUSK BAKERY' : 'THE READING ROOM', 1.07, 0, 2.48, 1.755, wing, '#d7dfcd', .31);
    // The deck itself: planting on the quiet flank, a stair hatch, and the plant
    // that serves the shops below.
    for (const z of [-1.02, -.34]) planter(.11, wing, side * .34, ROOF + .02, z);
    box(.54, .075, .54, m.rail, -side * .34, ROOF + .06, .98, wing, .012);
    box(.46, .055, .46, m.metal, -side * .34, ROOF + .125, .98, wing, .008);
    serviceUnit(wing, -side * .30, ROOF + .04, -1.30);
    drainpipe(side * .64, ROOF + .44, -1.64, wing);
    for (let j = 0; j < 5; j++)box(1.30, .012, .009, bronze, 0, .29 + j * .10, -1.714, wing, .001);
  }

  // The east wing carries a stepped sign tower on its deck, so the district's
  // animated billboard is fixed to real massing rather than a floating frame.
  const towerW = 1.36, towerD = .66, towerH = SIGNTOP - ROOF;
  const tower = new T.Group(); tower.position.set(1.40, ROOF, 1.70 - towerD / 2); mall.add(tower);
  box(towerW, towerH, towerD, limestone, 0, towerH / 2, 0, tower, .02);
  for (const x of [-towerW / 2 + .06, towerW / 2 - .06]) box(.10, towerH, towerD, limestone, x, towerH / 2, 0, tower, .012);
  box(towerW + .08, .06, towerD + .06, violet, 0, towerH + .03, 0, tower, .02);
  box(towerW - .12, .05, towerD - .12, limestone, 0, towerH + .085, 0, tower, .015);
  for (const x of [-towerW / 2 + .12, towerW / 2 - .12]) {
    cyl(.045, .09, m.metal, x, towerH + .15, .30, tower);
    sphere(.05, .042, .05, m.warm, x, towerH + .22, .30, tower).castShadow = false;
  }

  // Rear gallery links the upper shops, with a see-through balustrade over the escalators.
  box(1.43, .07, .57, m.stone, 0, 1.305, -1.43, mall, .007);
  box(1.43, 2.52, .07, limestone, 0, 1.34, -1.69, mall, .008);
  const galleryGlass = box(1.28, .30, .012, glass, 0, 1.51, -1.155, mall, .003); galleryGlass.castShadow = false;
  rod([-.68, 1.68, -1.155], [.68, 1.68, -1.155], .012, bronze, mall);
  for (const x of [-.68, .68]) rod([x, 1.34, -1.155], [x, 1.68, -1.155], .012, bronze, mall);
  smallSign('LANTERN GALLERIA', 1.20, 0, 2.13, -1.64, mall, '#f0d3ae', .42);
  for (const x of [-.55, .55]) planter(.09, mall, x, 1.34, -1.44);

  const movement = new T.Group(); movement.name = 'Galleria moving escalators and doors';
  movement.position.copy(mall.position); root.add(movement);
  for (const side of [-1, 1]) {
    if (assets) assets.place('mall-escalator', mall, side * .335, -.10, 0);
    for (let i = 0; i < 24; i++) {
      const step = new T.Group(); movement.add(step);
      box(.405, .033, .100, m.rail, 0, 0, 0, step, .002);
      box(.383, .003, .005, m.cream, 0, .018, .040, step, 0);
      steps.push({ group: step, side, phase: i / 24 });
    }
  }

  // Bronze-framed curtain wall, clear upper glazing, and two sliding entry leaves.
  for (const x of [-.71, 0, .71]) box(.027, 1.31, .028, bronze, x, 2.015, 1.713, mall, .003);
  for (const y of [1.34, 2.68]) box(1.46, .045, .05, bronze, 0, y, 1.714, mall, .005);
  for (const x of [-.355, .355]) {
    const pane = box(.676, 1.27, .008, glass, x, 2.01, 1.71, mall, .001); pane.castShadow = false; pane.receiveShadow = false;
  }
  for (const side of [-1, 1]) {
    box(.045, 1.28, .06, bronze, side * .71, .68, 1.716, mall, .005);
    const door = new T.Group(); door.position.set(side * .30, .035, 1.733); movement.add(door);
    const pane = box(.59, 1.24, .009, glass, 0, .62, 0, door, .001); pane.castShadow = false; pane.receiveShadow = false;
    for (const x of [-.295, .295]) box(.018, 1.24, .025, bronze, x, .62, 0, door, .002);
    for (const y of [.01, 1.23]) box(.59, .018, .025, bronze, 0, y, 0, door, .002);
    rod([-side * .21, .50, .026], [-side * .21, .75, .026], .008, m.rail, door);
    doors.push({ group: door, side });
  }
  box(1.54, .065, .12, bronze, 0, 1.325, 1.72, mall, .008);
  const canopy = box(2.48, .025, 1.08, glass, 0, 1.46, 2.18, mall, .004); canopy.castShadow = false;
  for (const x of [-1.11, -.74, -.37, 0, .37, .74, 1.11]) box(.042, .026, 1.00, bronze, x, 1.432, 2.18, mall, .006);
  for (const x of [-1.09, 1.09]) { rod([x, 1.47, 2.70], [x, 2.34, 1.72], .014, bronze, mall); box(.045, .055, 1.09, bronze, x, 1.46, 2.18, mall, .005); }
  box(2.50, .06, .045, bronze, 0, 1.48, 2.72, mall, .004);
  box(1.98, .018, .02, m.teal, 0, 1.433, 2.73, mall, .002).castShadow = false;
  // A lintel above the skylight entrance carries the mall's name.
  smallSign('LANTERN GALLERIA', 2.17, 0, 2.775, 1.80, mall, '#f4ddba', .60);
  // A stone sill carries the lantern, so the glazing rises out of the block
  // instead of sitting on the roof as loose framing.
  box(1.44, .14, 3.44, violet, 0, 2.73, 0, mall, .02);
  box(1.44, .04, 3.44, limestone, 0, 2.82, 0, mall, .015);
  // A tall lantern rises above the retail wings, with exposed structural ribs.
  for (const x of [-.75, .75]) {
    for (const z of [-1.69, 1.69]) box(.07, 4.30, .07, bronze, x, 2.18, z, mall, .008);
    const side = box(.012, 1.58, 3.34, glass, x, 3.50, 0, mall, .002); side.castShadow = false;
    for (const z of [-.84, 0, .84]) box(.04, 1.63, .04, bronze, x, 3.50, z, mall, .003);
    rod([x, 2.73, -1.66], [x, 4.27, -.83], .014, bronze, mall);
    rod([x, 4.27, .83], [x, 2.73, 1.66], .014, bronze, mall);
  }
  for (const z of [-1.70, 1.70]) {
    const pane = box(1.42, 1.55, .012, glass, 0, 3.50, z, mall, .002); pane.castShadow = false;
    for (const y of [2.73, 3.48, 4.30]) box(1.53, .048, .06, bronze, 0, y, z, mall, .004);
  }
  if (assets) assets.place('mall-skylight', mall, 0, 4.32, 0);
  else box(1.58, .04, 3.52, glass, 0, 4.35, 0, mall);
  for (let i = 0; i < 3; i++) {
    const x = -.36 + i * .36, y = 3.35 - i * .27, z = .85 - i * .29;
    cyl(.006, 4.32 - y, m.metal, x, (y + 4.32) / 2, z, mall);
    sphere(.073, .085, .073, m.warm, x, y, z, mall).castShadow = false;
    cyl(.080, .018, bronze, x, y + .068, z, mall);
  }

  // A sheltered entrance opens straight onto the expanded promenade.
  for (const x of [-1.56, 1.56]) planter(.14, mall, x, 0, 2.045);
  const selection = place('Lantern Galleria', 'A limestone department store stepped around a glazed atrium. Moving escalators climb to a bakery and reading lounge beneath a bronze-framed lantern, roof gardens and a sign tower stand over the shopfronts, and a deep entrance canopy opens straight onto the promenade.', ...site.mall, 2.25, 4.78);
  selection.userData.focusZoom = 2.05;
  function animate(time) {
    for (const step of steps) {
      const t = ((step.phase + time * .065 * (step.side < 0 ? 1 : -1)) % 1 + 1) % 1;
      const rise = T.MathUtils.clamp((t - .13) / .74, 0, 1);
      step.group.position.set(step.side * .335, .04 + 1.28 * rise, 1.08 - 2.16 * t);
    }
    const cycle = time % 22, opening = T.MathUtils.smoothstep(cycle, 3, 5) * (1 - T.MathUtils.smoothstep(cycle, 12, 14));
    for (const door of doors) door.group.position.x = door.side * (.30 + .38 * opening);
  }
  animate(0);
  return { building: { name: 'Lantern Galleria', design: 'stepped limestone galleria', group: mall }, animate, steps, doors, entrance: new T.Vector3(site.mall[0], .06, site.mall[1] + 1.72) };
}
