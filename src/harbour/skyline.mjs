import * as T from 'three';
import { CITY_LAYOUT as site } from './layout.mjs';
import { surfaceGrain } from './surfaces.mjs';

export function buildSkyline({ root, staticRoot, mesh, box, cyl, sphere, rod, tube, torus, material, m, assets, group, shell, plate, smallSign, serviceUnit, planter, place, windowSystem }) {
  const graphite = surfaceGrain(material('#f8fbff', { metalness: .10, roughness: .52 }), .004, 5);  // primary: sky white
  const plum = surfaceGrain(material('#fdf7ff', { metalness: .08, roughness: .56 }), .004, 5);     // primary: lilac white
  const fins = material('#87cbfb', { metalness: .30, roughness: .44 });                            // secondary: sky blue
  const buildings = [], beacons = [];
  const specs = [
    { name: 'Relay residences', anchor: site.towers[0], width: 2.70, depth: 2.40, shaft: 2.32, shaftD: 2.05, base: 1.40, wall: graphite, floors: 6, capW: 1.78, capD: 1.64, capH: 1.26 },
    { name: 'Signal exchange', anchor: site.towers[1], width: 3.00, depth: 2.40, shaft: 2.54, shaftD: 2.10, base: 1.33, wall: plum, floors: 5, capW: 2.12, capD: 1.72, capH: .74 },
  ];
  // Both towers share two beacon materials, so the extra height costs no new draw
  // calls; the animate loop walks unique materials only.
  const beaconPink = material('#ff8fbc', { emissive: '#ff8fbe', emissiveIntensity: 1.0 });
  const beaconCyan = material('#8ce8ff', { emissive: '#8adcff', emissiveIntensity: 1.1 });
  beacons.push(beaconPink, beaconCyan);
  const frontTypes = ['study', 'lounge', 'studio', 'bedroom'];
  const sideTypes = ['bedroom', 'study', 'lounge', 'studio'];
  for (const [index, spec] of specs.entries()) {
    const { anchor, width: w, depth: d, base, wall, shaft, shaftD } = spec;
    const shaftH = spec.floors * 1.08 + .12, top = base + .12 + shaftH + .14;
    const tower = group(...anchor); tower.name = spec.name;
    shell(w, d, base - .10, .025, wall, tower, {
      front: [{ width: 1.05, height: .94, x: -.60, y: .17, type: 'study', depth: .63, realLight: true }, { width: .68, height: .97, x: .58, y: .14, type: 'door', depth: .40, mullions: 'none' }],
      [index ? 'right' : 'left']: [{ width: 1.50, height: .76, x: 0, y: .28, type: 'study', depth: .44 }],
    });
    plate(w + .12, d + .12, .02, .09, 0, m.stone, tower);
    plate(w + .15, d + .16, .02, .12, base, m.metal, tower);
    // A deep entrance under the setback makes the tower's ground floor legible.
    box(2.11, .075, .53, m.metal, 0, 1.12, d / 2 + .20, tower, .015);
    box(1.65, .016, .025, index ? m.pink : m.teal, 0, 1.078, d / 2 + .43, tower, .003).castShadow = false;
    smallSign(index ? 'SIGNAL / 09' : 'RELAY / 08', 1.72, 0, 1.23, d / 2 + .47, tower, index ? '#f5a5d1' : '#9de9ed', .46);
    const shaftGroup = new T.Group(); shaftGroup.position.set(0, base + .12, -.08); tower.add(shaftGroup);
    const front = [], outside = [];
    for (let floor = 0; floor < spec.floors; floor++) {
      front.push({ width: shaft - .52, height: .75, x: 0, y: .17 + floor * 1.08, type: frontTypes[floor % 4], depth: .59, lit: (floor + index) % 3 !== 1, mullions: 'cross' });
      outside.push({ width: shaftD - .55, height: .70, x: 0, y: .20 + floor * 1.08, type: sideTypes[floor % 4], depth: .43, lit: (floor + index) % 2 === 0, mullions: 'vertical' });
    }
    const bridgeDoor = { width: .64, height: .74, x: index ? .38 : -.41, y: 3.21 - (base + .12 + .04), type: 'door', depth: .39, mullions: 'none' };
    shell(shaft, shaftD, shaftH, .02, wall, shaftGroup, { front, [index ? 'right' : 'left']: outside, [index ? 'left' : 'right']: [bridgeDoor, { width: 1.1, height: .70, x: 0, y: .20, type: 'study', depth: .39 }, { width: 1.1, height: .57, x: 0, y: 2.52, type: 'study', depth: .39, lit: false }] });
    for (let floor = 0; floor < spec.floors + 1; floor++)plate(shaft + .12, shaftD + .12, .02, .065, .08 + floor * 1.08, fins, shaftGroup);
    for (const x of [-shaft / 2 - .025, shaft / 2 + .025]) {
      box(.075, shaftH + .10, .075, m.metal, x, shaftH / 2 + .05, shaftD / 2 + .012, shaftGroup, .012);
      // Exposed diagonal bracing repeats up the solid corner bays, clear of the glass.
      for (let bay = 0; bay < spec.floors; bay += 3) {
        const y0 = .10 + bay * 1.08;
        rod([x, y0, -shaftD / 2], [x, y0 + 1.04, -shaftD / 2 + .35], .018, fins, shaftGroup);
        rod([x, y0 + 1.07, -shaftD / 2 + .35], [x, y0 + 2.10, -shaftD / 2], .018, fins, shaftGroup);
      }
    }
    box(.014, shaftH - .15, .024, index ? m.pink : m.teal, shaft / 2 + .04, shaftH / 2 + .09, shaftD / 2 + .055, shaftGroup, .003).castShadow = false;
    const cap = new T.Group(); cap.position.set(index ? .14 : -.12, top, -.18); tower.add(cap);
    shell(spec.capW, spec.capD, spec.capH, .02, wall, cap, {
      front: [{ width: spec.capW - .44, height: spec.capH - .28, x: 0, y: .18, type: index ? 'study' : 'lounge', depth: .47, mullions: 'none' }],
    });
    plate(spec.capW + .13, spec.capD + .13, .02, .10, spec.capH + .14, fins, cap);
    plate(shaft + .15, shaftD + .15, .02, .10, top - .02, fins, tower);
    for (const x of [-shaft / 2 + .12, shaft / 2 - .12]) {
      rod([x, top + .12, .78], [x, top + .39, .78], .012, m.rail, tower);
      planter(.10, tower, x, top + .02, .53);
    }
    rod([-shaft / 2 + .12, top + .39, .78], [shaft / 2 - .12, top + .39, .78], .014, m.rail, tower);
    serviceUnit(cap, -.36, spec.capH + .25, -.10);
    cyl(.19, .23, fins, .42, spec.capH + .37, -.20, cap);
    sphere(.20, .12, .20, fins, .42, spec.capH + .50, -.20, cap);
    cyl(.014, .62, m.rail, .42, spec.capH + .89, -.20, cap);
    sphere(.037, .038, .037, beaconPink, .42, spec.capH + 1.20, -.20, cap).castShadow = false;
    sphere(.030, .031, .030, beaconCyan, -.36, spec.capH + .62, -.10, cap).castShadow = false;
    // A maintenance riser carries neatly clipped cables and a rolled shutter.
    const side = -w / 2 - .025;
    for (const z of [-1.05, -.94]) tube([[side, .16, z], [side, base - .2, z], [side + .20, base + .18, z]], .028, m.rail, tower, 12);
    for (let i = 0; i < 9; i++)box(.64, .055, .015, fins, .57, .27 + i * .074, -d / 2 - .025, tower, .003);
    box(.72, .12, .09, m.metal, .57, .98, -d / 2 - .025, tower, .015);
    const hit = place(spec.name, index ? 'A stepped communications exchange with an elevated glass walkway, service shutters, antenna equipment, and quiet workrooms above the tram line.' : 'A layered residential tower with recessed glass rooms, a planted setback, exposed bracing, and a skybridge to the next block.', ...anchor, w * .57, top + spec.capH + .6);
    hit.userData.focusZoom = 2.05;
    buildings.push({ name: spec.name, design: index ? 'stepped communications exchange' : 'braced residential tower', group: tower });
  }

  const bridge = new T.Group(); bridge.position.set(-1.89, 3.18, -7.14); staticRoot.add(bridge); bridge.name = 'Elevated glass skybridge';
  const length = 4.56, depth = .68;
  box(length, .10, depth, m.metal, 0, 0, 0, bridge, .012);
  box(length, .085, depth + .10, m.metal, 0, .79, 0, bridge, .014);
  for (const z of [-depth / 2, depth / 2]) {
    const pane = box(length - .06, .69, .012, windowSystem.glass, 0, .39, z, bridge, .002); pane.castShadow = false;
    for (let x = -length / 2 + .08; x < length / 2; x += .55)box(.026, .70, .035, fins, x, .395, z, bridge, .003);
    rod([-length / 2, .16, z], [length / 2, .16, z], .013, fins, bridge);
  }
  for (let x = -1.75; x < 2; x += .88)box(.26, .012, .08, m.warm, x, .728, 0, bridge, .003).castShadow = false;
  for (const z of [-.35, .35]) box(length - .14, .012, .018, m.teal, 0, -.064, z, bridge, .003).castShadow = false;
  function animate(time) { beacons.forEach((mat, i) => mat.emissiveIntensity = .62 + .38 * (.5 + .5 * Math.sin(time * 1.35 + i * 2))); }
  return { buildings, bridge, beacons, animate };
}
