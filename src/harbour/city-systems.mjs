import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_LAYOUT as site, CITY_BOUNDS as bounds } from './layout.mjs';
import { letteringGeometry } from './cyberpunk.mjs';
import { WALK_Y } from './pedestrian.mjs';

export function addCitySystems({ root, staticRoot, mesh, box, cyl, sphere, rod, tube, torus, m, material, cyberpunk }) {
  const { cyan, magenta, amber, violet, acid } = cyberpunk.materials;
  const text = (value, w, h, x, y, z, parent, ink = cyan) => { const o = mesh(letteringGeometry(value, w, h), ink, x, y, z, parent); o.castShadow = false; return o; };
  const strip = (a, b, ink, parent, r = .008) => { const o = rod(a, b, r, ink, parent); o.castShadow = false; return o; };
  function group(anchor, x, y, z, parent = staticRoot) { const g = new T.Group(); g.position.set(anchor[0] + x, y, anchor[1] + z); parent.add(g); return g; }

  // The large animated ad is fixed to the mall's right retail wing.
  const ad = group(site.mall, 1.40, 3.70, 1.81);
  box(1.34, 1.48, .12, m.dark, 0, 0, 0, ad, .024);
  for (const x of [-.68, .68]) box(.026, 1.52, .15, m.metal, x, 0, 0, ad, .005);
  for (const y of [-.75, .75]) box(1.38, .026, .15, m.metal, 0, y, 0, ad, .005);
  for (const x of [-.47, .47]) rod([x, -.72, -.035], [x, -.86, -.31], .023, m.rail, ad);
  const content = group(site.mall, 1.40, 3.70, 1.887, root);
  const emblem = new T.Group(); emblem.position.y = .29; content.add(emblem);
  const loop = torus(.30, .014, cyan, 0, 0, 0, emblem); loop.scale.y = .65; loop.rotation.z = .55; loop.castShadow = false;
  const second = torus(.22, .012, magenta, 0, 0, .006, emblem); second.scale.y = .62; second.rotation.z = -.55; second.castShadow = false;
  sphere(.04, .04, .016, amber, .26, .10, .02, emblem).castShadow = false;
  const adFrames = [];
  for (const words of [['AFTER', 'HOURS'], ['NIGHT', 'MARKET'], ['NEON', 'DISTRICT']]) {
    const frame = new T.Group(); content.add(frame);
    text(words[0], 1.07, .20, 0, -.16, .01, frame);
    text(words[1], 1.07, .20, 0, -.40, .01, frame, magenta); adFrames.push(frame);
  }
  text('LANTERN / 24', .74, .06, 0, -.65, .078, ad, amber);

  // New canopies and service layers attach to the existing shop structure.
  for (const [anchor, w, y, z] of [[site.books, 1.79, 1.34, 1.21], [site.studio, 1.56, 1.32, 1.48]]) {
    const canopy = group(anchor, 0, y, z);
    box(w, .057, .64, m.metal, 0, 0, 0, canopy, .012);
    for (const x of [-w * .43, w * .43]) rod([x, -.02, .26], [x, .38, -.30], .013, m.rail, canopy);
    for (let i = 0; i < 8; i++)box(.032, .034, .53, m.copper, -w * .42 + i * w * .12, -.039, 0, canopy, .006);
    box(w * .85, .012, .018, anchor === site.books ? cyan : magenta, 0, -.045, .31, canopy, .003).castShadow = false;
  }
  const service = group(site.apartments, -1.006, 0, -.17);
  box(.13, .46, .43, m.metal, 0, .92, 0, service, .02);
  for (const z of [-.12, .12]) tube([[0, .27, z], [0, 1.44, z], [.20, 2.31, z]], .018, m.rail, service, 14);
  for (const y of [.50, 1.15, 1.66, 2.08]) box(.044, .023, .40, m.rail, .018, y, .0, service, .003);
  for (const [a, b] of [[site.diner, site.apartments], [site.books, site.studio]]) {
    const z = -4.90;
    tube([[a[0] + .81, 2.07, z], [(a[0] + b[0]) / 2, 1.88, z], [b[0] - .76, 2.10, z]], .012, m.dark, staticRoot, 20);
    tube([[a[0] + .81, 2.10, z - .035], [(a[0] + b[0]) / 2, 1.93, z - .035], [b[0] - .76, 2.14, z - .035]], .006, m.rail, staticRoot, 20);
  }
  // A service drop leaves the arcade mast high enough to clear its own signage.
  const mast = [site.arcade[0] + .34, 4.52, site.arcade[1] + .55];
  tube([[mast[0], mast[1], mast[2]], [mast[0] + .06, 3.52, -6.44], [site.studio[0] + .77, 2.99, -5.66]], .011, m.dark, staticRoot, 20);
  tube([[mast[0] + .02, mast[1] + .05, mast[2] + .03], [mast[0] + .07, 3.57, -6.44], [site.studio[0] + .79, 3.03, -5.66]], .005, m.rail, staticRoot, 20);

  // Overhead cabling ties the block together. Each span sags, bows out into the
  // square rather than lying flat on the render, and carries hanging bulbs that
  // share the signage inks. Nothing here needs a light of its own.
  const spans = [
    { a: [-11.05, 2.60, -3.06], b: [-8.05, 2.62, -3.06], sag: .26, bulbs: true },
    { a: [-8.05, 2.62, -3.06], b: [-5.15, 1.66, -3.06], sag: .30, bulbs: true },
    { a: [-5.15, 1.66, -3.06], b: [-2.05, 2.42, -3.06], sag: .34, bulbs: true },
    { a: [-2.05, 2.42, -3.06], b: [1.05, 2.02, -3.06], sag: .32, bulbs: true },
    { a: [1.05, 2.02, -3.06], b: [4.25, 2.68, -3.06], sag: .34, bulbs: true },
    { a: [-5.15, 4.56, -6.50], b: [-2.24, 3.48, -4.05], sag: .42, bulbs: false },
    { a: [-2.24, 3.48, -4.05], b: [1.45, 4.56, -6.53], sag: .44, bulbs: false },
    { a: [4.25, 2.66, -3.40], b: [4.58, 3.50, -6.60], sag: .50, bulbs: true },
  ];
  const bulbs = [cyan, magenta, amber, violet, acid];
  for (const span of spans) {
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, bow = .24 * Math.sin(Math.PI * t);
      points.push([
        span.a[0] + (span.b[0] - span.a[0]) * t,
        span.a[1] + (span.b[1] - span.a[1]) * t - span.sag * Math.sin(Math.PI * t),
        span.a[2] + (span.b[2] - span.a[2]) * t + bow,
      ]);
    }
    tube(points, .011, m.dark, staticRoot, 26);
    tube(points.map(p => [p[0], p[1] + .021, p[2]]), .005, m.rail, staticRoot, 26);
    if (!span.bulbs) continue;
    for (let i = 2; i <= 8; i += 2) {
      const p = points[i];
      rod([p[0], p[1], p[2]], [p[0], p[1] - .13, p[2]], .005, m.rail, staticRoot);
      sphere(.040, .048, .040, bulbs[(i / 2) % bulbs.length], p[0], p[1] - .176, p[2]).castShadow = false;
    }
  }
  // Short bundles clamped down the shopfronts keep the walls from reading clean.
  for (const [x, y, z, h, ink] of [[-.86, 1.86, -2.94, 1.70, magenta], [2.62, 1.62, -2.94, 1.46, violet], [-6.02, 1.34, -2.92, 1.18, cyan]]) {
    const bundle = group([x, z], 0, y, 0);
    for (const dx of [-.036, 0, .036]) tube([[dx, h / 2, 0], [dx, 0, -.02], [dx, -h / 2, 0]], .012, dx ? m.rail : m.dark, bundle, 12);
    for (const at of [.26, -.26]) box(.155, .026, .05, m.metal, 0, at, -.014, bundle, .006);
    strip([0, -h / 2 - .02, .012], [0, -h / 2 - .06, .012], ink, bundle, .007);
  }

  // An illuminated arrival display shares the bus shelter's existing frame.
  const board = group(site.busStop, .58, 1.05, -.025); board.rotation.y = Math.PI;
  box(.43, .47, .055, m.dark, 0, 0, 0, board, .018);
  text('07 / EAST', .35, .062, 0, .15, .032, board);
  text('MIN', .15, .055, .075, -.155, .032, board, amber);
  const reverse = new T.Group(); reverse.rotation.y = Math.PI; board.add(reverse);
  text('07 / EAST', .35, .062, 0, .15, .032, reverse);
  text('MIN', .15, .055, .075, -.155, .032, reverse, amber);
  const arrivals = group(site.busStop, .58, 1.05, -.061, root); arrivals.rotation.y = Math.PI;
  const arrivalsBack = group(site.busStop, .58, 1.05, .004, root);
  const digits = [];
  const digitSegments = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
  for (const x of [-.083, .083]) {
    const segments = {};
    for (const [name, dx, dy, horizontal] of [['a', 0, .073, true], ['b', .046, .036, false], ['c', .046, -.043, false], ['d', 0, -.080, true], ['e', -.046, -.043, false], ['f', -.046, .036, false], ['g', 0, -.004, true]]) {
      segments[name] = box(horizontal ? .081 : .013, horizontal ? .013 : .063, .005, amber, x + dx, dy, .003, arrivals, .003); segments[name].castShadow = false;
      const reverse = segments[name].clone(); arrivalsBack.add(reverse); segments[name].userData.reverse = reverse;
    }
    digits.push(segments);
  }

  // A compact ducted quadcopter makes occasional deliveries over the open plaza.
  const drone = new T.Group(); drone.name = 'Night courier'; root.add(drone);
  sphere(.18, .07, .24, m.metal, 0, .015, 0, drone);
  sphere(.12, .047, .15, m.sage, 0, .061, -.02, drone);
  box(.24, .13, .25, m.cream, 0, -.109, -.015, drone, .027);
  for (const x of [-.083, .083]) box(.013, .137, .257, m.metal, x, -.107, -.015, drone, .004);
  const rotors = [];
  for (const x of [-.29, .29]) for (const z of [-.24, .24]) {
    rod([x * .35, .025, z * .3], [x, .035, z], .022, m.metal, drone);
    const duct = torus(.12, .018, m.metal, x, .041, z, drone); duct.rotation.x = -Math.PI / 2;
    cyl(.029, .061, m.rail, x, .043, z, drone, .027, 12);
    const rotor = new T.Group(); rotor.position.set(x, .073, z); drone.add(rotor); rotors.push(rotor);
    box(.205, .009, .024, m.rail, 0, 0, 0, rotor, .011);
    for (const s of [-1, 1]) rod([x, .013, z], [x + s * .085, .014, z], .007, m.metal, drone);
  }
  sphere(.023, .021, .028, magenta, -.181, .025, .055, drone).castShadow = false;
  sphere(.023, .021, .028, cyan, .181, .025, .055, drone).castShadow = false;
  // Merge the courier's rigid shell by material; only its rotors need their own transforms.
  drone.updateMatrixWorld(true);
  const parts = new Map();
  for (const child of [...drone.children]) {
    if (rotors.includes(child)) continue;
    const key = `${child.material.uuid}:${child.castShadow}`;
    if (!parts.has(key)) parts.set(key, { material: child.material, shadow: child.castShadow, geometry: [] });
    const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
    parts.get(key).geometry.push(geometry.index ? geometry.toNonIndexed() : geometry);
    drone.remove(child);
  }
  for (const part of parts.values()) {
    const combined = mesh(mergeGeometries(part.geometry, false), part.material, 0, 0, 0, drone); combined.castShadow = part.shadow;
    part.geometry.forEach(g => g.dispose());
  }
  const flight = new T.CatmullRomCurve3([[-12.6, 2.65, 3.8], [-9, 2.4, 3.9], [-5.5, 2.75, 1.1], [-1.6, 3.3, -.3], [2.8, 3.0, 1.0], [5.3, 2.6, 5.4], [8.5, 2.7, 6.2]].map(p => new T.Vector3(...p)), false, 'centripetal');

  const vapor = material('#e2eaf2', { transparent: true, opacity: .10, depthWrite: false, roughness: 1 });
  const plumes = [];
  for (const [x, z] of [[-8.12, 4.48], [5.30, -1.80], [4.20, -6.40], [-7.05, -2.85], [-3.55, -2.80], [2.40, -2.85]]) {
    box(.35, .014, .21, m.dark, x, WALK_Y + .005, z, staticRoot, .016);
    for (let i = 0; i < 6; i++)box(.017, .016, .17, m.rail, x - .137 + i * .055, WALK_Y + .016, z, staticRoot, .003);
    for (let i = 0; i < 7; i++) {
      const puff = sphere(.1, .1, .1, vapor, x, WALK_Y, z, root); puff.castShadow = false; plumes.push({ puff, x, z, phase: i / 7 });
    }
  }
  // A holographic emblem turns above the water court. It needs no lamp and the
  // three rings share one geometry, so the whole display costs a single batch.
  const holo = new T.MeshBasicMaterial({ color: '#a6f2ff', transparent: true, opacity: .24, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  holo.name = 'Hologram · additive';
  const holoRig = new T.Group(); holoRig.name = 'Water-court hologram'; holoRig.position.set(site.water[0], 3.15, site.water[1]); root.add(holoRig);
  const holoRing = new T.TorusGeometry(.62, .011, 6, 44);
  const holoRings = [[1, 1.25, 0, 0], [.78, -.55, .4, .5], [.54, 0, 1.1, -.4]].map(([scale, rx, ry, rz]) => {
    const ring = new T.Mesh(holoRing, holo); ring.scale.setScalar(scale); ring.rotation.set(rx, ry, rz); holoRig.add(ring); return ring;
  });

  let arrival = 0, advertisement = 0;
  function animate(time) {
    advertisement = Math.floor(time / 10) % adFrames.length; adFrames.forEach((frame, i) => frame.visible = i === advertisement);
    holoRig.rotation.y = time * .30;
    holoRings[0].rotation.z = time * .50;
    holoRings[1].rotation.x = -.55 + Math.sin(time * .70) * .32;
    holoRings[2].rotation.y = time * -.85;
    holo.opacity = .30 + .07 * Math.sin(time * 1.9) + .05 * Math.sin(time * 12.7);
    emblem.rotation.z = Math.sin(time * .31) * .22; emblem.scale.setScalar(.98 + Math.sin(time * .60) * .02);
    arrival = 3 - Math.floor(time / 12) % 4;
    digits.forEach((segments, index) => { const active = digitSegments[index === 0 ? 0 : arrival]; for (const [name, mesh] of Object.entries(segments)) { mesh.visible = active.includes(name); mesh.userData.reverse.visible = mesh.visible; } });
    // CatmullRomCurve3.getPointAt throws for anything outside [0, 1], and a throw
    // inside the animation loop stops three from ever rescheduling it, so the whole
    // world would go black. Clamp rather than trust the clock.
    const phase = time % 90, t = Math.min(1, Math.max(0, phase / 54)), position = flight.getPointAt(t), direction = flight.getTangentAt(t);
    drone.position.copy(position); drone.position.y += Math.sin(time * 2.4) * .025;
    drone.rotation.set(Math.sin(time * .5) * .025, Math.atan2(direction.x, direction.z), Math.sin(time * .8) * .045);
    drone.visible = phase < 54 && position.x > bounds.minX + .45 && position.x < bounds.maxX - .45;
    rotors.forEach((rotor, i) => rotor.rotation.y = time * (i % 2 ? 74 : -74));
    for (const { puff, x, z, phase: offset } of plumes) {
      const t = (time * .17 + offset) % 1, envelope = Math.sin(t * Math.PI);
      puff.position.set(x + Math.sin(t * 3 + offset) * t * .22, WALK_Y + .04 + t * .86, z + t * .14);
      puff.scale.set((.055 + t * .15) * envelope, (.09 + t * .19) * envelope, (.07 + t * .14) * envelope);
    }
  }
  animate(0);
  return { drone, flight, rotors, ad, adFrames, plumes, animate, get arrival() { return arrival; }, get advertisement() { return advertisement; } };
}
