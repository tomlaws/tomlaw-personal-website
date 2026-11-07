import * as T from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json' with { type: 'json' };
import { CITY_LAYOUT as site } from './layout.mjs';
import { WALK_Y } from './pedestrian.mjs';

// Real vector lettering survives orbiting, batching, and offline GLB inspection.
const font = new FontLoader().parse(fontData);
const letters = new Map();
export function letteringGeometry(text, width, height) {
  const key = `${text}:${width}:${height}`;
  if (!letters.has(key)) {
    const geometry = new T.ShapeGeometry(font.generateShapes(text, 1), 5);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new T.Vector3());
    const center = geometry.boundingBox.getCenter(new T.Vector3());
    const scale = Math.min(width / size.x, height / size.y);
    geometry.translate(-center.x, -center.y, 0); geometry.scale(scale, scale, 1);
    letters.set(key, geometry);
  }
  return letters.get(key);
}

export function addCyberpunkDetails({ root, staticRoot, mesh, box, cyl, sphere, tube, rod, torus, material, m, windowSystem, rememberPlacement }) {
  const cyan = material('#a5ecf5', { emissive: '#4fd4ef', emissiveIntensity: 3.5, roughness: .24 });
  const magenta = material('#f9a8d6', { emissive: '#f57cc0', emissiveIntensity: 4.0, roughness: .24 });
  const amber = material('#ffdfab', { emissive: '#ffab52', emissiveIntensity: 2.7, roughness: .24 });
  const violet = material('#c9a8ff', { emissive: '#a566f5', emissiveIntensity: 3.1, roughness: .26 });
  const acid = material('#c6f5a4', { emissive: '#7fd85a', emissiveIntensity: 2.8, roughness: .26 });
  const panel = material('#b6bfd2', { metalness: .22, roughness: .46 });
  cyan.name = 'Neon · ice'; magenta.name = 'Neon · rose'; amber.name = 'Neon · amber';
  violet.name = 'Neon · violet'; acid.name = 'Neon · acid'; panel.name = 'Sign cabinet · enamel';
  const signs = [];
  function group(anchor, x = 0, y = 0, z = 0, angle = 0) {
    const g = new T.Group(); g.position.set(anchor[0] + x, y, anchor[1] + z); g.rotation.y = angle; staticRoot.add(g); return g;
  }
  function text(value, w, h, x, y, z, parent, ink = cyan) {
    const object = mesh(letteringGeometry(value, w, h), ink, x, y, z, parent);
    object.name = `Neon lettering · ${value}`; object.castShadow = false; return object;
  }
  function strip(a, b, ink, parent, r = .009) { const o = rod(a, b, r, ink, parent); o.castShadow = false; return o; }
  function cabinet(parent, w, h) {
    box(w, h, .095, panel, 0, 0, 0, parent, .025);
    for (const x of [-w / 2 + .025, w / 2 - .025]) box(.012, h - .05, .008, m.rail, x, 0, .052, parent, .002);
    signs.push(parent);
  }

  // The mall receives a roof-mounted sign and a small canopy light, not a
  // luminous facade. Every display has a metal enclosure and fixing brackets.
  const galleria = group(site.mall, 0, 4.76, 1.82);
  cabinet(galleria, 2.55, .48);
  text('GALLERIA', 2.21, .27, 0, .018, .055, galleria);
  strip([-1.09, -.174, .056], [1.09, -.174, .056], magenta, galleria, .007);
  for (const x of [-.69, .69]) rod([x, -.24, -.014], [x, -.50, -.12], .024, m.metal, galleria);
  for (const side of [-1, 1]) strip([site.mall[0] + side * .73, 1.50, site.mall[1] + 2.18], [site.mall[0] + side * .73, 1.50, site.mall[1] + 2.70], cyan, staticRoot, .009);

  const ramen = group(site.diner, 0, 2.14, .83);
  cabinet(ramen, 1.93, .48);
  text('RAMEN', 1.61, .29, 0, 0, .055, ramen, magenta);
  for (const x of [-.68, .68]) rod([x, -.24, 0], [x, -.43, -.20], .02, m.metal, ramen);
  const late = group(site.diner, -1.25, 1.77, .94);
  cabinet(late, .39, .65);
  text('24', .28, .24, 0, .13, .055, late, amber);
  text('H', .16, .16, 0, -.15, .055, late, amber);
  for (const y of [-.23, .23]) rod([.20, y, -.02], [.36, y, -.16], .017, m.metal, late);

  const vinyl = group(site.apartments, 1.19, 2.20, 1.04);
  cabinet(vinyl, .37, 1.64);
  for (const [i, letter] of [...'VINYL'].entries()) text(letter, .22, .22, 0, .57 - i * .285, .055, vinyl, magenta);
  for (const y of [-.65, .65]) rod([-.19, y, -.02], [-.30, y, -.12], .015, m.metal, vinyl);
  strip([-.125, -.72, .055], [.125, -.72, .055], cyan, vinyl, .007);

  const archive = group(site.books, 0, 2.13, 1.065);
  cabinet(archive, 1.59, .29);
  text('ARCHIVE', 1.35, .17, 0, 0, .055, archive);
  for (const x of [-.61, .61]) rod([x, -.13, 0], [x, -.20, -.14], .015, m.metal, archive);

  // The corner atelier advertises with a circular neon emblem and a short name.
  const orchid = group(site.studio, .43, 3.46, .90);
  cabinet(orchid, .98, .53);
  const ring = torus(.143, .014, magenta, -.27, 0, .066, orchid); ring.castShadow = false;
  strip([-.27, -.105, .067], [-.27, .105, .067], cyan, orchid, .007);
  text('OR', .38, .15, .19, .105, .062, orchid);
  text('CHID', .43, .13, .18, -.105, .062, orchid);
  for (const x of [-.31, .31]) rod([x, -.26, 0], [x, -.59, -.29], .017, m.metal, orchid);
  strip([site.studio[0] - .68, 1.39, site.studio[1] + 1.60], [site.studio[0] + .68, 1.39, site.studio[1] + 1.60], magenta, staticRoot);

  // The back-row infill stacks two cabinets: a name board over the shopfront
  // and a vertical blade sign climbing the east edge of the upper floor.
  const voltage = group(site.arcade, 0, 1.72, 1.12);
  cabinet(voltage, 1.34, .32);
  text('VOLTAGE', 1.16, .18, 0, .010, .055, voltage);
  strip([-.62, -.185, .052], [.62, -.185, .052], cyan, voltage, .006);

  const blade = group(site.arcade, .44, 2.78, 1.00);
  cabinet(blade, .34, 1.42);
  for (const [i, letter] of [...'ARCADE'].entries()) text(letter, .17, .17, 0, .52 - i * .21, .055, blade, i % 2 ? magenta : cyan);

  // Service-wall lighting: a corner wash, a door light, and a floor reveal.
  const corner = group(site.arcade, .757, .92, .50);
  strip([0, -.58, 0], [0, .58, 0], magenta, corner, .008);
  const doorway = group(site.arcade, -.79, 1.72, 0);
  strip([0, 0, -.34], [0, 0, .34], amber, doorway, .007);
  const reveal = group(site.arcade, 0, 1.90, 1.14);
  strip([-.72, 0, 0], [.72, 0, 0], amber, reveal, .006);

  // Retrofitted rooftop telecom equipment, confined to existing roofs.
  for (const [anchor, x, y, z] of [[site.mall, 1.4, 2.74, -.57], [site.studio, -.40, 3.03, -.53]]) {
    const mast = group(anchor, x, y, z);
    cyl(.07, .065, m.metal, 0, .02, 0, mast); cyl(.015, .69, m.rail, 0, .37, 0, mast);
    for (const h of [.38, .56]) { rod([-.17, h, 0], [.17, h, 0], .009, m.rail, mast); box(.09, .27, .045, m.metal, .12, h - .16, 0, mast, .008); }
    sphere(.024, .025, .024, magenta, 0, .73, 0, mast).castShadow = false;
    tube([[0, .32, 0], [-.11, .16, .03], [-.20, .03, .07]], .011, m.dark, mast, 10);
  }

  // A single vending machine sits in the shopfront service recess. Its glass
  // front reveals shelves and cans; it does not occupy a walking corridor.
  const vending = group([-.56, -3.00], 0, WALK_Y);
  for (const x of [-.20, .20]) box(.026, .80, .30, panel, x, .40, 0, vending, .009);
  box(.42, .035, .30, panel, 0, .79, 0, vending, .009);
  box(.42, .14, .30, panel, 0, .07, 0, vending, .009);
  box(.40, .76, .02, panel, 0, .40, -.14, vending, .003);
  box(.12, .62, .26, panel, .145, .45, .015, vending, .004);
  for (let row = 0; row < 3; row++) {
    box(.26, .015, .20, m.rail, -.055, .255 + row * .14, 0, vending, .003);
    for (let col = 0; col < 3; col++)cyl(.027, .082, [m.peach, m.sage, m.cream][col], -.14 + col * .084, .304 + row * .14, .035, vending, .027, 12);
  }
  const glass = box(.267, .45, .006, windowSystem.glass, -.055, .435, .155, vending, .003); glass.castShadow = false;
  text('24H', .27, .08, 0, .716, .158, vending, cyan);
  box(.064, .084, .008, cyan, .14, .54, .16, vending, .003).castShadow = false;
  box(.061, .013, .008, m.rail, .14, .43, .16, vending, .002);
  box(.24, .058, .011, m.dark, -.052, .12, .156, vending, .01);
  strip([-.182, .66, .145], [.075, .66, .145], amber, vending, .004);
  rememberPlacement('After-hours vending machine', vending);

  // Low-level fixtures belong to existing objects and stay out of the paths.
  const [wx, wz] = site.water;
  for (const side of [-1, 1]) strip([wx + side * .90, .105, wz - .33], [wx + side * .90, .105, wz + .33], cyan, staticRoot, .006);
  const stop = group(site.busStop, 0, 1.38, 0);
  strip([-.76, 0, -.35], [.76, 0, -.35], cyan, stop, .007);
  text('NIGHT LINE  /  07', 1.16, .10, 0, -.12, -.344, stop, cyan).rotation.y = Math.PI;

  const rest = { cyan: cyan.emissiveIntensity, magenta: magenta.emissiveIntensity, amber: amber.emissiveIntensity, violet: violet.emissiveIntensity, acid: acid.emissiveIntensity };
  // Daylight dials the whole sign layer back, so the same inks read as painted
  // trim in the sun and as neon once the light goes.
  let glow = 1;
  function animate(time) {
    // Every ink runs on its own cycle, so the district never pulses in unison.
    // The acid tubes buzz on an irregular beat; the violet swells slowly behind them.
    cyan.emissiveIntensity = rest.cyan * glow * (.94 + .06 * Math.sin(time * .45));
    magenta.emissiveIntensity = rest.magenta * glow * (.94 + .06 * Math.sin(time * .61 + .8));
    amber.emissiveIntensity = rest.amber * glow * (.965 + .035 * Math.sin(time * .33 + 2.1));
    violet.emissiveIntensity = rest.violet * glow * (.90 + .10 * Math.sin(time * .27 + 1.4));
    const buzz = Math.sin(time * 21.7) * Math.sin(time * 13.1 + 1.7);
    acid.emissiveIntensity = rest.acid * glow * (.84 + .16 * Math.max(0, buzz));
  }
  animate(0);
  return { signs, materials: { cyan, magenta, amber, violet, acid, panel }, animate, setGlow: value => { glow = value; } };
}

// The wider neon district: parapet light-lines, perpendicular blade signs,
// abstract tube glyphs, wall tags and pavement strips. It shares the inks and
// cabinet above, so the whole layer costs no additional draw calls.
export function addNeonDistrict({ staticRoot, mesh, box, rod, m, signs, materials }) {
  const { cyan, magenta, amber, violet, acid, panel } = materials;
  const g = (x, y, z, angle = 0) => { const o = new T.Group(); o.position.set(x, y, z); o.rotation.y = angle; staticRoot.add(o); return o; };
  const strip = (a, b, ink, parent, r = .008) => { const o = rod(a, b, r, ink, parent); o.castShadow = false; return o; };
  const text = (value, w, h, parent, ink = cyan, x = 0, y = 0, z = .055) => { const o = mesh(letteringGeometry(value, w, h), ink, x, y, z, parent); o.castShadow = false; return o; };
  function cabinet(parent, w, h) {
    box(w, h, .095, panel, 0, 0, 0, parent, .025);
    for (const x of [-w / 2 + .025, w / 2 - .025]) box(.012, h - .05, .008, m.rail, x, 0, .052, parent, .002);
    signs.push(parent);
  }
  // Abstract tube glyphs: blocky ideograms assembled from real neon strokes.
  // Four distinct forms stop a row of signs reading as one repeated logo.
  const glyphForms = [
    (o, s, k) => {
      strip([-.38 * s, .34 * s, .032], [.38 * s, .34 * s, .032], k, o, .013);
      strip([-.38 * s, -.34 * s, .032], [.38 * s, -.34 * s, .032], k, o, .013);
      strip([-.30 * s, .34 * s, .032], [-.30 * s, -.34 * s, .032], k, o, .012);
      strip([-.30 * s, 0, .032], [.10 * s, 0, .032], k, o, .012);
      strip([.10 * s, -.34 * s, .032], [.30 * s, .12 * s, .032], k, o, .012);
    },
    (o, s, k) => {
      strip([-.34 * s, .34 * s, .032], [.13 * s, .34 * s, .032], k, o, .012);
      strip([.13 * s, .34 * s, .032], [.13 * s, -.09 * s, .032], k, o, .012);
      strip([.13 * s, -.09 * s, .032], [.34 * s, -.09 * s, .032], k, o, .012);
      strip([-.34 * s, .34 * s, .032], [-.34 * s, -.34 * s, .032], k, o, .012);
      strip([-.34 * s, -.34 * s, .032], [.34 * s, -.34 * s, .032], k, o, .012);
    },
    (o, s, k) => {
      strip([-.30 * s, .32 * s, .032], [.30 * s, .32 * s, .032], k, o, .012);
      strip([-.30 * s, -.32 * s, .032], [.30 * s, -.32 * s, .032], k, o, .012);
      strip([-.30 * s, .32 * s, .032], [-.30 * s, -.32 * s, .032], k, o, .012);
      strip([.30 * s, .32 * s, .032], [.30 * s, -.32 * s, .032], k, o, .012);
      strip([-.30 * s, -.32 * s, .032], [.30 * s, .32 * s, .032], k, o, .012);
    },
    (o, s, k) => {
      strip([-.08 * s, .34 * s, .032], [.10 * s, .34 * s, .032], k, o, .012);
      strip([.10 * s, .34 * s, .032], [.10 * s, -.34 * s, .032], k, o, .012);
      strip([-.30 * s, -.34 * s, .032], [.10 * s, -.34 * s, .032], k, o, .012);
      strip([-.30 * s, -.06 * s, .032], [-.30 * s, -.34 * s, .032], k, o, .012);
      strip([-.30 * s, -.06 * s, .032], [-.02 * s, -.06 * s, .032], k, o, .012);
    },
  ];
  function glyph(parent, x, y, z, s, ink, form = 0) {
    const o = new T.Group(); o.position.set(x, y, z); parent.add(o);
    box(s * 1.12, s * 1.12, .055, panel, 0, 0, 0, o, .012);
    glyphForms[((form % glyphForms.length) + glyphForms.length) % glyphForms.length](o, s, ink);
    return o;
  }
  function glyphColumn(x, y, z, ink, count, s, angle = Math.PI / 2) {
    const o = g(x, y, z, angle);
    for (let i = 0; i < count; i++) glyph(o, 0, (count - 1) * s * .62 - i * s * 1.24, 0, s, ink, i);
    return o;
  }

  // The four shopfront blocks each carry a lit parapet line, a pair of corner
  // traces and a blade sign projecting over the pavement.
  const street = [
    { x: -5.15, z: -3.985, w: 2.03, d: 1.77, top: 1.60, ink: magenta, word: 'SAKE', scale: .155, drop: .50 },
    { x: -2.05, z: -4.035, w: 1.90, d: 1.87, top: 2.38, ink: cyan, word: 'RADIO', scale: .170, drop: .56 },
    { x: 1.05, z: -4.025, w: 1.95, d: 1.85, top: 1.99, ink: violet, word: 'INK', scale: .195, drop: .50 },
    { x: 4.25, z: -4.310, w: 1.78, d: 2.42, top: 2.60, ink: acid, word: 'ATELIER', scale: .150, drop: .58 },
  ];
  for (const b of street) {
    const hx = b.w / 2, hz = b.d / 2, front = b.z + hz;
    strip([b.x - hx, b.top, front], [b.x + hx, b.top, front], b.ink, staticRoot, .008);
    for (const sx of [-1, 1]) {
      strip([b.x + sx * hx, b.top, front], [b.x + sx * hx, b.top, b.z - hz], b.ink, staticRoot, .007);
      strip([b.x + sx * hx, .16, front + .012], [b.x + sx * hx, b.top, front + .012], b.ink, staticRoot, .006);
    }
    // A perpendicular blade hangs clear of the walking lanes.
    const letters = [...b.word];
    const height = letters.length * b.scale * 1.22 + .17;
    const mount = g(b.x + hx - .13, b.top - height / 2 - .05, front + b.drop / 2 - .03, Math.PI / 2);
    cabinet(mount, b.drop, height);
    for (const [i, letter] of letters.entries()) text(letter, b.scale, b.scale, mount, i % 2 ? magenta : b.ink, 0, height / 2 - .14 - i * b.scale * 1.22);
    for (const sy of [-1, 1]) strip([0, sy * height * .34, -.05], [0, sy * height * .34, -.34], m.rail, mount, .008);
  }

  // The towers carry their tube traces the full height, plus a floor band and a
  // glyph stack, so the new vertical mass reads through the haze.
  for (const [index, [anchor, ink, height, floors]] of [[site.towers[0], acid, 9.32, 6], [site.towers[1], violet, 7.68, 5]].entries()) {
    for (const sx of [-1, 1]) {
      const x = anchor[0] + sx * 1.16, z = anchor[1] + 1.03;
      strip([x, 1.62, z], [x, height, z], ink, staticRoot, .009);
    }
    for (let floor = 0; floor < floors; floor++) {
      strip([anchor[0] - 1.22, 1.60 + floor * 1.08, anchor[1] + 1.03], [anchor[0] + 1.22, 1.60 + floor * 1.08, anchor[1] + 1.03], ink, staticRoot, .005);
    }
    const tower = g(anchor[0], 0, anchor[1]);
    for (let i = 0; i < floors; i++) glyph(tower, .94, 2.06 + i * 1.08, .97, .34, i % 2 ? cyan : magenta, i + index * 2);
    strip([anchor[0] - 1.24, 1.58, anchor[1] + 1.06], [anchor[0] + 1.24, 1.58, anchor[1] + 1.06], ink, staticRoot, .008);
  }

  // The Galleria lantern is traced in cyan, with an acid hour board beneath it.
  const mallTop = site.mall[1] + 1.70;
  strip([site.mall[0] - .76, 4.34, mallTop], [site.mall[0] + .76, 4.34, mallTop], cyan, staticRoot, .009);
  for (const sx of [-1, 1]) strip([site.mall[0] + sx * .76, 2.76, mallTop], [site.mall[0] + sx * .76, 4.34, mallTop], cyan, staticRoot, .008);
  const hours = g(site.mall[0], 3.72, site.mall[1] + 1.92, Math.PI / 2);
  cabinet(hours, .46, 1.34);
  for (const [i, letter] of [...'OPEN'].entries()) text(letter, .19, .19, hours, i % 2 ? acid : cyan, 0, .44 - i * .27);
  strip([-.19, -.60, .056], [.19, -.60, .056], acid, hours, .007);

  // Two colour-matched columns bracket back to the walls they belong to: one off
  // the arcade's front, one off the Galleria's east wing facing the square.
  glyphColumn(site.arcade[0] + .16, 2.42, site.arcade[1] + 1.324, acid, 2, .40);
  for (const dy of [.248, -.248]) rod([site.arcade[0] + .16, 2.42 + dy, -6.81], [site.arcade[0] + .16, 2.42 + dy, -6.68], .012, m.rail, staticRoot);
  glyphColumn(site.mall[0] + 2.314, 1.62, site.mall[1], cyan, 2, .40, 0);

  // Scrawled tags sit on solid wall, proud of the render by a few millimetres.
  const tags = [
    [-6.02, .42, -3.08, 0, 'NO SIGNAL', .62, .10, magenta, 0],
    [-.94, .58, -3.08, 0, 'WIRED', .46, .11, acid, 0],
    [2.02, .40, -3.06, 0, '24H', .34, .12, amber, 0],
    [5.20, .66, -5.02, Math.PI / 2, 'ALLEY', .50, .11, violet, 0],
    [-11.42, 1.10, -3.02, 0, 'LOST CAT', .58, .10, cyan, 0],
  ];
  for (const [x, y, z, angle, value, w, h, ink] of tags) text(value, w, h, g(x, y, z, angle), ink, 0, 0, .012).castShadow = false;

  // Neon chevrons point down the two service lanes.
  for (const [x, z, dir, ink] of [[-3.62, .42, 1, amber], [2.62, -1.98, -1, cyan], [5.06, 3.94, 1, violet]]) {
    const o = g(x, .30, z, dir > 0 ? 0 : Math.PI);
    for (let i = 0; i < 2; i++) {
      strip([-.11, .09, i * .10 - .05], [.11, 0, i * .10 - .05], ink, o, .012);
      strip([-.11, -.09, i * .10 - .05], [.11, 0, i * .10 - .05], ink, o, .012);
    }
  }

  // Strips laid into the paving draw the eye along both promenades.
  for (const [x0, z0, x1, z1, ink] of [[-11.5, -1.34, 5.30, -1.34, cyan], [-11.5, 3.62, 5.06, 3.62, violet], [-10.30, -2.40, -8.60, -2.40, magenta]]) {
    strip([x0, WALK_Y + .004, z0], [x1, WALK_Y + .004, z1], ink, staticRoot, .012);
  }
  // Lit kerbs carry the same colour out to the carriageways, so the island
  // reads as a lit object rather than a dark silhouette against the tarmac.
  for (const [a, b, ink] of [
    [[-11.60, .076, 4.72], [-.62, .076, 4.72], cyan],
    [[1.02, .076, 4.72], [5.08, .076, 4.72], cyan],
    [[-11.60, .076, 6.64], [-.62, .076, 6.64], violet],
    [[1.02, .076, 6.64], [7.68, .076, 6.64], violet],
    [[5.60, .076, 3.94], [5.60, .076, -9.38], magenta],
    [[7.16, .076, 4.66], [7.16, .076, -9.38], amber],
  ]) strip(a, b, ink, staticRoot, .008);

  return { signs };
}