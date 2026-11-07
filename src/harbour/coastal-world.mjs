import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { archShape } from './interiors.mjs';
import { coastalRoad } from './coastal-road.mjs';
import { buildHarborBoat } from './harbor-boats.mjs';
import { createHKCEC } from './hkcec.mjs';
import {createObservationWheel} from './observation-wheel.mjs';
import { createHongKongFlag } from './hong-kong-flag.mjs';
import { peakTramRoute, createPeakTram } from './peak-tram.mjs';
import { HARBOUR_SIZE, HARBOUR_CENTER, HARBOUR_BOUNDS, placeHarbourVessels } from './harbour-layout.mjs';
import {createHarbourMotion} from './harbour-motion.mjs';
import {createHongKongVehicle} from './hk-street-vehicles.mjs';
import {prepareGlazingLight} from './glazing-light.mjs';
import {createCanopyInstances} from './canopy-instances.mjs';
import {prepareHKCECAccent} from './hkcec-lighting.mjs';
import {createPeakTower,preparePeakLighting} from './peak-tower.mjs';
import {prepareIFCCrownLight} from './ifc-crown.mjs';

// Reference-inspired coastal miniature: compact blocks, a southwest park and a harbor.
export function createWorld({ models = null } = {}) {
  const root = new T.Group(); root.name = 'Lantern Coastal Miniature';
  const fixed = new T.Group(); fixed.name = 'New construction'; root.add(fixed);
  const landRise = .45; fixed.position.y = landRise;
  const oceanRoot = new T.Group(); oceanRoot.name = 'Two-layer clear ocean'; root.add(oceanRoot);
  const materials = {}, buildings = [], windows = [], places = [], cars = [];
  // The paved surface and crust share one cream finish; inland, the planted
  // slope retains its green surface.
  const palette = {
    ground: '#e9dfc8', stone: '#dee3e6', quay: '#c3cdd2', road: '#71828f', white: '#f7f9fa',
    coastalPaving: '#e9dfc8', coastalQuay: '#e9dfc8',
    peach: '#ffbc85', rose: '#ff9cc3', blue: '#93c3f8', sage: '#90e5b3', lavender: '#d8c8f5',
    copper: '#f2c396', wood: '#f0c890', metal: '#b3cef7', tire: '#ccd1e2',
    leaf: '#91bf64', leafLight: '#badb79', leafDark: '#73a971', bark: '#a98a6b',
    soil: '#cbb79a', clay: '#f5b894', flower: '#f7a6c6', sea: '#58b9e0', seaLight: '#a3e7ef',
    warm: '#fff0c4', teal: '#b0efe3', pink: '#ffa2cc', violet: '#a97ff0', room: '#9aaeb8',
    residentialCladding: '#9a807b', signBack: '#152238',
  };
  for (const [name, color] of Object.entries(palette)) {
    materials[name] = new T.MeshStandardMaterial({ color, roughness: .72, metalness: 0 });
    materials[name].name = `Pastel ${name}`;
  }
  for (const [name, color] of [['warm', '#ffcf8a'], ['teal', '#5fd7e0'], ['pink', '#f79ac8']]) {
    materials[name].emissive.set(color); materials[name].emissiveIntensity = .5;
  }
  const m = materials;
  m.bocFrame=m.white.clone();m.bocFrame.name='BOC illuminated structural frame';
  m.bocMast=m.metal.clone();m.bocMast.name='BOC illuminated skyline masts';
  for(const finish of [m.bocFrame,m.bocMast]){finish.emissive.set('#f2f6ff');finish.emissiveIntensity=0;}
  m.ifcCrown=m.white.clone();m.ifcCrown.name='IFC floodlit pearl crown';
  m.ifcCrown.roughness=.48;m.ifcCrown.metalness=.12;
  // Window glass. A pane is a mirror first and blue second, and the colour it carries is the
  // colour of what it throws back rather than a colour of its own: pale paint on the pane is what
  // made every window read as a flat rectangle, because the reflection could never be brighter
  // than the paint it was added to. So the base colour is a deep blue, which contributes almost
  // nothing, and the metalness is high enough that the sky lands on the pane and does the work.
  // What is left of the interior behind it — a third of it, at this opacity — keeps the rooms
  // visible, and the night route hangs its interior glow off exactly this material.
  m.glass = new T.MeshPhysicalMaterial({
    color: '#79b8e8', transparent: true, opacity: .62, depthWrite: false, roughness: .05,
    metalness: .85, ior: 1.9, clearcoat: 1, clearcoatRoughness: .03, specularIntensity: 1,
    envMapIntensity: 2.2, side: T.DoubleSide,
  });
  m.hkcecRoof = new T.MeshStandardMaterial({ color: '#e9eff2', roughness: .50, metalness: .16 });
  m.hkcecRoof.name = 'HKCEC brushed aluminium';
  m.peakLouvre=m.room.clone();m.peakLouvre.name='Peak Tower recessed louvre panels';m.peakLouvre.color.set('#515a5d');
  m.peakFascia=m.stone.clone();m.peakFascia.name='Peak Tower aluminium crescent';m.peakFascia.emissive.set('#e9efff');m.peakFascia.emissiveIntensity=0;
  m.hkcecTerrace=m.white.clone();m.hkcecTerrace.name='HKCEC illuminated terrace fascias';
  m.hkcecGlass = new T.MeshPhysicalMaterial({ color: '#407b91', transparent: true, opacity: .86,
    depthWrite: false, roughness: .20, metalness: .28, clearcoat: 1, envMapIntensity: 1.25, side: T.DoubleSide });
  m.hkcecGlass.name = 'HKCEC blue-green curtain wall';
  // The panes in the district's own windows are a material of their own, because they carry a
  // gradient. On an orthographic view a flat pane throws back exactly one direction, so every
  // window on a facade comes out one flat colour — blue tiles rather than glass — and the gradient
  // is the cue that says otherwise. It is written into the pane's own vertices rather than onto a
  // texture, so it needs no UV layout, survives the round trip through Blender, and cannot be
  // defeated by a model that shipped with no UVs at all.
  m.window = m.glass.clone();
  m.window.vertexColors = true;
  const gradedPanes = new WeakSet();
  function paneGradient(pane, height) {
    const geometry = pane.geometry;
    if (gradedPanes.has(geometry)) return pane;
    gradedPanes.add(geometry);
    const position = geometry.attributes.position;
    const colour = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const up = T.MathUtils.clamp(position.getY(i) / height + .5, 0, 1);
      const shade = .40 + up * .95;
      colour[i * 3] = shade * .95;
      colour[i * 3 + 1] = shade;
      colour[i * 3 + 2] = shade * 1.08;
    }
    geometry.setAttribute('color', new T.BufferAttribute(colour, 3));
    return pane;
  }
  // Curtain-wall glass is brighter the higher up it is, because what it throws back is the sky above
  // and the ground in front of it: a point low on a facade reflects the street and the buildings
  // opposite, and the higher you look the more sky is in the mirror. A wall in these models is only
  // two vertices tall, so the fall cannot be shown by the shape; it is written into the vertices,
  // and a colour per vertex interpolates the whole way up a face for nothing.
  //
  // The height that matters is height above the street, NOT a share of the building — that is the
  // difference between this and the first attempt, and the reason the first attempt was wrong. A
  // four-storey block's glazing sits at the same height as the bottom floors of a tower and reflects
  // the same street they do; a tower carries on up the curve until its upper floors are mostly sky.
  // So there is one curve for the whole island and a short building simply never climbs far up it,
  // which is how glazing behaves in life and why a low block reads darker than a tower's crown.
  //
  // The street is the island's, not the model's own foot: a building lifted onto the hill is four
  // or five units up before it starts, and its lowest glazing already sees over the rooftops of
  // everything below. Measuring from the model's own base would paint the Peak Tower's bowl the
  // same near-black as the pavement it stands above.
  // The facades along the water are the brightest and the flanks and backs are not, on top of the
  // fall below. Which faces those are is decided by the island rather than by the camera, because
  // the camera cannot tell them apart: it sits on the 45-degree diagonal, so the dot product with a
  // south face and with an east face is identical, and every building's front would be as bright as
  // its side. The direction away from the mountain can tell them apart. A waterfront building's
  // valley of the hill lies inland, so outward from the hill's centre is outward to the water, and
  // that is the face that gets the lift — for every building on the island the face that looks out
  // over the water, which is right without a table of exceptions.
  const FRONT_LIFT = .18;
  // Buildings on the quay are brighter than the ones in the second line, and that is a distance
  // rather than a height. A tower in the second line sees the same sky above it and the same street
  // under it as the one in front of it; the difference is that it has a wall between itself and the
  // harbour, and what the waterfront building throws back that the one behind it cannot is the
  // water. Measured on this island the two lines are cleanly apart — every plot on the quay stands
  // within 0.30 of the shoreline and the only two in the second line stand 1.10 and 1.18 back — so
  // the band between them is short and the step reads as a step.
  //
  // It is a factor on the fall rather than an addition to it, and that is the whole point: added,
  // 0.15 is 29 per cent at the floor and 11 at the crown, and a crown that has taken the front lift
  // can come out brighter than the quay tower beside it. Multiplied, the building is 16 per cent
  // brighter at every height, which is what "brighter" means and what the eye compares when two
  // buildings stand side by side.
  const COAST_LIFT = .22, COAST_NEAR = .30, COAST_FAR = 1.15;
  const SKY_REACH = 10.5;
  const fallenGlass = new WeakSet();
  // Distance from a point to the shoreline, which is the island's outline rather than any building's
  // own frontage: what matters is how much water a facade can see, and that is one measurement for
  // the whole coast rather than a per-row rule.
  function coastGap(x, z) {
    let best = Infinity;
    for (let i = 0, j = shoreline.length - 1; i < shoreline.length; j = i++) {
      const [ax, az] = shoreline[i], [bx, bz] = shoreline[j];
      const dx = bx - ax, dz = bz - az;
      const t = T.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
    return best;
  }
  function glassFall(mesh, bounds, lift, place, width, depth) {
    const geometry = mesh.geometry;
    if (fallenGlass.has(geometry)) return;
    fallenGlass.add(geometry);
    const street = bounds.min.y - lift;
    // The nearest corner of the plot to the water, not its centre: measuring from the centre would
    // make a deep building standing beside a shallow one on the same quay read as further from the
    // coast than its neighbour.
    let gap = coastGap(place.x, place.z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gap = Math.min(gap, coastGap(place.x + sx * width / 2, place.z + sz * depth / 2));
    const coastal = 1 - T.MathUtils.smoothstep(gap, COAST_NEAR, COAST_FAR);
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    const normalMatrix = new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const outward = new T.Vector2(place.x - PEAK.cx, place.z - PEAK.cz);
    if (outward.lengthSq() < 1e-6) outward.set(0, 1); else outward.normalize();
    const colour = new Float32Array(position.count * 3);
    const vertex = new T.Vector3(), face = new T.Vector3();
    for (let i = 0; i < position.count; i++) {
      const height = vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).y;
      const rise = T.MathUtils.clamp((height - street) / SKY_REACH, 0, 1);
      face.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      const toWater = T.MathUtils.clamp(face.x * outward.x + face.z * outward.y, 0, 1);
      // Eased rather than linear: the change from reflecting the street to reflecting the sky
      // happens across a band, not at a constant rate, because the buildings opposite and the
      // horizon fill most of the low view and the sky takes over quickly above them.
      //
      // The floor is 0.52 rather than 0.36 because the user found the deep end too deep, and the
      // span is 0.84 rather than 0.95 to pay for it without raising the ceiling: the lateral faces
      // run 0.52 to 1.36, which is 2.6x, where 0.36 to 1.31 was 3.6x. What matters is that it stays
      // a ratio. This fall was 0.62 to 1.21 once — 1.95x, a floor almost exactly where this one is
      // now — and the user could not see it at all, because each facet of a tower samples its own
      // part of the sky and that variation swamped a gentle ramp. The waterfront faces take the
      // front lift on top and run 0.70 to 1.54, which is 2.2x and still reads.
      //
      // The coastal lift is the third term and the last: it is what separates the quay from the
      // second line, and it multiplies the fall rather than adding to it so that the whole facade
      // is brighter and not just its base. It goes on the building rather than on one face, because
      // the whole building is nearer the water, not just the side of it that looks at the harbour.
      const shade = (.52 + T.MathUtils.smoothstep(rise, 0, 1) * .84) * (1 + coastal * COAST_LIFT) + toWater * FRONT_LIFT;
      colour[i * 3] = shade * .97;
      colour[i * 3 + 1] = shade;
      colour[i * 3 + 2] = shade * 1.03;
    }
    geometry.setAttribute('color', new T.BufferAttribute(colour, 3));
  }
  m.water = new T.MeshPhysicalMaterial({ color: '#9fd8f5', transparent: true, opacity: .65, depthWrite: false, roughness: .18, metalness: .12 });
  // Curtain-wall glass. What makes a glass tower read as glass is not that you can see through it:
  // it is that it mirrors the sky — brightest along the top, shading down towards the ground, with
  // a bright horizon line across the middle. A dielectric throws back about four per cent straight
  // on, so no amount of skylight on its own will put a sky on the glass; metalness is what does it,
  // trading the material's own colour for a reflection. The refraction stays, at a third of the
  // way, because it still shows at the seams where two of the tower's own faceted shafts meet. It
  // is deliberately not `transparent`, so the whole curtain wall still merges into one batch.
  //
  // `thickness` and `attenuationDistance` are a matched pair: the first lengthens the light's path,
  // so raising it without raising the second turns the glass dark instead of deep.
  m.crystal = new T.MeshPhysicalMaterial({
    color: '#79bff0', metalness: .72, roughness: .085, ior: 1.52, specularIntensity: 1,
    clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.9, vertexColors: true,
    transmission: .3, thickness: 1.6, attenuationColor: '#d6ecff', attenuationDistance: 9,
  });
  // A separate finish keeps the BOC shell reflective and fully opaque without
  // changing the transmissive glazing on the other landmarks.
  m.bocGlass=m.crystal.clone();m.bocGlass.name='BOC opaque reflective glass';
  m.bocGlass.transmission=0;m.bocGlass.opacity=1;m.bocGlass.transparent=false;m.bocGlass.depthWrite=true;
  // The floor lines of a glass tower are a different glass, not a different class of material: a
  // spandrel is the opaque band between the glazing, and here it is the crystal itself, a shade
  // deeper and a touch bluer, carrying the *same* vertical fall as the shaft it is cut into. That is
  // what makes the bands blend rather than sit on the facade as a fixed grey — a single value cannot
  // match glass that runs from 0.52 to 1.54 up the same face. The user's words: mix some blue so
  // they blend with the glass. `glassFall` colours it for exactly the same reason it colours the
  // shaft, and it is not in the palette because it is built from the crystal rather than typed in.
  m.spandrel = m.crystal.clone();
  m.spandrel.color.set('#5b9ad4');
  // Individual glass tints distinguish the towers while sharing the same
  // reflection response and height gradient.
  function tintedGlass(color, band) {
    const crystal = m.crystal.clone(); crystal.color.set(color);
    const spandrel = m.spandrel.clone(); spandrel.color.set(band);
    return { crystal, spandrel };
  }
  const GLASS_TINT = {
    'Cheung Kong Center': tintedGlass('#93a9c8', '#6f86a8'),
    'Sun Hung Kai Centre': tintedGlass('#aabcc9', '#728b9e'),
    'World Trade Centre': tintedGlass('#a0c5d2', '#728fa3'),
    'The Peak Tower': tintedGlass('#54859f', '#456d84'),
  };
  const peakGlass=GLASS_TINT['The Peak Tower'];
  for(const glazing of [peakGlass.crystal,peakGlass.spandrel]) {
    glazing.name='Peak Tower reflective glazing';
    glazing.metalness=.32;glazing.roughness=.025;glazing.ior=1.52;
    glazing.transmission=.48;glazing.thickness=.18;glazing.attenuationDistance=2.8;
    glazing.attenuationColor.set('#d5edf3');glazing.envMapIntensity=2.8;
    glazing.clearcoatRoughness=.015;
  }
  peakGlass.base=m.glass.clone();peakGlass.base.name='Peak Tower clear lower glazing';
  peakGlass.base.color.set('#6c9eaf');peakGlass.base.metalness=.22;
  peakGlass.base.opacity=.40;peakGlass.base.roughness=.035;peakGlass.base.envMapIntensity=2.8;
  const glassMaterials = new Set([m.crystal,m.bocGlass, m.spandrel, ...Object.values(GLASS_TINT).flatMap(g => [g.crystal, g.spandrel])]);
  const cache = new Map();
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(geometry, material); o.position.set(x, y, z);
    o.castShadow = !material.transparent; o.receiveShadow = !material.transparent;
    parent.add(o); return o;
  }
  function box(w, h, d, material, parent, x = 0, y = 0, z = 0, r = .045) {
    r = Math.min(r, w * .22, h * .22, d * .22);
    const key = [w, h, d, r].join(':');
    if (!cache.has(key)) cache.set(key, r === 0 ? new T.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 3, r));
    return mesh(cache.get(key), material, parent, x, y, z);
  }
  const ball = new T.SphereGeometry(1, 16, 12);
  function puff(w, h, d, material, parent, x, y, z) {
    const o = mesh(ball, material, parent, x, y, z); o.scale.set(w, h, d); return o;
  }
  function cylinder(r, h, material, parent, x = 0, y = 0, z = 0, top = r) {
    const key = `c:${r}:${h}:${top}`;
    if (!cache.has(key)) cache.set(key, new T.CylinderGeometry(top, r, h, 20));
    return mesh(cache.get(key), material, parent, x, y, z);
  }
  function group(name, parent = fixed, x = 0, y = 0, z = 0) {
    const g = new T.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g;
  }
  function beam(a, b, width, material, parent) {
    const av = new T.Vector3(...a), bv = new T.Vector3(...b), delta = bv.clone().sub(av);
    const o = box(width, delta.length(), width, material, parent, ...av.clone().add(bv).multiplyScalar(.5).toArray());
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return o;
  }
  function selectable(name, g, w, d, h, note) {
    const hit = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false }));
    g.updateWorldMatrix(true, false); g.getWorldPosition(hit.position); hit.position.y += h / 2;
    hit.userData = { name, note, position: hit.position.clone(), focusZoom: 2.5 }; root.add(hit); places.push(hit);
  }
  function plant(parent, x, y, z, size = .17, flowers = false) {
    cylinder(size, .25, m.clay, parent, x, y + .125, z, size * .82);
    cylinder(size * .75, .04, m.soil, parent, x, y + .25, z);
    for (let i = 0; i < 5; i++) { const a = i * 2.4; puff(size * .64, size * .9, size * .64, flowers ? m.flower : m.leaf, parent, x + Math.cos(a) * size * .48, y + .33 + size * .25, z + Math.sin(a) * size * .48); }
  }
  const threshold = .225;
  function room(parent, spec, trim, index) {
    const { width: w, height: h, x = 0, y = 0 } = spec;
    const g = group('Remodeled furnished room', parent, x, y, 0);
    box(w, .06, .48, m.wood, g, 0, .015, -.27);
    box(w, h, .055, m.room, g, 0, h / 2, -.51);
    for (const xx of [-w / 2, w / 2]) box(.065, h, .51, m.room, g, xx, h / 2, -.26);
    box(w, .06, .48, m.stone, g, 0, h, -.27);
    // A sill and a reveal that sit back inside the opening. A window is glazing in a hole, not
    // something modelled onto the face, so nothing here may stand proud of the facade.
    box(w + .10, .08, .14, trim, g, 0, -.04, -.07);
    if (spec.shape === 'arch') {
      const frame = archShape(w + .10, h + .07); frame.holes.push(new T.Path(archShape(w, h).getPoints(24)));
      const geo = new T.ExtrudeGeometry(frame, { depth: .09, bevelEnabled: false, curveSegments: 20 });
      mesh(geo, trim, g, 0, 0, -.015);
    } else {
      box(w + .10, .08, .13, trim, g, 0, h + .025, -.07);
      for (const xx of [-w / 2 - .025, w / 2 + .025]) box(.065, h, .13, trim, g, xx, h / 2, -.07);
    }
    let owner = parent; while (owner && !owner.userData.program) owner = owner.parent;
    const program = owner?.userData.program || 'home';
    if (h > .65 && /Coffee|Bakery|Ramen/.test(program)) {
      box(w * .82, .28, .22, m.wood, g, 0, .17, -.14);
      box(w * .87, .06, .27, m.stone, g, 0, .33, -.14);
      for (let i = 0; i < 3; i++) { const xx = (i - 1) * w * .22; cylinder(.045, .07, m.warm, g, xx, .405, -.13); }
      box(w * .75, .08, .18, m.wood, g, 0, .53, -.39);
      for (let i = 0; i < 4; i++)puff(w * .075, .07, .065, m.peach, g, -w * .26 + i * w * .17, .64, -.38);
    } else if (h > .65 && program.includes('Orchid')) {
      for (let i = 0; i < 3; i++)plant(g, (i - 1) * w * .23, .06, -.23, .09, i % 2 === 0);
    } else if (h > .65 && /Museum|Atelier/.test(program)) {
      box(w * .26, .21, .18, m.stone, g, 0, .13, -.19);
      puff(w * .10, .14, .10, m.lavender, g, 0, .40, -.19);
      box(w * .49, h * .35, .035, m.wood, g, 0, h * .65, -.46);
      box(w * .41, h * .28, .025, m.rose, g, 0, h * .65, -.43);
    } else if (h > .65 && program.includes('Cinema')) {
      for (let row = 0; row < 2; row++)for (let i = 0; i < 3; i++)box(w * .17, .20, .15, m.rose, g, (i - 1) * w * .23, .14 + row * .06, -.15 - row * .19, .04);
    } else if (h > .65 && program.includes('School')) {
      for (let i = 0; i < 3; i++) { box(w * .20, .06, .18, m.wood, g, (i - 1) * w * .25, .30, -.23); box(.065, .23, .065, m.metal, g, (i - 1) * w * .25, .16, -.23); }
      box(w * .70, h * .24, .03, m.sage, g, 0, h * .68, -.46);
    } else if (h > .65 && /Archive|Voltage|Retail/.test(program)) {
      for (let level = 0; level < 3; level++) {
        box(w * .78, .075, .22, m.wood, g, 0, .17 + level * h * .22, -.36);
        for (let i = 0; i < 4; i++) {
          const xx = -w * .27 + i * w * .18, yy = .24 + level * h * .22;
          if (program.includes('Ramen')) puff(w * .07, .06, .07, m.peach, g, xx, yy, -.32);
          else box(w * .10, h * .14, .12, [m.sage, m.blue, m.rose, m.peach][i], g, xx, yy, -.35, .025);
        }
      }
      box(w * .70, .25, .18, m.stone, g, 0, .16, -.12);
    } else if (h > .65) {
      box(w * .72, .16, .21, index % 3 ? m.peach : m.sage, g, 0, .25, -.35, .06);
      box(w * .70, .20, .10, index % 3 ? m.peach : m.sage, g, 0, .40, -.44, .05);
      box(w * .24, .12, .16, m.wood, g, w * .23, .11, -.17);
      plant(g, -w * .30, .09, -.22, .075);
      box(w * .30, h * .22, .035, m.white, g, w * .12, h * .72, -.468);
      box(w * .19, h * .13, .025, index % 2 ? m.rose : m.blue, g, w * .12, h * .72, -.443);
    } else {
      box(w * .8, .08, .16, m.wood, g, 0, h * .40, -.36);
      for (let i = 0; i < 4; i++) box(w * .1, h * .32, .10, [m.peach, m.sage, m.blue, m.rose][i], g, -w * .24 + i * w * .16, h * .60, -.35);
    }
    paneGradient(box(w, h, .014, m.window, g, 0, h / 2, 0, .002), h);
    if (h > .65) cylinder(.045, .06, m.warm, g, 0, h - .14, -.20);
    windows.push(g);
  }
  const grass = new T.MeshStandardMaterial({ color: '#add27c', roughness: .95 });
  grass.name = 'Coastal planted terrain';
  const stones = new T.MeshStandardMaterial({ color: '#e1dfcd', roughness: 1 });
  const ocean = { level: -.35, split: -1.075, floor: -2.325 };
  // The island meets the back two plate edges. Extra water belongs to the
  // camera-facing harbour, with enough room for separated vessels and wakes.
  const WORLD = HARBOUR_SIZE, worldBounds = { ...HARBOUR_BOUNDS };
  m.sea.emissive.set('#366b96'); m.sea.emissiveIntensity = .30; m.sea.roughness = .50;
  const lowerOcean = box(WORLD, ocean.split - ocean.floor, WORLD, m.sea, oceanRoot, HARBOUR_CENTER[0], (ocean.split + ocean.floor) / 2, HARBOUR_CENTER[1], 0); lowerOcean.name = 'Opaque blue ocean depth';
  // The depth keeps its floor and submerged horizontal bed. One opaque wall
  // spans the full cutaway edge, avoiding a visible join at the old split height.
  const bedIndices = [], lowerGeometry = lowerOcean.geometry;
  for (let i = 0; i < lowerGeometry.index.count; i += 3) {
    const index = lowerGeometry.index.getX(i);
    // The full rectangular top stays submerged; the underside is cut to the
    // water footprint below, rather than overlapping the island's bottom cap.
    if (lowerGeometry.attributes.normal.getY(index) < .5) continue;
    bedIndices.push(...[0, 1, 2].map(j => lowerGeometry.index.getX(i + j)));
  }
  lowerGeometry.setIndex(bedIndices); lowerGeometry.clearGroups();
  const sideGeometry = new T.BoxGeometry(WORLD, ocean.level - ocean.floor, WORLD), sideIndices = [];
  const sideColors = new Float32Array(sideGeometry.attributes.position.count * 3);
  for (let i = 0; i < sideGeometry.attributes.position.count; i++) {
    const depth = sideGeometry.attributes.position.getY(i) / (ocean.level - ocean.floor) + .5;
    sideColors.fill(T.MathUtils.lerp(.72, 1.10, depth), i * 3, i * 3 + 3);
  }
  for (let i = 0; i < sideGeometry.index.count; i += 3) {
    const index = sideGeometry.index.getX(i);
    if (Math.abs(sideGeometry.attributes.normal.getY(index)) > .5) continue;
    sideIndices.push(...[0, 1, 2].map(j => sideGeometry.index.getX(i + j)));
  }
  sideGeometry.setIndex(sideIndices); sideGeometry.clearGroups();
  sideGeometry.setAttribute('color', new T.BufferAttribute(sideColors, 3));
  const sideMaterial = m.sea.clone(); sideMaterial.name = 'Opaque graded harbour cutaway';
  sideMaterial.vertexColors = true; sideMaterial.emissiveIntensity = .12;
  // The far walls must also be visible through the transparent water surface;
  // otherwise the clear background shows as bright strips along the cut edges.
  sideMaterial.side = T.DoubleSide;
  const oceanSides = mesh(sideGeometry, sideMaterial, oceanRoot, HARBOUR_CENTER[0], (ocean.level + ocean.floor) / 2, HARBOUR_CENTER[1]);
  oceanSides.name = 'Continuous opaque ocean sides'; oceanSides.castShadow = false; oceanSides.receiveShadow = false;
  // Transparency belongs only to the horizontal water surface. There are no
  // transparent side faces or bottom pane to double-blend at the rim.
  // A zero-roughness clearcoat reflects the directional rim light across the
  // entire orthographic water plane at one orbit angle, overwhelming bloom.
  // The separate planar reflection retains the detailed harbour reflections.
  const clearOceanMaterial = new T.MeshPhysicalMaterial({ color: '#a3e7ef', roughness: .25, metalness: 0, transparent: true, opacity: .25, depthWrite: false, clearcoat: .35, clearcoatRoughness: .28, envMapIntensity: .35 });
  const upperGeometry = new T.PlaneGeometry(WORLD, WORLD); upperGeometry.rotateX(-Math.PI / 2);
  const upperOcean = mesh(upperGeometry, clearOceanMaterial, oceanRoot, HARBOUR_CENTER[0], ocean.level, HARBOUR_CENTER[1]); upperOcean.name = 'Clear horizontal harbour surface'; upperOcean.renderOrder = 5;
  // The construction grid folds the waterfront around the nearest corner.
  // Larger x places the Central towers on the right of the harbour view;
  // geographic north follows the harbour-facing diagonal defined in compass.mjs.
  //
  // There is no extra land anywhere on this island. The halls stand on the corner of the island's own
  // shore that is nearest Tsim Sha Tsui, and the city runs along the coast to either side of them:
  // Wan Chai and the Central towers to the west, and the island's own eastern districts — Causeway
  // Bay, North Point, Quarry Bay — to the south along the east shore. That is the arrangement the
  // city has, and it is the arrangement the view is built around, because the corner nearest the
  // camera is the middle of the picture.
  // The larger landmark gets a local waterfront forecourt within the same ocean plate.
  const waterfront = [[-9.5, worldBounds.minZ], [-9.5, -9.8], [-10.05, -8.8], [-10.05, -5.2], [-9.7, -4.3], [-9.7, -1.4], [-10.15, -.6], [-10.15, 2.2], [-9.7, 3.0], [-10.05, 5.5], [-10.8, 6.9], [-10.9, 8.4], [-10.2, 9.6], [-8.8, 10.6], [-7.3, 10.6], [-5.7, 9.6], [-4.95, 8.65], [-3.2, 8.65], [-2.4, 8.30], [.6, 8.30], [1.35, 9.30], [1.95, 10.20], [10.30, 10.20], [10.95, 9.65], [worldBounds.maxX, 9.65]];
  const shoreline = [[worldBounds.maxX, worldBounds.minZ], ...waterfront];
  const waterBottomPlan=new T.Shape([
    [worldBounds.minX,worldBounds.minZ],...waterfront,
    [worldBounds.maxX,worldBounds.maxZ],[worldBounds.minX,worldBounds.maxZ],
  ].map(([x,z])=>new T.Vector2(x,z)));
  const waterBottomGeometry=new T.ShapeGeometry(waterBottomPlan);
  waterBottomGeometry.rotateX(Math.PI/2);
  mesh(waterBottomGeometry,m.sea,oceanRoot,0,ocean.floor,0).name='Non-overlapping harbour underside';
  // The back cut faces expose land, so ocean walls stop at the shoreline there.
  // Keep the two harbour-facing water walls intact.
  const sidePositions=sideGeometry.attributes.position, sideNormals=sideGeometry.attributes.normal;
  const shoreAtMinZ=waterfront[0][0], shoreAtMaxX=waterfront[waterfront.length-1][1];
  for(let i=0;i<sidePositions.count;i++) {
    if(sideNormals.getX(i)>.5)sidePositions.setZ(i,Math.max(sidePositions.getZ(i),shoreAtMaxX-HARBOUR_CENTER[1]));
    if(sideNormals.getZ(i)<-.5)sidePositions.setX(i,Math.min(sidePositions.getX(i),shoreAtMinZ-HARBOUR_CENTER[0]));
  }
  sidePositions.needsUpdate=true;sideGeometry.computeBoundingBox();sideGeometry.computeBoundingSphere();
  function waterfrontStrip(outer, inner) {
    const offset = scale => waterfront.map(([x, z]) => new T.Vector2(
      x === worldBounds.maxX ? x : x * scale,
      -(z === worldBounds.minZ ? z : z * scale)));
    return new T.Shape([...offset(outer), ...offset(inner).reverse()]);
  }
  const islandPlan = new T.Shape(shoreline.map(([x, z]) => new T.Vector2(x, -z)));
  function islandLayer(top, bottom, material, name) { const geo = new T.ExtrudeGeometry(islandPlan, { depth: top - bottom, bevelEnabled: false, curveSegments: 1 }); geo.rotateX(-Math.PI / 2); const o = mesh(geo, material, fixed, 0, bottom, 0); o.name = name; return o; }
  const foundationBottom=ocean.floor-landRise;
  const crust=m.coastalPaving.clone();crust.name='Solid island earth crust';
  const landBody = islandLayer(.07, foundationBottom, crust, 'Continuous submerged irregular island');
  const paving = islandLayer(.20, .07, m.coastalPaving, 'Cream coastal district paving');
  // The HKCEC forecourt uses the same continuous, level coastal paving.
  // One open route directly behind the coastal buildings. There is no
  // returning loop, rear branch, or cross street through the mountain.
  const roadCurve = coastalRoad({ x: -5.65, startZ: worldBounds.minZ, turnZ: 4.0, endX: worldBounds.maxX, radius: 1.2, y: .235 });
  const roadWidth = 1.50, roadLength = roadCurve.getLength(), laneOffset = .34;
  const inlandEdge = roadWidth / 2 + .11;
  const bendStart = roadCurve.segments[1].at(0), bendEnd = roadCurve.segments[1].at(1);
  const innerRadius = roadCurve.radius - inlandEdge;
  const inlandLimitZ = bendEnd.z - inlandEdge;
  function inlandBoundaryX(z) {
    if (z <= bendStart.z) return bendStart.x + inlandEdge;
    return bendEnd.x - Math.sqrt(Math.max(0, innerRadius ** 2 - (z - bendStart.z) ** 2));
  }
  function roadSample(u, lane = 0) {
    const point = roadCurve.getPointAt(u), tangent = roadCurve.getTangentAt(u); point.y += landRise;
    const side = new T.Vector3(-tangent.z, 0, tangent.x);
    return { point: point.addScaledVector(side, lane), tangent, heading: Math.atan2(-tangent.z, tangent.x) };
  }
  function ribbon(curve, width, material, y) {
    const vertices = [], indices = [], n = 320;
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), normal = new T.Vector3(-t.z, 0, t.x);
      for (const side of [-1, 1]) vertices.push(p.x + normal.x * width / 2 * side, y, p.z + normal.z * width / 2 * side);
      if (i) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return mesh(geo, material, fixed);
  }
  ribbon(roadCurve, roadWidth + .22, m.stone, .222);
  ribbon(roadCurve, roadWidth, m.road, .235);
  for (let s = .4; s < roadLength - .19; s += 1.05) {
    const { point, heading } = roadSample(s / roadLength);
    const dash = box(.38, .012, .065, m.white, fixed, point.x, .246, point.z, .005); dash.rotation.y = heading;
  }
  // The road keeps its centre dashes, with no zebra crossings.
  const crossings = [];
  // Roof terraces use stone paving; the school is the one that keeps a lawn.
  let randomSeed = 6703;
  const random = () => { randomSeed = (randomSeed * 16807) % 2147483647; return randomSeed / 2147483647; };
  const trees = [];
  function tree(parent, x, y, z, size = .7, flowering = false) {
    if(roadCurve.closestPoint(x,z).distance<=roadWidth/2+.12)return;
    cylinder(.065 * size, .8 * size, m.bark, parent, x, y + .4 * size, z, .045 * size);
    const crown = group('Topiary crown', root);
    parent.updateWorldMatrix(true, false); crown.position.copy(parent.localToWorld(new T.Vector3(x, y + .93 * size, z)));
    const variant = trees.length % 3;
    if (variant === 0) {
      puff(.28 * size, .59 * size, .30 * size, flowering ? m.flower : m.leaf, crown, 0, .02 * size, 0);
      puff(.20 * size, .34 * size, .22 * size, flowering ? m.flower : m.leafLight, crown, .13 * size, -.15 * size, .08 * size);
    } else {
      for (const side of [-1, 1]) beam([x, y + .50 * size, z], [x + side * .22 * size, y + .94 * size, z], .045 * size, m.bark, parent);
      for (const [xx, yy, zz, s] of [[0, .10, 0, .41], [-.22, -.12, .03, .30], [.23, -.04, -.08, .32], [.02, .25, .13, .26]]) puff(s * size, s * .87 * size, s * size, flowering ? m.flower : (variant === 1 ? m.leafLight : m.leafDark), crown, xx * size, yy * size, zz * size);
    }
    crown.userData.shadowCaster = true;
    trees.push(crown); return crown;
  }
  // The island is a waterfront and a mountain, not a grid, and the coast is what decides where the
  // towers go. The harbour shore carries one row — Hong Kong Island's towers in their real order
  // west to east — and nothing is built inland, because behind the coastal road the whole interior
  // is the Peak.
  //
  // The island's east side carries no buildings at all, and that is the point of it. The view stands
  // at Tsim Sha Tsui, across the water, so the only coast it faces is this island's own harbour
  // frontage; the landmarks of Tsim Sha Tsui are Kowloon's, on the far side of the harbour, and this
  // map is Hong Kong Island. They stood here once — the clock tower and the museums and the hotel,
  // carrying the row round the corner and north up the east coast — which put a planetarium and a
  // ferry pier's clock tower on the wrong island and directly under the camera that is supposed to
  // be standing in Tsim Sha Tsui. Their builders are still in `scripts/blender/hk_buildings.py` and
  // their models are still in `public/models`; only the plots are gone, and the land they stood on
  // is the island's own shore again.
  //
  // Waterfront towers stand in two staggered rows. The corner nearest the
  // camera belongs to HKCEC, with open paving behind its forecourt.
  // Resize around the midpoint of HKCEC's landward podium edge, at ground level.
  // P' = P + R * (oldScale - newScale) * pivot keeps that rear anchor fixed.
  const conventionPlanResize = .70 * 1.05;
  const conventionHeightResize = .70 * 1.15;
  const conventionOffset = new T.Vector3(0, 0, -1.29 * 1.41 * (1 - conventionPlanResize))
    .applyAxisAngle(new T.Vector3(0, 1, 0), -Math.PI / 4);
  const specs = [
    { name: 'Two IFC', x: 8.95, z: 6.75, w: 2.60, d: 2.60, h: 15.4, rot: 4, kind: 'skyscraper', use: 'finance' },
    { name: 'Jardine House', x: 6.05, z: 6.80, w: 2.50, d: 2.50, h: 6.3, kind: 'office block', use: 'shipping offices' },
    { name: 'HSBC Main Building', x: 0.30, z: 6.80, w: 2.90, d: 2.70, h: 5.8, kind: 'bank headquarters', use: 'headquarters' },
    { name: 'Cheung Kong Center', x: 3.25, z: 6.20, w: 2.50, d: 2.50, h: 9.5, kind: 'office tower', use: 'offices' },
    { name: 'Bank of China Tower', x: -2.60, z: 6.20, w: 2.20, d: 2.00, h: 14.0, kind: 'tower', use: 'bank' },
    // The convention centre, on the corner of the island's own shore that is nearest Tsim Sha Tsui,
    // with the city running along the coast to either side. The halls are on the
    // Wan Chai waterfront with the observation wheel west on the Central reclamation — on the island's own
    // enlarged waterfront forecourt. Its model is the one that is loaded from no
    // file: src/hkcec.mjs builds its vaulted roof, curved foyer and swept side canopies.
    // The sole camera-facing exception: its foyer faces the home view at -45°.
    // The retained forecourt leaves breathing room in front of the smaller halls.
    { name: 'Hong Kong Convention and Exhibition Centre', x: -8.05 + conventionOffset.x, z: 7.65 + conventionOffset.z, w: 5.60 * conventionPlanResize, d: 5.60 * conventionPlanResize, h: 3.9 * conventionHeightResize, rot: -45, planScale: 1.41 * conventionPlanResize, heightScale: 1.5 * conventionHeightResize, kind: 'convention centre', use: 'convention centre' },
    // The island's eastern districts, running south from the corner the halls stand on: Wan Chai,
    // Causeway Bay, North Point and Quarry Bay. This is the shore the camera looks down on its left,
    // and it is built rather than green — Hong Kong Island's own east side is city for three miles
    // from Wan Chai, with the hills behind it, and leaving it as parkland put every building in the
    // picture on the right.
    // Compressed district sequence east of the halls: Harbour Road in Wan Chai North,
    // Gloucester Road in Causeway Bay, Wharf Road in North Point, then Taikoo Place.
    // Waterfront choices replace the former inland Hopewell / Times Square stand-ins.
    { name: 'Sun Hung Kai Centre', x: -8.20, z: 3.15, w: 2.40, d: 2.40, h: 8.5, kind: 'office tower', use: 'offices' },
    { name: 'Sing Ho Finance Building', x: -8.20, z: .30, w: 1.91, d: 1.66, h: 7.3, kind: 'office tower', use: 'offices' },
    { name: 'Suns Group Centre', x: -7.95, z: -2.55, w: 2.13, d: 1.66, h: 5.84, kind: 'office tower', use: 'offices' },
    { name: 'Great Eagle Centre', x: -8.20, z: -5.35, w: 2.12, d: 1.90, h: 6.25, kind: 'office tower', use: 'offices' },
    { name: 'Central Plaza', x: -8.20, z: -8.20, w: 1.92, d: 1.70, h: 14.55, kind: 'skyscraper', use: 'offices' },
    // The west coast is deliberately empty. It carried the ordinary fabric of the city — six
    // walk-ups, tong lau and office slabs, one of each variant, standing in a line down the western
    // shore — and they were the only buildings on the map painted in the bright accent colours, so
    // they read as a row of painted boxes standing off to one side of a harbour front of glass and
    // concrete. The user's words: "please remove the colorful buildings standing on the side."
    // Their models are still built and still in `public/models`; only the plots are gone.
    // Lippo Centre stood here and is gone: the halls needed the room when they were enlarged, and of
    // the row it is the one the harbour view misses least. Its model is still built and still listed
    // in `building-models.mjs`; only the plot is gone.
    // The summit, standing on the hill rather than on the shore, and standing at the island's far
    // corner rather than in the middle of its skyline. That corner is the one diagonally opposite the
    // camera, so it is both the furthest ground there is and the only part of the island whose far
    // side is never seen.
    //
    // Its position is still a statement about the *relation* to the halls rather than about a
    // coordinate on its own: from Tsim Sha Tsui the Peak rises behind the row of towers and between
    // the halls and the office cluster, above the west end of the city, which is where the harbour
    // view puts it — Central is west of Wan Chai and the Peak is above Central. What changed is that
    // it now also stands at the back of the map, which is what the user asked for: "i prefer the
    // mountain peak is at the corner, farthest from the camera." On screen the far corner of the
    // plate is directly behind the hill, and the summit is now within a unit of that line, so the
    // peak is the highest point of the island in the picture and it is at the far corner of it.
    //
    // Note that this end is the island's SOUTH: the city row faces the water, and the Central
    // waterfront faces north across Victoria Harbour, so the harbour — and this map's north — is the
    // row's side, and the peak end is behind it. Older comments here called this end the north.
    //
    // The lift is measured against the world's hill, not against the model: a building's base sits at
    // `threshold + lift`, and the hill's table at `landRise + peakHeight`. The table tops out at 5.20
    // and the threshold is 0.225, so 4.92 of lift puts the plinth 0.075 into the levelled top: the
    // hillside carries on under the whole footprint, and the building is bedded into ground rather
    // than perched on a bump. The table is 3.8 by 3.15 and the plinth is 2.9 by 2.4, so it is on
    // ground all the way round, which is what `lift` has to be chosen against — the plinth is wider
    // than the plot it is listed with.
    { name: 'The Peak Tower', x: 6.85, z: -8.60, w: 1.90, d: 1.90, h: 10.8, lift: 4.92, kind: 'viewing tower', use: 'viewpoint' },
  ];
  // The Peak is land rather than architecture, so it is built here instead of being modelled: one
  // hill, rising out of the coastal road on the north and climbing all the way to its summit at the
  // island's FAR CORNER — the corner diagonally opposite the camera, and the only one whose far side
  // the camera can never see. The user asked for the peak there, and the far corner is also where the
  // eye puts a mountain: the highest thing in the picture should stand at the point of the map that
  // is furthest away, not in the middle of the skyline.
  //
  // It is stated as a TABLE WITH FOUR FEET, and that is what makes the summit movable at all. The
  // height is the product of one one-dimensional profile per axis: each is level across the table and
  // then falls to its own foot, and the four feet are the island's own west and south shorelines and
  // the two legs of the coastal road inland, so the hill's skirt stays behind the city instead of
  // climbing into it. Every number here and below is stated against the table, so moving the table
  // moves the whole mountain with it — the version before this one wrote its anchors as world
  // coordinates, and moving it slid the mesh over a hill that stayed exactly where it was.
  const PEAK = {
    top: 5.20,
    // The levelled table, which is what the tower stands on. Its plinth is 2.9 by 2.4, so the table is
    // 3.8 by 3.15 and the building sits on it with a margin on every side rather than an overhang.
    x0: 4.70, x1: 8.50, z0: -9.95, z1: -6.80,
    // The feet: the west and south shores, and inland the coastal road's two legs.
    west: worldBounds.maxX, east: bendStart.x + inlandEdge, north: inlandLimitZ, south: worldBounds.minZ,
  };
  // Where the summit is, which is where the tower is: the table is level, so the peak is wherever the
  // building stands rather than wherever the ground happens to be highest. It goes as far into the
  // corner as the plinth's own width allows, because the corner is what reads — and it is also the
  // direction away from the hill's centre that the glass measures its waterfront faces against.
  PEAK.cx = 6.85; PEAK.cz = -8.60;
  // Blending one profile into another leaves a crease wherever the curvature is not continuous. A
  // smoothstep has a continuous slope but its curvature jumps from nothing to six across the width of
  // its band, and a hill is a large enough surface for that to read as a fold in the ground. This is
  // the fifth-order ease, whose first and second derivatives are both zero at both ends, so a flat
  // table can meet a climbing slope along it with neither a step nor a crease.
  const ease = t => {
    const s = T.MathUtils.clamp(t, 0, 1);
    return s * s * s * (s * (s * 6 - 15) + 10);
  };
  // One shape for both of the hill's axes: level across the table, then a fall to that side's foot.
  //
  // The fall is measured from the table's own edge rather than from a centre line, which is what
  // lets the table be small enough to fit the summit's corner and still be exactly level under the
  // plinth. The cross-section is a power of the distance, not the `across` everything here was first
  // built on: across is 1 - (dx/w)^2, a parabola, and a parabola is convex in real distance, so no
  // exponent applied to it can be concave — the hill bulged through both attempts, which is what the
  // user kept seeing. A power of the distance is concave: the ground flares away into the apron first
  // and gathers pitch as it climbs, which is the curve the user asked for.
  //
  // The roll blends the level part into the fall over the first half of the run rather than over the
  // first tenth of it, and that is deliberate: the narrower the roll, the more the table's lip reads
  // as the edge of a plateau, and the user asked for a slope that looked smooth or irregular rather
  // than one with a seam in it.
  function slope(t) {
    const hold = 1 - ease(t / .46);
    return hold + (1 - hold) * Math.pow(1 - t, 1.5);
  }
  function mountainHeight(x, z) {
    // How far out from the table the point lies on each axis, and how far that side's foot is from
    // the table's own edge. Both are zero across the table, so both profiles are 1 there and the
    // product is the table's height — which is why the tower can be set down anywhere on it.
    //
    // The two feet are the island's west and south shorelines and, inland, the two legs of the
    // coastal road, so the climb is long and gentle off the road and the hill never reaches the city:
    // the ground flares away into its apron for the first two units and only then begins to gather.
    const ax = Math.max(PEAK.x0 - x, x - PEAK.x1, 0), az = Math.max(PEAK.z0 - z, z - PEAK.z1, 0);
    const u = Math.min(ax / (x < PEAK.x0 ? PEAK.x0 - PEAK.east : PEAK.west - PEAK.x1), 1);
    const v = Math.min(az / (z < PEAK.z0 ? PEAK.z0 - PEAK.south : PEAK.north - PEAK.z1), 1);
    const raw = slope(u) * slope(v);
    // Spurs and hollows, so the surface is a hillside rather than a surface of revolution — and, just
    // as much, so that the flank is broken up by something that is not a rule. Three octaves: a broad
    // swell about eight units across, a shoulder-and-gully band at three, and a fine one for the
    // texture of the ground.
    //
    // They fade out wherever the hill is near its top: the Peak Tower stands on the levelled table,
    // and anything that dips the ground under its footprint floats the building. The other direction
    // needs no help — the cap below catches a hump tall enough to reach the top and flattens it back
    // onto the table rather than letting it overtop the summit.
    const relief = T.MathUtils.clamp((.97 - raw) / .10, 0, 1);
    const spurs = 1 + relief * (
      .105 * Math.sin(x * .74 + z * .38) * Math.cos(z * .61 - x * .23) +
      .050 * Math.sin(x * 1.85 - z * .44) * Math.cos(z * 1.52 + x * .95) +
      .025 * Math.sin(x * 3.90 + z * 2.60)
    );
    // The summit is levelled rather than crowned, so the building rests on ground and not on a mound.
    // The hill had a green knoll of its own to hide the join between the plinth and the slope, which
    // read as a circular plate under the tower, and that knoll is gone: the cap spends the top of the
    // profile's range in a smoothstep instead, holding the summit level wherever the hill has climbed
    // to its full height. Below the cap the slope is exactly as it was; above it the profile eases to
    // 1, which also flattens any spur tall enough to reach the top.
    const cap = T.MathUtils.smoothstep(raw * spurs, .94, 1);
    const verge = ease((roadCurve.closestPoint(x, z).distance - inlandEdge) / .90);
    return .202 + (PEAK.top - .202) * (raw * spurs * (1 - cap) + cap) * verge;
  }
  const tramRoute = peakTramRoute((x, z) => mountainHeight(x, z) + .02);
  function peakHeight(x, z) { return tramRoute.terrainHeight(x, z) - .02; }
  const peakTram = createPeakTram({ fixed, root, materials: m, route: tramRoute, landRise });

  // One fine grid carries both the grassy roadside and the mountain relief.
  // Shoreline cells stop under the quay coping, without projecting over water.
  // The first vertex of every row follows the road's inland curb, including
  // its rounded turn. The same surface continues all the way to the summit.
  const hillMaxX = Math.max(...shoreline.map(p => p[0])), hillMinZ = Math.min(...shoreline.map(p => p[1]));
  const hillCols = 164;
  const hillRowZ = [];
  const straightRows = Math.ceil((bendStart.z - hillMinZ) / .10);
  for (let j = 0; j <= straightRows; j++) hillRowZ.push(T.MathUtils.lerp(hillMinZ, bendStart.z, j / straightRows));
  for (let j = 1; j <= 24; j++) hillRowZ.push(bendStart.z + innerRadius * Math.sin(j / 24 * Math.PI / 2));
  const hillRows = hillRowZ.length - 1;
  function seaward(x, z) {
    let inside = false;
    for (let i = 0, j = shoreline.length - 1; i < shoreline.length; j = i++) {
      const [xi, zi] = shoreline[i], [xj, zj] = shoreline[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return !inside;
  }
  const hillPositions = [], hillIndices = [];
  for (let i = 0; i <= hillCols; i++) for (let j = 0; j <= hillRows; j++) {
    const z = hillRowZ[j], x = T.MathUtils.lerp(inlandBoundaryX(z), hillMaxX, i / hillCols);
    hillPositions.push(x, peakHeight(x, z), z);
  }
  for (let i = 0; i < hillCols; i++) for (let j = 0; j < hillRows; j++) {
    const z0 = hillRowZ[j], z1 = hillRowZ[j + 1];
    const x0 = T.MathUtils.lerp(inlandBoundaryX(z0), hillMaxX, i / hillCols), x1 = T.MathUtils.lerp(inlandBoundaryX(z0), hillMaxX, (i + 1) / hillCols);
    const x2 = T.MathUtils.lerp(inlandBoundaryX(z1), hillMaxX, i / hillCols), x3 = T.MathUtils.lerp(inlandBoundaryX(z1), hillMaxX, (i + 1) / hillCols);
    // Every corner, not the middle: a face with one corner over the sea would hang a sliver of green
    // off the end of an island, and the sliver would be the first thing the eye found.
    if (seaward(x0, z0) || seaward(x1, z0) || seaward(x2, z1) || seaward(x3, z1)) continue;
    // The vertices were pushed a column at a time — every row of one i, then the next — so the two
    // neighbours of a vertex inside its own column are a stride of `hillRows + 1` away, not one. Built
    // the other way round the faces join vertices from opposite ends of the grid, which costs nothing
    // to look at until a ray is cast at it: the surface is not where either the picture or the numbers
    // say it is, and the tower ends up standing two and a half units over its own hill.
    const a = i * (hillRows + 1) + j, b = a + 1, c = a + hillRows + 1, d = c + 1;
    hillIndices.push(a, b, c, b, d, c);
  }
  const hillGeo = new T.BufferGeometry();
  hillGeo.setAttribute('position', new T.Float32BufferAttribute(hillPositions, 3));
  hillGeo.setIndex(hillIndices);
  hillGeo.computeVertexNormals();
  // Broad vegetation patches and dry shoulders, with no seams or extra terrain layers.
  const hillColours=[];
  for(let i=0;i<hillPositions.length;i+=3){
    const [x,y,z]=hillPositions.slice(i,i+3);
    const patch=.5+.5*Math.sin(x*.73+Math.sin(z*.65))*Math.cos(z*.85-x*.19);
    const shoulder=T.MathUtils.smoothstep(y,1.7,4.5)*(.5+.5*Math.sin(x*1.2+z*.37));
    const colour=new T.Color('#79a66b').lerp(new T.Color('#c0d98c'),patch*.65).lerp(new T.Color('#b4bc8a'),shoulder*.25);
    // Grass material supplies the base tint; these linear multipliers vary it gently.
    hillColours.push(.76+colour.r*.38,.80+colour.g*.30,.73+colour.b*.42);
  }
  hillGeo.setAttribute('color',new T.Float32BufferAttribute(hillColours,3));grass.vertexColors=true;
  mesh(hillGeo, grass, fixed, 0, .02, 0).name = 'Continuous green terrain from road to summit';
  for (const s of specs) {
    const g = group(s.name, fixed, s.x, threshold + (s.lift ?? 0), s.z); g.userData.program = s.name;
    // A plot's heading, where the coast asks for one: the two towers at the ends of the south row
    // face the diagonal shore they stand on rather than the row. Nothing else is turned — a few
    // degrees on a 2.5-unit building costs about 0.13 of the street it stands beside, and the
    // frontage has none to spare.
    if (s.rot) g.rotation.y = T.MathUtils.degToRad(s.rot);
    g.scale.set(s.planScale ?? 1, s.heightScale ?? 1, s.planScale ?? 1);
    buildings.push({ name: s.name, group: g, width: s.w, depth: s.d, height: s.h, kind: s.kind, use: s.use, lift: s.lift ?? 0 });
  }
  // Low, embedded granite outcrops leave both the tram and the summit apron clear.
  for(const [cx,cz]of [[1.4,-5.5],[8.9,-4.2],[2.8,-9.2]])for(let i=0;i<7;i++){
    const x=cx+(random()-.5)*1.2,z=cz+(random()-.5)*1.0,r=.12+random()*.20;
    const y=peakHeight(x,z);
    if(y<.5||!peakTram.clearForTrees(x,z,r+.25)||Math.hypot(x-PEAK.cx,z-PEAK.cz)<2.5)continue;
    const rock=mesh(new T.IcosahedronGeometry(r,0),stones,fixed,x,y+.02,z);
    rock.scale.set(1.25,.48+random()*.35,1);rock.rotation.set(random()*.4,random()*6,.1);
  }
  // The island's greenery is the mountain, and it is planted rather than sprinkled. Uniform scatter
  // reads as texture no matter how many trees are in it — the eye wants clumps and clearings, which
  // is what a wooded hillside has — so the trees go into six groves. They also thin and shrink as
  // they climb, which is what a treeline does, and it keeps the summit from standing in trees the
  // size of the tower. The shore keeps only what the harbour itself needs.
  const groves = [[6.4, -3.4], [4.0, -4.8], [2.4, -7.2], [0.4, -3.0], [7.8, -6.2], [5.2, -9.2]];
  for (let i = 0; i < 104; i++) {
    const [gx, gz] = groves[Math.floor(random() * groves.length)];
    const px = gx + (random() - .5) * 3.6, pz = gz + (random() - .5) * 3.6;
    const ground = peakHeight(px, pz);
    if (ground < .38) continue;
    if (random() < ground / 11) continue;                       // thinning towards the treeline
    if (Math.abs(px - 6.85) < 1.0 && pz < -.4) continue;         // retain the open hillside sightline
    if (Math.hypot(px - 6.85, pz + 8.60) < 2.2) continue;         // and so does the tower's apron
    if (!peakTram.clearForTrees(px, pz, .52)) continue;
    tree(fixed, px, ground - .05, pz, (.58 + random() * .48) * (1 - .42 * (ground / PEAK.top)));
  }
  // Roadside groves stand on the same terrain as the mountain, with no separate bank.
  for (const [cx, cz] of [[-4.20, 1.60], [-4.20, -3.40], [-4.20, -7.60]]) {
    for (let i = 0; i < 5; i++) {
      const px = cx + (random() - .5) * .50, pz = cz + (random() - .5) * 2.2;
      if (!peakTram.clearForTrees(px, pz, .36)) continue;
      tree(fixed, px, peakHeight(px, pz) - .05, pz, .52 + random() * .30);
    }
  }
  // Keep the summit parapet and planting above the uninterrupted hillside.
  const CREST = 5.22;
  for (const [from, to] of [[4.90, 6.30], [7.40, 8.30]]) {
    box(to - from, .34, .16, m.stone, fixed, (from + to) / 2, CREST + .08, -6.62, .03);
  }
  // Planting in the walkway the parapet and the plinth leave between them: four shrubs is all that
  // fits, and they are what stops the plinth's wall meeting the wall behind it.
  for (const x of [5.60, 8.05, 5.20, 8.30]) if (peakTram.clearForTrees(x, -7, .18)) tree(fixed, x, CREST + .02, -7.00, .30);
  // Bare paving meets the continuous cliff along the north and east coast.
  for (const [x, z] of [[9.3, 8.6], [2.7, 8.95], [-8.0, 11.0]]) {
    const rock = mesh(new T.IcosahedronGeometry(.35, 0), stones, fixed, x, -.25 - landRise, z); rock.scale.set(1, .72, 1.2);
  }
  // Granite riprap at the toe of the HKCEC seawall, clear of its walkway.
  const hkcecRocks=group('HKCEC shoreline rock cluster',fixed);
  const rockShore=[[-7.3,10.6],[-5.7,9.6],[-4.95,8.65]];
  let rockIndex=0;
  for(let segment=0;segment<rockShore.length-1;segment++) {
    const [ax,az]=rockShore[segment],[bx,bz]=rockShore[segment+1];
    const length=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/length,nz=(bx-ax)/length;
    const count=Math.ceil(length/.30);
    for(let i=0;i<count;i++) {
      const t=(i+.35)/count,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      for(let row=0;row<(i%3===1?2:1);row++) {
        const variation=.5+.5*Math.sin(++rockIndex*8.73),radius=.20+variation*.12;
        const offset=.16+row*.34+Math.sin(rockIndex*2.1)*.045;
        const rock=mesh(new T.IcosahedronGeometry(radius,0),stones,hkcecRocks,
          x+nx*offset,ocean.level-landRise+.015-row*.065,z+nz*offset);
        rock.name='Partly submerged coastal granite boulder';
        rock.scale.set(1.10+variation*.22,.70+variation*.28,.85+variation*.26);
        rock.rotation.set(.15*Math.sin(rockIndex),rockIndex*2.4,.12*Math.cos(rockIndex*1.7));
      }
    }
  }
  // Water is read from lines, not from patches. A scatter of round pale facets was tried here
  // first and it read as stains on the sea — irregular shapes appear a moment after the water
  // does, and the eye files them as dirt. What actually sells a shoreline in this style is a thin
  // bright edge where the water meets the land, and rings where something is floating in it.
  // Both surfaces are lit rather than flat white: an unlit one keeps its full brightness after
  // dark and the shoreline turns into a light strip, which is brighter than the neon it is
  // supposed to sit under.
  const surf = new T.MeshStandardMaterial({ color: m.coastalPaving.color, roughness: 1, transparent: true, opacity: .42, depthWrite: false });
  const surfGeometry = new T.ExtrudeGeometry(
    waterfrontStrip(1.018, 1.000),
    { depth: .16, bevelEnabled: false, curveSegments: 1 }
  );
  surfGeometry.rotateX(-Math.PI / 2);
  const surfLine = mesh(surfGeometry, surf, oceanRoot, 0, -.44, 0);
  surfLine.name = 'Surf line where water meets land'; surfLine.renderOrder = 6;
  const ripple = new T.MeshStandardMaterial({ color: '#e2f9ff', roughness: 1, transparent: true, opacity: .38, depthWrite: false, side: T.DoubleSide });
  // Seeded, well-separated positions in the expanded camera-facing harbour.
  const [FERRY] = placeHarbourVessels(shoreline, worldBounds);
  const wake = group('Star Ferry wake', oceanRoot, FERRY.x, -.334, FERRY.z);
  wake.rotation.y = FERRY.angle; wake.scale.setScalar(FERRY.scale);
  for (const [along, across] of [[1.62, .50], [1.95, .60], [2.34, .70]]) {
    const ring = mesh(new T.RingGeometry(1, 1.045, 44), ripple, wake, 0, 0, 0);
    ring.rotation.x = -Math.PI / 2; ring.scale.set(across, along, 1); ring.renderOrder = 6;
  }
  for (const side of [-1, 1]) beam([side * .18, 0, -1.30], [side * .62, 0, -3.00], .04, ripple, wake);
  // A timber jetty, its gangway and the little ferry that moored at it stood here, off the
  // north-east corner at (-7.6, 9.3): a deck of planks on piles, a ramp up to the shore, and a
  // white-hulled boat with a red roof alongside. The user asked for the pier and the boat at the
  // south-west to go, and they went together, because the ferry existed only to lie at that jetty.
  // `roofRed` went with them: the ferry's roof was the only thing in the world built in it.
  // What is left on the water is the footbridge and the pier head on the harbour shore, and the Star
  // Ferry standing off the pier. The rowing dinghy that used to lie off the south strand and the
  // launch that lay off the east were asked for and removed; the designs are still built in
  // `harbor-boats.mjs`, so either can be put back with one call.
  const boats = [];
  function boat(x, z, angle, design, scale = 1) {
    const g = buildHarborBoat(design, m); root.add(g); g.scale.setScalar(scale); g.position.set(x, ocean.level + .08, z); g.rotation.y = angle; boats.push({ g, x, z, angle, design, scale });
  }
  boat(FERRY.x, FERRY.z, FERRY.angle, 'star', FERRY.scale);
  const animateShips=createHarbourMotion(boats,{ferryWake:wake,waterLevel:ocean.level});
  root.userData.animateShips=animateShips;
  // The promenade is the continuous island paving. Extra coping, margin
  // bands and rectangular forecourt slabs previously made arbitrary raised
  // patches (including directly in front of BOC Tower).
  // Bollards at a walking interval, on the outer half of the coping so they stand on stone. They are
  // stepped around the island's own outline rather than placed by hand, because the coast is a
  // polygon of thirty-nine points and any hand-placed line would wander off it somewhere.
  for (let i = 0, travelled = 0, next = 1.4; i < waterfront.length - 1; i++) {
    const [ax, az] = waterfront[i], [bx, bz] = waterfront[i + 1];
    const length = Math.hypot(bx - ax, bz - az);
    while (next <= travelled + length) {
      const t = (next - travelled) / length, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      // The landing and its footbridge carry their own furniture; a bollard inside that stretch
      // would be the one nobody could reach.
      if (!(x > -5.8 && x < -3.0 && z > 8.1)) {
        cylinder(.06, .26, m.stone, fixed, x * .986, .20 + .13, z * .986, .05);
        cylinder(.045, .05, m.metal, fixed, x * .986, .20 + .285, z * .986);
      }
      next += 1.7;
    }
    travelled += length;
  }
  for (const [x, z, size] of [[4.15, 8.25, .50], [-2.00, 8.05, .46], [-3.80, 8.25, .44], [10.45, 5.70, .50], [10.50, 4.10, .44]]) {
    tree(fixed, x, threshold - .03, z, size);
  }
  // A regular line of lamps on the inland verge follows only the surviving road.
  root.userData.streetLamps=[];
  for (const segment of roadCurve.segments.filter(segment => segment.kind === 'straight')) {
    const count = Math.max(1, Math.floor(segment.length / 4));
    for (let i = 0; i < count; i++) {
      const u = (segment.start + segment.length * (i + .5) / count) / roadLength;
      const { point } = roadSample(u, -1.12);
      const ground = peakHeight(point.x, point.z) + .02;
      root.userData.streetLamps.push(new T.Vector3(point.x,ground+1.265+landRise,point.z));
      cylinder(.055, 1.2, m.metal, fixed, point.x, ground + .6, point.z); puff(.14, .10, .14, m.warm, fixed, point.x, ground + 1.265, point.z); cylinder(.17, .055, m.stone, fixed, point.x, ground + 1.365, point.z);
    }
  }
  // The observation wheel, and the harbourfront it needs.
  //
  // In the city the wheel stands on the Central reclamation in front of Two IFC, on the land between
  // Central Pier 9 and Central Pier 10: a 60-metre wheel of 42 gondolas on a site of 9,620 square
  // metres, nearly all of it public plaza. Those facts are what place it here — directly out from the
  // IFC's own frontage, on the quay the reclamation built for it, with the two public piers flanking
  // it along the water rather than standing anywhere near it, and with the convention centre next
  // door to the east, which is the neighbour it actually has: the wheel's land is a strip cut off the
  // convention centre's own promontory, with the office cluster behind both of them. Its site in the
  // city is a strip between the road behind and the harbour in front, so the wheel is wedged across
  // the middle of that strip with barely a unit of paving either side, which is what it looks like
  // from the Peak: a circle standing almost in the water with the IFC's shoulder behind it.
  //
  // The disc is set parallel to the quay, so it faces the harbour and reads as a circle from across
  // the water and from this camera, which looks along the diagonal. It turns: a still wheel is a
  // monument, and a turning one is what the thing in the city is.
  //
  // Readable enclosed gondolas hang level from the rotating rim.
  const WHEEL = { x: 8.60, z: 9.25, radius: 2.10, hub: 2.55, gondolas: 16, speed: .14 };
  const axleHeight = .38 + WHEEL.hub;
  const wheelBase = box(2.30, .16, 1.30, m.stone, fixed, WHEEL.x, .28, WHEEL.z, .03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    beam([WHEEL.x + sx * .82, .36, WHEEL.z + sz * .48], [WHEEL.x + sx * .12, axleHeight - .06, WHEEL.z + sz * .26], .13, m.stone, fixed);
  }
  cylinder(.13, .72, m.metal, fixed, WHEEL.x, axleHeight, WHEEL.z).rotation.x = Math.PI / 2;
  const wheelAssembly=createObservationWheel({radius:WHEEL.radius,gondolas:WHEEL.gondolas,white:m.white});
  const wheel=wheelAssembly.group;root.add(wheel);wheel.position.set(WHEEL.x,axleHeight+landRise,WHEEL.z);
  root.add(wheelAssembly.uplights);wheelAssembly.uplights.position.copy(wheel.position);
  wheel.getObjectByName('Observation Wheel rims and primary spokes').material.userData.wheelUplightRange=[.81,axleHeight+landRise+WHEEL.radius];
  selectable('Hong Kong Observation Wheel', wheelBase, 4.4, 1.6, 4.7, 'A 60-metre wheel with 42 gondolas, standing on reclaimed land on the Central harbourfront with an open quay in front of it. It is the only circle on the waterfront, and the only thing in the district that turns for the pleasure of it.');
  const observationWheel = { group: wheel, base: wheelBase, x: WHEEL.x, z: WHEEL.z, radius: WHEEL.radius, height: WHEEL.hub + WHEEL.radius + .045, gondolas: WHEEL.gondolas, speed: WHEEL.speed, cabins:wheelAssembly.cabins, animate:time=>wheelAssembly.animate(time,WHEEL.speed) };
  const piers = [];
  for (const [x, z, size] of [[10.50, 8.30, .46], [3.55, 9.45, .48], [2.15, 8.55, .42]]) tree(fixed, x, threshold - .03, z, size);
  for (const [x, z] of [[10.22, 8.20], [2.95, 8.75]]) {
    cylinder(.055, 1.2, m.metal, fixed, x, .825, z); puff(.14, .10, .14, m.warm, fixed, x, 1.49, z); cylinder(.17, .055, m.stone, fixed, x, 1.59, z);
  }
  // A single Hong Kong flag in the exhibition centre forecourt.
  const conventionPlot = buildings.find(b => b.kind === 'convention centre');
  const flags = group('HKCEC forecourt flags', fixed, conventionPlot.group.position.x, threshold, conventionPlot.group.position.z);
  flags.rotation.copy(conventionPlot.group.rotation);
  flags.scale.set(conventionPlot.group.scale.x, 1, conventionPlot.group.scale.z);
  for (const x of [-1.0]) {
    cylinder(.030, 1.30, m.metal, flags, x, .65, 1.49);
    cylinder(.075, .10, m.stone, flags, x, .05, 1.49);
    const flag=createHongKongFlag();root.add(flag);flags.updateWorldMatrix(true,false);
    flag.position.copy(flags.localToWorld(new T.Vector3(x+.16,1.12,1.49)));
    flag.quaternion.copy(flags.getWorldQuaternion(new T.Quaternion()));
    flag.scale.copy(flags.getWorldScale(new T.Vector3()));
  }
  // A little standing wood on the corner, clear of the halls' own footprint, where the promontory is
  // too narrow in front of them for anything but the masts.
  for (const [x, z] of [[-4.95, 7.00], [-5.05, 6.40], [-10.3, 8.95]]) tree(fixed, x, threshold - .03, z, .44);
  // Two traffic lanes share the open coastal route.
  for (const [i,kind] of ['bus','taxi','bus','taxi'].entries()) {
    const {group:g,length}=createHongKongVehicle(kind);root.add(g);
    cars.push({ g, length, phase: .14 + i * .23, dir: i % 2 ? -1 : 1 });
  }
  const clouds = []; // Sky decoration is painted behind the map, outside the world.
  // Everything in the air over the district was asked for and then removed in turn: the harbor
  // balloon was the last of it, and with it went the sky. What is above the map now is the sky
  // backdrop, which is painted rather than modelled, and it is the only thing up there.
  // The harbour extension has a broad vaulted roof, a high curved glass foyer,
  // lower swept side canopies and a terraced waterfront base. Its geometry is
  // built separately so the roof/facade fit can be checked before city batching.
  models['Hong Kong Convention and Exhibition Centre'] = createHKCEC();
  models['The Peak Tower']=createPeakTower();
  // The five eastern landmarks are authored in Blender with real facade openings,
  // recessed glazing and distinct roof/service details. BUILDING_MODELS loads them
  // through the same path as the Central towers, without a procedural fallback.
  // The promenade the reclamation is for when there is no exhibition on: two runs of flag masts
  // flanking the halls, which is what the approach to the halls looks like from the water, and one
  // tree at the corner where the walk arrives from the ferry piers. Masts and no flags with marks on
  // them, for the same reason the signs have no lettering: the world says what a thing is by its
  // shape.
  tree(fixed, 6.85, threshold - .03, 7.55, .46);
  // Every plot is a model. Attaching one means three things: its materials are swapped for the
  // district's own by name, the openings it names are filled with furnished rooms, and the
  // record gains the height the model turned out to be. Swapping materials by name is what
  // makes this affordable — the district batches by material object and has one spare batch, so
  // a model whose materials are named for palette keys merges into batches that already exist
  // rather than spending a batch of its own. A material the model names that the palette does
  // not have is reported rather than quietly ignored, because it costs a batch.
  const FACING = { zp: 0, zn: Math.PI, xp: Math.PI / 2, xn: -Math.PI / 2 };
  for (const b of buildings) {
    const model = models?.[b.name];
    if (!model) continue;
    const unmapped = new Set();
    const openings = [];
    model.traverse(o => {
      if (o.name.startsWith('win_')) { openings.push(o); return; }
      if (!o.isMesh) return;
      const shared = m[o.material.name];
      if (shared) o.material = shared; else unmapped.add(o.material.name);
      if(b.name==='Two IFC'&&/^IFC[_ ]compact[_ ]crown[_ ]fin/i.test(o.name))o.material=m.ifcCrown;
      if(b.name==='Bank of China Tower'&&o.material===m.crystal)o.material=m.bocGlass;
      if(b.name==='Bank of China Tower'&&/^boc[_ ](?:diagonal[_ ]frame|roof[_ ]edge|upright[_ ]corner|central[_ ]upright|skyline[_ ]mast|mast[_ ](?:link|support))/i.test(o.name)){
        o.material=/skyline[_ ]mast/i.test(o.name)?m.bocMast:m.bocFrame;
      }
      const tint = GLASS_TINT[b.name];
      if (tint) { if (o.material === m.crystal) o.material = tint.crystal; else if (o.material === m.spandrel) o.material = tint.spandrel; else if(tint.base&&o.material===m.glass)o.material=tint.base; }
      o.castShadow = true; o.receiveShadow = true;
    });
    const bounds = new T.Box3().setFromObject(model);
    // The glass falls from bright at the roof to dark at the pavement, per building, measured from
    // the island's street rather than from the model's own foot, lifted on the faces that look out
    // over the water, and lifted again on the buildings that stand on the quay.
    model.updateWorldMatrix(true, true);
    const floorCuts=[];
    model.traverse(o=>{
      if(!o.isMesh||!/flush[_ ]floor[_ ]joint|suspended[_ ]floor[_ ]edge|lippo[_ ]arm[_ ]collar/i.test(o.name))return;
      const y=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).y;
      if(!floorCuts.some(value=>Math.abs(value-y)<.03))floorCuts.push(y);
    });
    floorCuts.sort((a,b)=>a-b);
    model.traverse(o => {
      if (o.isMesh && glassMaterials.has(o.material)) {
        glassFall(o, bounds, b.lift, b.group.position, b.width, b.depth);
        const opaqueBand=o.material===m.spandrel||Object.values(GLASS_TINT).some(tint=>o.material===tint.spandrel);
        prepareGlazingLight(o,{opaqueBand,floorCuts,buildingName:b.name});
      }
      else if(o.isMesh&&(o.material===m.hkcecGlass||o.material===peakGlass.base))prepareGlazingLight(o,{buildingName:b.name});
      else if(o.isMesh&&o.material===m.hkcecRoof)prepareHKCECAccent(o,'roof');
      else if(o.isMesh&&o.material===m.hkcecTerrace)prepareHKCECAccent(o,'terrace');
      else if(o.isMesh&&(o.material===m.peakFascia||o.material===m.peakLouvre))preparePeakLighting(o);
      else if(o.isMesh&&o.material===m.ifcCrown)prepareIFCCrownLight(o);
    });
    // The openings are named positions rather than geometry, so they come out of the model
    // before it is placed. Each one is a hole in a facade, and a room goes in it facing the way
    // the name says the hole faces.
    for (const o of openings) o.removeFromParent();
    b.group.add(model);
    if (model.userData.footprint) {
      b.group.updateWorldMatrix(true, true);
      b.footprint = model.userData.footprint.map(([x, z]) => model.localToWorld(new T.Vector3(x, 0, z)));
    }
    b.height = bounds.max.y * b.group.scale.y + b.lift;
    for (const [i, o] of openings.entries()) {
      // The name carries the opening's size in hundredths, because a decimal point does not
      // survive the round trip through glTF, and the face it looks out of.
      const [, width, height, face] = o.name.split('_');
      const slot = group('Modelled room', b.group, o.position.x, o.position.y, o.position.z);
      slot.rotation.y = FACING[face] ?? 0;
      room(slot, { width: +width / 100, height: +height / 100, shape: 'rounded', curvature: 0 }, m.white, i);
    }
    selectable(b.name, b.group, b.width, b.depth, b.height, `${b.name}: ${b.use}. One of the ${b.kind} buildings of the harbor district.`);
    if (unmapped.size) console.warn(`${b.name} has materials with no palette entry: ${[...unmapped].join(', ')}`);
  }
  // Opaque geometry shares batches; translucent glazing is sorted separately.
  root.updateMatrixWorld(true);
  const submergedLandBounds = new T.Box3().setFromObject(landBody);
  // A few low illuminated panes cast actual light onto their neighbouring frames
  // and paving. Positions come from the existing glass, before it is batched.
  root.userData.windowSpillSources=[];
  for(const building of buildings){
    const candidates=[];
    const centre=building.group.getWorldPosition(new T.Vector3());
    const coast=new T.Vector3(centre.x-PEAK.cx,0,centre.z-PEAK.cz).normalize();
    building.group.traverse(object=>{
      const emission=object.geometry?.attributes.harbourEmission;
      if(!emission||!emission.array.some(value=>value>.5))return;
      const bounds=new T.Box3().setFromObject(object),position=bounds.getCenter(new T.Vector3());
      if(position.y>landRise+2.5||bounds.max.y-bounds.min.y>1.2)return;
      const outward=position.clone().sub(centre);outward.y=0;
      if(outward.length()<.2||outward.normalize().dot(coast)<.6)return;
      const colour=new T.Color();let peak=0;
      for(let i=0;i<emission.count;i++){
        const r=emission.getX(i),g=emission.getY(i),b=emission.getZ(i),brightness=Math.max(r,g,b);
        if(brightness>peak){peak=brightness;colour.setRGB(r,g,b);}
      }
      colour.multiplyScalar(1/peak).lerp(new T.Color('#ffffff'),.08);
      candidates.push({position:position.addScaledVector(outward,.20),colour,buildingName:building.name});
    });
    candidates.sort((a,b)=>a.position.y-b.position.y);
    if(candidates.length&&root.userData.windowSpillSources.length<4)root.userData.windowSpillSources.push(candidates[0]);
  }
  const batches = new Map();
  fixed.traverse(o => { if (!o.isMesh || o.material.transparent) return; const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); if (!geo.attributes.uv) geo.setAttribute('uv', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)); if (!batches.has(o.material)) batches.set(o.material, []); batches.get(o.material).push(geo); });
  const merged = group('Coastal static batches', root);
  for (const [material, geometries] of batches) { const geo = mergeGeometries(geometries, false); if (!geo) throw new Error('Incompatible coastal geometry'); const o = new T.Mesh(geo, material); o.castShadow = true; o.receiveShadow = true; merged.add(o); geometries.forEach(g => g.dispose()); }
  const remove = []; fixed.traverse(o => { if (o.isMesh && !o.material.transparent) remove.push(o); }); remove.forEach(o => o.removeFromParent());
  const framingPoints = [];
  const addBounds = (b) => { for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) framingPoints.push(new T.Vector3(x, y, z)); };
  addBounds(new T.Box3(new T.Vector3(worldBounds.minX, ocean.floor, worldBounds.minZ), new T.Vector3(worldBounds.maxX, 0, worldBounds.maxZ))); for (const b of buildings) addBounds(new T.Box3(new T.Vector3(b.group.position.x - b.width / 2, threshold + landRise, b.group.position.z - b.depth / 2), new T.Vector3(b.group.position.x + b.width / 2, b.height + threshold + landRise, b.group.position.z + b.depth / 2)));
  addBounds(new T.Box3(new T.Vector3(-11.4, 5.8, 2), new T.Vector3(-9.7, 8.5, 4)));
  const animateCanopies=createCanopyInstances(root,trees);
  let lastTime = 0;
  function animate(time) {
    lastTime = time;
    peakTram.animate(time);
    for (const car of cars) {
      const u = T.MathUtils.euclideanModulo(car.phase + time / roadLength * .56 * car.dir, 1);
      const { point, heading } = roadSample(u, car.dir * -laneOffset);
      car.progress = u;
      // Recycle traffic while hidden at the open ends; never drive a closing
      // chord across the city or turn around through the opposite lane.
      const inset = (car.length / 2 + .08) / roadLength;
      car.g.visible = u > inset && u < 1 - inset;
      car.g.position.copy(point); car.g.position.y = .246 + landRise; car.g.rotation.y = heading + (car.dir < 0 ? Math.PI : 0);
    }
    animateShips(time);
    observationWheel.animate(time);
    trees.forEach((c, i) => c.rotation.z = Math.sin(time * .6 + i) * .018);
    animateCanopies();
    root.updateMatrixWorld(true);
  }
  const cyberpunk = { materials: { cyan: m.teal, magenta: m.pink, violet: m.violet, acid: m.sage }, setGlow() { } };
  animate(0);
  return { root, materials, buildings, windows, places, cars, trees, clouds, boats, observationWheel, piers, peakTram, animate, cyberpunk, framingPoints, ocean: { ...ocean, lower: lowerOcean, upper: upperOcean, sides: oceanSides }, land: { rise: landRise, top: .20 + landRise, bottom: ocean.floor, outline: shoreline, bodyBounds: submergedLandBounds, waterfront }, road: { sample: roadSample, length: roadLength, width: roadWidth, laneOffset, closed: false, segments: roadCurve.segments, closestPoint: roadCurve.closestPoint, crossings }, worldSize: WORLD, worldWidth: WORLD, worldDepth: WORLD, worldCenter: [...HARBOUR_CENTER], worldBounds, interiorLights: [], statistics: { staticBatches: batches.size }, get time() { return lastTime; } };
}

export {createCoastalLighting} from './coastal-lighting.mjs';
