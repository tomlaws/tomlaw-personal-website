import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// An elevated metro runs an L around the island's two northern coasts, out in the
// sea the whole way: a long reach up the west side from the south-west, a quarter
// turn at the corner off the island's north-west shoulder, and a long reach east
// along the north side. Held off both coasts, nothing of the line stands on the
// island, so the district needs no viaduct over its own streets and no column ever
// meets concrete. Past the middle of the run, the two tracks part company: the
// shore-side one keeps to the low deck while the outer one climbs onto a second
// level that runs on above the open water.
//
// The two trains run in opposite directions, one on each track, so they pass on
// the climb — at two different heights. There is no station: the track is the
// whole structure, and a car simply stops being drawn once it has run off the end
// of the viaduct.
//
// Cost model: every static piece reuses an existing structural material, so the
// whole viaduct adds no draw calls. All cars share two merged geometries, so the
// train fleet costs two animated batches however many cars are on the line.
export const RAIL_DECK_Y = 4.45;   // the low deck, shared by both tracks
// The sea is a platform the island stands on; the piers run down to its top face, so
// the columns meet water rather than stopping in the air.
const RAIL_HIGH_Y = 6.95;          // the second level, reached by the outer track

const WIDE = 2.70;            // the shared twin-track deck
const NARROW = 1.30;          // one deck each once the tracks part
const HALF = .70;             // track centres sit this far either side of the route
const RAIL_GAUGE = .30;       // half-gauge, so rails sit at ±gauge from centre
const ARC_STEP = .10;         // sampling of the corner, in model units
const CLIMB = 10.00;          // length of the rise onto the second level
const TAIL = 1.10;            // a car is drawn once it is fully on the viaduct
const CARS = 2;
const CAR_PITCH = 2.30;
const SPEED = 2.35;           // model units per second

export function buildElevatedRail({ root, staticRoot, box, cyl, sphere, rod, m, inks, place, rememberPlacement, seaLevel, seaFloor }) {
  // The line keeps two lights of its own: ice under the deck, amber down at the water.
  // The sign layer's pink is left to the signs — rose lamps on railway piers read as
  // decoration rather than infrastructure — and the amber holds the same pastel warmth on
  // a colour that real railway lighting actually uses.
  const { cyan, amber } = inks;

  // ---- route ----------------------------------------------------------------
  // The centreline is an L held out in the sea, following the island's two northern
  // coasts: up the west side, round a quarter turn, then east along the north side.
  // The island's plate reaches x −11.95 and z −10.95, so a line held 1.45 clear of
  // each keeps every part of it — deck and column alike — off the island. Both
  // tracks sit either side of the centreline; the only thing that changes at the
  // split, part way round the corner, is that they stop sharing a deck and the outer
  // one starts to climb.
  const WEST_X = -13.40;                       // 1.45 clear of the island's west edge
  const HULL_Z = -13.40;                       // and 2.45 clear of its north edge
  const CORNER_R = 1.90;                       // radius of the quarter turn between them
  const WEST_A = [WEST_X, 6.60];               // the line's southern end, off the west flank
  const WEST_B = [WEST_X, HULL_Z + CORNER_R];  // where the turn begins
  const ARC_C = [WEST_X + CORNER_R, WEST_B[1]];// centre of that turn
  const ARC_END = [ARC_C[0], HULL_Z];          // where it comes out, heading east
  const SPLIT_AT = [-6.00, HULL_Z];            // the two tracks part along the north reach
  const NORTH_B = [10.80, HULL_Z];             // the line's eastern end, inside the sea plate

  // The centreline is sampled flat; the second level is a height profile along it.
  const path = [];
  let total = 0;
  function push(x, z, th, kind) {
    if (path.length) total += Math.hypot(x - path[path.length - 1].x, z - path[path.length - 1].z);
    path.push({ x, z, th, kind, s: total });
  }
  // A box whose long axis is local X points along (cos th, 0, -sin th).
  function sampleLine([x0, z0], [x1, z1], step) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(len / step)), th = Math.atan2(-dz, dx);
    for (let i = path.length ? 1 : 0; i <= n; i++) { const t = i / n; push(x0 + dx * t, z0 + dz * t, th, 'line'); }
  }
  // A quarter turn swept from `from` to `to` round the centre, carried by angle
  // rather than by hand so the tangents at both ends meet the straight reaches
  // exactly. th is the heading a box's long axis needs to sit along that tangent.
  function sampleArc([cx, cz], r, from, to) {
    const n = Math.max(2, Math.round((Math.abs(to - from) * r) / ARC_STEP));
    for (let i = 1; i <= n; i++) {
      const a = from + (to - from) * (i / n);
      push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)), 'arc');
    }
  }
  sampleLine(WEST_A, WEST_B, 2.20);
  sampleArc(ARC_C, CORNER_R, Math.PI, Math.PI * 1.5);
  sampleLine(ARC_END, SPLIT_AT, 2.20);
  const SPLIT_S = total;          // where the two tracks stop sharing a deck
  sampleLine(SPLIT_AT, NORTH_B, 2.20);

  function at(s) {
    if (s <= 0) return path[0];
    if (s >= total) return path[path.length - 1];
    let lo = 0, hi = path.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (path[mid].s <= s) lo = mid; else hi = mid; }
    const a = path[lo], b = path[hi], span = b.s - a.s, t = span ? (s - a.s) / span : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, th: a.th + (b.th - a.th) * t };
  }

  // The second level runs flat, then climbs, then runs flat again. The rise is an
  // eased curve rather than a straight ramp: a real line enters a gradient through
  // a vertical curve, and it means the deck leans out of the flat corner instead
  // of hinging at it.
  const RISE = RAIL_HIGH_Y - RAIL_DECK_Y;
  const eased = t => t * t * (3 - 2 * t);
  const climbT = s => Math.min(Math.max((s - SPLIT_S) / CLIMB, 0), 1);
  const highY = s => RAIL_DECK_Y + RISE * eased(climbT(s));
  // The gradient is the derivative of that same curve, so the cars tilt smoothly
  // through the climb rather than snapping to a fixed angle at either end.
  const highPitch = s => { const t = climbT(s); return t <= 0 || t >= 1 ? 0 : Math.atan(RISE * 6 * t * (1 - t) / CLIMB); };

  // ---- deck -----------------------------------------------------------------
  // A deck piece carries its slab, its fences, the under-deck neon and the rails
  // and contact wire of however many tracks it holds. `sides` names the edges that
  // carry a fence: the shared deck fences both edges, and each single-track deck
  // fences only its outer edge, so the line reads as one fence per side the whole
  // way instead of growing a doubled pair once the decks part.
  function deckPiece(parent, len, width, tracks, sides) {
    // The track bed is the near-white of the road markings rather than the train-shell
    // white: m.marking is already carried by static geometry, so the deck stays inside a
    // batch that exists, where m.white is animated-only and reaching for it would spend the
    // one remaining draw call.
    box(len, .22, width, m.marking, 0, 0, 0, parent, 0);
    box(len, .36, .20, m.metal, 0, -.30, 0, parent, 0);
    const edge = width / 2 - .06;
    for (const sz of sides) {
      // A handrail carried on posts, not a solid parapet: a slab walled in along both
      // edges reads as a road bridge taking traffic, which is the one thing this line
      // is not.
      box(len, .05, .05, m.metal, 0, .58, sz * edge, parent, .01);
      const posts = Math.max(2, Math.round(len / 1.60));
      for (let i = 0; i <= posts; i++)
        box(.06, .62, .06, m.metal, -len / 2 + (len / posts) * i, .30, sz * edge, parent, .01);
      box(len * .99, .03, .05, sz < 0 ? cyan : amber, 0, -.16, sz * (edge + .01), parent, 0).castShadow = false;
    }
    for (const centre of tracks) {
      // The rails stand on a ladder of sleepers laid across the deck. That ladder is the
      // whole difference between a pair of lines reading as track and reading as paint
      // on a road, so it is laid at a fixed pitch and spaced to fit whatever length of
      // deck this is — the climb is swept from many short pieces and needs ties just as
      // much as the long straights do.
      const ties = Math.max(1, Math.round(len / .55));
      for (let i = 0; i < ties; i++)
        box(.17, .05, RAIL_GAUGE * 2 + .30, m.dark, ties === 1 ? 0 : -len / 2 + (len / ties) * (i + .5), .13, centre, parent, .012);
      for (const sz of [centre - RAIL_GAUGE, centre + RAIL_GAUGE])
        box(len, .07, .11, m.rail, 0, .20, sz, parent, .015);
      box(len, .022, .022, m.rail, 0, 1.28, centre, parent, 0).castShadow = false;
    }
  }
  function deckRun([x0, z0], [x1, z1], y0, y1, width, tracks, sides, stretch = 1) {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) * stretch;
    const shell = new T.Group();
    shell.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    shell.rotation.y = Math.atan2(-dz, dx);
    staticRoot.add(shell);
    const pitched = new T.Group();
    pitched.rotation.z = Math.atan2(y1 - y0, len);
    shell.add(pitched);
    deckPiece(pitched, len, width, tracks, sides);
    // Cross-bracing under the slab reads as structure rather than a plain beam.
    for (let i = 0; ; i++) {
      const x = -len / 2 + 1.2 + i * 2.4;
      if (x > len / 2 - .5) break;
      box(.14, .34, width - .08, m.metal, x, -.30, 0, pitched, 0);
    }
  }
  const BOTH = [-HALF, HALF], SINGLE = [0];
  const OUTER = [-1, 1], SEAWARD = [-1], SHORE = [1];
  const onRoute = (s, side) => { const p = at(s); return [p.x + Math.sin(p.th) * side, p.z + Math.cos(p.th) * side]; };
  deckRun(WEST_A, WEST_B, RAIL_DECK_Y, RAIL_DECK_Y, WIDE, BOTH, OUTER);
  // Only the turn is segmented, so the sweep shows no seam; the two straight reaches
  // are single boxes. Each piece is lifted a hair more than the last so no two of
  // those overlapping faces are coplanar: coincident surfaces z-fight in the browser
  // and render black in Cycles.
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i], q = path[i + 1];
    if (p.kind !== 'arc') continue;
    const g = new T.Group();
    g.position.set((p.x + q.x) / 2, RAIL_DECK_Y + i * .0008, (p.z + q.z) / 2);
    g.rotation.y = p.th;
    staticRoot.add(g);
    deckPiece(g, Math.hypot(q.x - p.x, q.z - p.z) * 1.16 + .05, WIDE, BOTH, OUTER);
  }
  deckRun(ARC_END, SPLIT_AT, RAIL_DECK_Y, RAIL_DECK_Y, WIDE, BOTH, OUTER);
  // Past the split the decks go their own ways: the shore-side track keeps the low
  // level the whole way, while the seaward one climbs onto the second level over the
  // same reach and then runs on level to the end. Each deck fences only its outboard
  // edge, so the line reads as one fence per side instead of a doubled pair.
  deckRun(onRoute(SPLIT_S, HALF), onRoute(total, HALF), RAIL_DECK_Y, RAIL_DECK_Y, NARROW, SINGLE, SHORE);
  // The climb is swept as short pieces along its own eased curve, so it reads as a
  // curve rather than a ramp and the fences follow the slope without hinging. The
  // pieces overlap by a few percent, which hides the joints as well.
  const STEPS = 22, STEP = CLIMB / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const a = SPLIT_S + i * STEP, b = a + STEP;
    deckRun(onRoute(a, -HALF), onRoute(b, -HALF), highY(a), highY(b), NARROW, SINGLE, SEAWARD, 1.06);
  }
  deckRun(onRoute(SPLIT_S + CLIMB, -HALF), onRoute(total, -HALF), RAIL_HIGH_Y, RAIL_HIGH_Y, NARROW, SINGLE, SEAWARD);

  // ---- piers ----------------------------------------------------------------
  // The deck carries itself between supports, so the spans are wide and the line
  // needs only eight of them along its whole length. Each pier is a single column
  // standing in the sea that carries both decks: a transverse cap under the low deck,
  // and — once the outer deck has risen clear of it — a second cap up on two short
  // struts. That is a real two-level viaduct in one row of columns rather than two,
  // and because each pier is set on the route and turned to the heading there, the
  // same one column works round the turn as well as on the straights.
  const PIER_S = [2.80, 8.60, 14.40, 20.00, 25.60, 31.20, 36.80, 41.60];
  const lowCap = RAIL_DECK_Y - .32;
  for (const s of PIER_S) {
    const p = at(s);
    const top = highY(s);
    const stacked = top - RAIL_DECK_Y > .55;
    const g = new T.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.th; staticRoot.add(g);
    // The column runs down to the sea plane and simply ends there. No plinth and no
    // footing: nothing man-made breaks the waterline, so the pier reads as standing
    // in the sea rather than resting on a quay.
    // The column runs the full depth of the water, from the deck down to the floor of the
    // well, so it is seen standing through the sea rather than stopping at its surface.
    const foot = seaFloor - .10;
    const head = stacked ? top - .42 : lowCap - .10;
    cyl(.20, head - foot, m.stone, 0, (head + foot) / 2, 0, g, .17, 12);
    box(.62, .20, WIDE + .10, m.metal, 0, lowCap, 0, g, .02);
    for (const sz of [-1, 1]) rod([0, lowCap - .62, sz * .16], [0, lowCap - .10, sz * .96], .035, m.metal, g);
    if (stacked) {
      box(.62, .20, NARROW + .10, m.metal, 0, top - .32, -HALF, g, .02);
      if (top - RAIL_DECK_Y > 1.0) for (const sz of [-1.16, -.24]) rod([0, lowCap + .10, sz], [0, top - .42, sz], .055, m.metal, g);
    }
    // Bands of light: one on the column just under the deck, and one down near the
    // bottom, at the height the water would read as.
    cyl(.235, .05, cyan, 0, lowCap - .17, 0, g, .235, 14).castShadow = false;
    cyl(.245, .04, amber, 0, seaLevel + .22, 0, g, .245, 14).castShadow = false;
    rememberPlacement('Elevated rail pier', g);
  }

  // ---- catenary -------------------------------------------------------------
  // On the shared deck one centre mast carries both contact wires. Once the decks
  // part, each has its own mast on its inner edge — and the two of them standing
  // at different heights is what makes the second level read as a second level.
  function centreMast(g, y) {
    const post = new T.Group(); post.position.set(0, y, 0); g.add(post);
    cyl(.05, 1.86, m.rail, 0, .93, 0, post, .042, 8);
    for (const sz of [-1, 1]) {
      rod([0, 1.80, 0], [0, 1.28, sz * HALF], .026, m.rail, post);
      cyl(.026, .18, m.dark, 0, 1.24, sz * HALF * .74, post, .026, 8);
      sphere(.05, .055, .05, m.warm, 0, 1.08, sz * HALF * .74, post).castShadow = false;
    }
  }
  function sideMast(g, z, y, wire) {
    const post = new T.Group(); post.position.set(0, y, z); g.add(post);
    const reach = wire - z;
    cyl(.045, 1.58, m.rail, 0, .79, 0, post, .038, 8);
    rod([0, 1.52, 0], [0, 1.28, reach], .026, m.rail, post);
    cyl(.026, .18, m.dark, 0, 1.24, reach * .74, post, .026, 8);
    sphere(.05, .055, .05, m.warm, 0, 1.08, reach * .74, post).castShadow = false;
  }
  for (const s of [3.20, 7.80, 12.40, 17.00, 21.60, 26.20, 30.80, 35.40, 40.00, 44.60]) {
    if (s >= total - .8) continue;
    const p = at(s);
    const g = new T.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.th; staticRoot.add(g);
    if (s < SPLIT_S) centreMast(g, RAIL_DECK_Y);
    else { sideMast(g, -.15, highY(s), -HALF); sideMast(g, .15, RAIL_DECK_Y, HALF); }
  }

  // ---- trains ---------------------------------------------------------------
  // One merged shell and one merged glow body are shared by every car on the
  // line, so the entire fleet costs two animated batches.
  const shellGeometry = mergeGeometries([
    new T.BoxGeometry(2.10, .58, 1.00).translate(0, .46, 0),
    new T.BoxGeometry(2.06, .08, .88).translate(0, .79, 0),
    new T.BoxGeometry(2.02, .10, .80).translate(0, .12, 0),
    new T.BoxGeometry(.32, .18, .92).translate(1.00, .32, 0),
    new T.BoxGeometry(.32, .18, .92).translate(-1.00, .32, 0),
    new T.BoxGeometry(.40, .20, 1.04).translate(.72, .09, 0),
    new T.BoxGeometry(.40, .20, 1.04).translate(-.72, .09, 0),
  ], false);
  const glowGeometry = mergeGeometries([
    new T.BoxGeometry(1.76, .20, .03).translate(0, .55, .515),
    new T.BoxGeometry(1.76, .20, .03).translate(0, .55, -.515),
    new T.BoxGeometry(.22, .10, .05).translate(1.14, .44, .32),
    new T.BoxGeometry(.22, .10, .05).translate(1.14, .44, -.32),
    new T.BoxGeometry(.05, .14, .54).translate(1.145, .76, 0),
    new T.BoxGeometry(.18, .10, .04).translate(-1.13, .46, 0),
  ], false);

  // dir +1 runs with the path on the east track, dir -1 runs against it on the
  // west track, so the two services pass rather than chase. The west track is the
  // one that climbs, so they pass at two heights once the decks part.
  const trains = [];
  for (const [offset, dir] of [[5.0, 1], [9.0, -1]]) {
    const group = new T.Group(); group.name = 'Elevated service train'; root.add(group);
    const cars = [];
    for (let i = 0; i < CARS; i++) {
      const car = new T.Group(); group.add(car);
      // Cars climb with the deck, so the shell sits in its own pitched group.
      const tilt = new T.Group(); car.add(tilt);
      const shell = new T.Mesh(shellGeometry, m.white);
      shell.castShadow = true; shell.receiveShadow = true; tilt.add(shell);
      const glow = new T.Mesh(glowGeometry, m.warm);
      // The car's own yaw already faces this service the right way, so the nose
      // lamps need no extra flip.
      glow.castShadow = false; tilt.add(glow);
      cars.push({ car, tilt });
    }
    trains.push({ offset, dir, cars });
  }

  const travel = total - 2 * TAIL + (CARS - 1) * CAR_PITCH;
  function animate(time) {
    for (const train of trains) {
      const phase = ((train.offset + time * SPEED) % travel + travel) % travel;
      const high = train.dir < 0;          // the west track is the one that climbs
      for (const [i, entry] of train.cars.entries()) {
        const s = train.dir > 0
          ? TAIL + phase - i * CAR_PITCH
          : total - TAIL - phase + i * CAR_PITCH;
        // Only draw a car once it is fully on the viaduct.
        const visible = s > TAIL && s < total - TAIL;
        entry.car.visible = visible;
        if (!visible) continue;
        const p = at(s);
        // Sit the car on its own track: the same world side of the route for the
        // with-path service, the opposite side for the against-path one.
        const perp = train.dir > 0 ? HALF : -HALF;
        entry.car.position.set(p.x + Math.sin(p.th) * perp, (high ? highY(s) : RAIL_DECK_Y) - .05, p.z + Math.cos(p.th) * perp);
        entry.car.rotation.y = p.th + (train.dir > 0 ? 0 : Math.PI);
        entry.tilt.rotation.z = high ? highPitch(s) : 0;
      }
    }
  }
  animate(0);

  // The line is selectable from the shore, out over the sea it runs along.
  const selection = place('The elevated line', 'Twin tracks on lit piers run an L round the island\u2019s two northern coasts, out over the sea a little way off the shore. Past the middle of the run the tracks part: the shore-side one keeps the low deck while the outer one climbs onto a second level that runs on above the water. The two night services pass each other, one track apart.', -2.0, HULL_Z, 4.4, 5.6);
  selection.userData.focusZoom = 1.55;

  return { animate, trains, piers: PIER_S.length, length: total, high: RAIL_HIGH_Y };
}
