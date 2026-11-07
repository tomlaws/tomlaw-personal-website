import * as T from 'three';

export function archShape(width, height) {
  const shape = new T.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height - width / 2);
  shape.absarc(0, height - width / 2, width / 2, 0, Math.PI, false);
  shape.lineTo(-width / 2, 0);
  return shape;
}

function openingShape(width, height, kind = 'arch', radius = .055) {
  if (kind === 'arch') return archShape(width, height);
  const shape = new T.Shape();
  if (kind === 'round') {
    shape.absellipse(0, height / 2, width / 2, height / 2, 0, Math.PI * 2, false, 0);
    return shape;
  }
  const r = Math.min(radius, width / 2, height / 2), a = -width / 2, b = width / 2;
  shape.moveTo(a + r, 0); shape.lineTo(b - r, 0); shape.quadraticCurveTo(b, 0, b, r);
  shape.lineTo(b, height - r); shape.quadraticCurveTo(b, height, b - r, height);
  shape.lineTo(a + r, height); shape.quadraticCurveTo(a, height, a, height - r);
  shape.lineTo(a, r); shape.quadraticCurveTo(a, 0, a + r, 0);
  return shape;
}

function openingPath({ width, height, x = 0, y = 0, shape = 'arch', radius = .055 }) {
  return new T.Path(openingShape(width, height, shape, radius).getPoints(20).map(p => p.add(new T.Vector2(x, y))));
}

// These are actual holes through the wall, so the rooms remain visible behind the glass.
export function facadeGeometry(width, height, openings, thickness = .075, bottom = .1, horizontalSegments = 1) {
  const shape = new T.Shape();
  shape.moveTo(-width / 2, bottom);
  for (let i = 1; i <= horizontalSegments; i++) shape.lineTo(-width / 2 + width * i / horizontalSegments, bottom);
  shape.lineTo(width / 2, bottom + height);
  for (let i = horizontalSegments - 1; i >= 0; i--) shape.lineTo(-width / 2 + width * i / horizontalSegments, bottom + height);
  shape.closePath();
  for (const opening of openings) shape.holes.push(openingPath(opening));
  return new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -thickness);
}

function bendGeometry(geometry, radius, radialOffset = 0) {
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  for (let i = 0; i < positions.count; i++) {
    const angle = positions.getX(i) / radius, r = radius + positions.getZ(i) + radialOffset;
    positions.setXYZ(i, Math.sin(angle) * r, positions.getY(i), Math.cos(angle) * r - radius);
    if (normals) {
      const nx = normals.getX(i) * radius / r, ny = normals.getY(i), nz = normals.getZ(i);
      const normal = new T.Vector3(Math.cos(angle) * nx + Math.sin(angle) * nz, ny, -Math.sin(angle) * nx + Math.cos(angle) * nz).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
  }
  return geometry;
}

export function curvedFacadeGeometry(radius, height, openings, thickness = .075, bottom = .05) {
  // Facade coordinates unwrap the cylinder. Positive extrusion always faces outward.
  const geometry = facadeGeometry(Math.PI * 2 * radius, height, openings, thickness, bottom, 96);
  bendGeometry(geometry, radius);
  geometry.translate(0, 0, radius);
  return geometry;
}

export function createWindowSystem({ mesh, box, cyl, sphere, material, materials: m }) {
  const windows = [], lights = [];
  const glass = new T.MeshPhysicalMaterial({
    color: '#d6e5e3', metalness: 0, roughness: .085, transparent: true, opacity: .16,
    depthWrite: false, clearcoat: 1, clearcoatRoughness: .07, ior: 1.45, envMapIntensity: .8,
  });
  glass.name = 'Clear architectural glass';
  const unlit = material('#c9d0d8');
  const floor = material('#efdcc4', { emissive: '#c9ab88', emissiveIntensity: .05 });
  const ceiling = material('#f6efe4');
  const curtain = material('#f4e7da', { side: T.DoubleSide });
  const shade = material('#f7ead0', { side: T.DoubleSide });
  const roomMaterials = new Map();
  const palettes = { study: '#e6cf9c', lounge: '#f0b8a8', bedroom: '#b6c8e8', kitchen: '#eecfa0', books: '#e0b98f', studio: '#a8dcc4', door: '#dcc6a0', records: '#d8b4cc', boutique: '#e6c0b0', objects: '#b6d8cc', bakery: '#eccda8', arcade: '#c0b8f0' };

  function roomMaterial(type, lit) {
    const key = `${type}:${lit}`;
    if (!roomMaterials.has(key)) {
      // A directional wash makes the back wall brightest under the fixture, not a solid emissive tile.
      const size = 32, pixels = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const u = x / (size - 1), v = y / (size - 1);
        const glow = Math.exp(-((u - .7) ** 2 * 5 + (v - .78) ** 2 * 3));
        const value = Math.round(255 * (.32 + glow * .68)), i = (y * size + x) * 4;
        pixels.set([value, value, value, 255], i);
      }
      const wash = new T.DataTexture(pixels, size, size); wash.needsUpdate = true; wash.magFilter = T.LinearFilter; wash.minFilter = T.LinearFilter;
      const mat = material(lit ? palettes[type] : '#bdc5d5', { map: wash, emissiveMap: wash, emissive: '#ffe0ae', emissiveIntensity: lit ? .12 : .008 });
      mat.name = `${type} interior ${lit ? 'lit' : 'quiet'}`;
      roomMaterials.set(key, mat);
    }
    return roomMaterials.get(key);
  }

  function addWindow({ width: w, height: h, x = 0, y = 0, z = 0, parent, angle = 0, lit = true, type = 'study', depth = .36, curvature = 0, realLight = false, shape = 'arch', radius = .055, mullions = 'vertical', trim = m.metal }) {
    const group = new T.Group(); group.name = `${type} room`; group.position.set(x, y, z); group.rotation.y = angle; parent.add(group);
    const outer = new T.Shape(openingShape(w + .044, h + .044, shape, radius + .022).getPoints(24).map(p => p.add(new T.Vector2(0, -.022))));
    outer.holes.push(openingPath({ width: w, height: h, shape, radius }));
    const frameGeometry = new T.ExtrudeGeometry(outer, { depth: .065, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -.04);
    if (curvature) bendGeometry(frameGeometry, curvature);
    const frame = mesh(frameGeometry, trim, 0, 0, 0, group);
    frame.name = 'Open window frame';
    const glassGeometry = new T.ShapeGeometry(openingShape(w - .012, h - .012, shape, radius), 20).translate(0, .006, -.016);
    if (curvature) bendGeometry(glassGeometry, curvature);
    const pane = mesh(glassGeometry, glass, 0, 0, 0, group); pane.castShadow = false; pane.receiveShadow = false; pane.name = 'Glass pane';
    const wallMaterial = roomMaterial(type, lit);
    const back = box(w + .045, h + .025, .025, wallMaterial, 0, h / 2, -depth, group, 0); back.name = 'Recessed room back';
    box(w + .045, .022, depth, lit ? floor : unlit, 0, -.008, -depth / 2, group, 0);
    box(w + .045, .025, depth, ceiling, 0, h - .006, -depth / 2, group, 0);
    for (const side of [-1, 1]) box(.022, h, depth, wallMaterial, side * (w / 2 + .006), h / 2, -depth / 2, group, 0);
    const decor = [];
    const detail = object => { object.name = `${type} furnishing`; object.castShadow = false; decor.push(object); return object; };

    // Furniture is placed inside the chamber, relative to the outward window normal.
    if (type === 'boutique') {
      detail(box(w * .76, .022, depth * .30, m.wood, 0, h * .24, -depth * .58, group));
      for (let stack = 0; stack < 3; stack++)for (let layer = 0; layer < 3; layer++)
        detail(box(w * .17, .028, depth * .21, [m.cream, m.rose, m.sage][(stack + layer) % 3], w * (-.23 + stack * .23), h * .28 + layer * .03, -depth * .58, group, .01));
      detail(box(w * .68, .018, .018, m.copper, 0, h * .70, -depth * .77, group));
      for (let i = 0; i < 4; i++) {
        detail(cyl(.004, h * .12, m.metal, w * (-.26 + i * .17), h * .65, -depth * .77, group));
        detail(box(w * .12, h * .20, .035, [m.cream, m.blue, m.rose, m.sage][i], w * (-.26 + i * .17), h * .49, -depth * .77, group, .012));
      }
    } else if (type === 'objects') {
      for (let row = 0; row < 2; row++) {
        const yy = h * (.24 + row * .30);
        detail(box(w * .77, .025, depth * .27, m.wood, 0, yy, -depth * .72, group));
        for (let i = 0; i < 3; i++) {
          const xx = w * (-.25 + i * .25);
          detail(cyl(w * .045, h * .11, [m.peach, m.sage, m.cream][i], xx, yy + h * .065, -depth * .70, group, w * .032));
          detail(sphere(w * .064, h * .045, w * .047, [m.cream, m.rose, m.blue][i], xx, yy + h * .14, -depth * .70, group));
        }
      }
      detail(box(w * .40, h * .16, depth * .28, m.stone, 0, h * .08, -depth * .30, group));
      detail(sphere(w * .11, h * .09, w * .09, m.copper, 0, h * .25, -depth * .30, group));
    } else if (type === 'bakery') {
      detail(box(w * .80, h * .27, depth * .32, m.woodDark, 0, h * .135, -depth * .50, group));
      detail(box(w * .85, .026, depth * .36, m.stone, 0, h * .28, -depth * .50, group));
      const display = detail(box(w * .79, h * .17, depth * .28, glass, 0, h * .38, -depth * .50, group, .006)); display.receiveShadow = false;
      for (let row = 0; row < 2; row++)for (let i = 0; i < 4; i++)
        detail(sphere(w * .055, h * .035, depth * .047, i % 2 ? m.cream : m.wood, w * (-.28 + i * .185), h * .32, -depth * (.42 + row * .17), group));
      detail(box(w * .65, .025, depth * .20, m.wood, 0, h * .64, -depth * .82, group));
      for (let i = 0; i < 4; i++)detail(cyl(w * .035, h * .075, m.copper, w * (-.23 + i * .15), h * .69, -depth * .81, group));
    } else if (type === 'books' || type === 'study' || type === 'records') {
      for (let row = 0; row < 2; row++) {
        detail(box(w * .62, .018, depth * .2, m.woodDark, -w * .06, h * (.26 + row * .25), -depth * .79, group, 0));
        for (let i = 0; i < 5; i++) detail(box(w * .069, h * (.12 + (i % 3) * .025), .039, [m.rose, m.blue, m.sage, m.wood, m.peach][i], w * (-.27 + i * .1), h * (.34 + row * .25), -depth * .77, group, .002));
      }
      detail(box(w * .62, .022, depth * .32, m.wood, w * .04, h * .15, -depth * .44, group));
      detail(box(w * .2, .013, depth * .14, m.cream, w * .08, h * .18, -depth * .43, group));
      if (type === 'records') {
        detail(cyl(w * .105, .012, m.dark, w * .16, h * .19, -depth * .44, group));
        detail(cyl(w * .029, .014, m.coral, w * .16, h * .195, -depth * .44, group));
        for (const side of [-1, 1]) {
          detail(box(w * .11, h * .26, depth * .15, m.woodDark, side * w * .34, h * .21, -depth * .63, group));
          const cone = detail(cyl(w * .033, .008, m.dark, side * w * .34, h * .24, -depth * .55, group)); cone.rotation.x = Math.PI / 2;
        }
      }
    } else if (type === 'kitchen') {
      detail(box(w * .8, h * .28, depth * .28, m.sage, 0, h * .14, -depth * .65, group));
      detail(box(w * .85, .025, depth * .32, m.rail, 0, h * .29, -depth * .64, group));
      detail(cyl(w * .07, h * .09, m.copper, -w * .2, h * .35, -depth * .61, group));
      detail(box(w * .19, h * .19, .037, m.cream, w * .23, h * .54, -depth * .87, group));
      for (let i = 0; i < 3; i++) detail(cyl(w * .022, h * .065, [m.sage, m.peach, m.wood][i], w * (-.12 + i * .1), h * .46, -depth * .82, group));
      if (w > 1) for (const dx of [-.29, 0, .29]) {
        detail(cyl(.055, .018, m.wood, dx * w, h * .21, -depth * .25, group));
        detail(cyl(.009, h * .2, m.metal, dx * w, h * .1, -depth * .25, group));
        detail(cyl(.031, .012, m.cream, dx * w, h * .325, -depth * .55, group));
      }
    } else if (type === 'bedroom' || type === 'lounge') {
      detail(box(w * .64, h * .12, depth * .42, m.woodDark, -w * .09, h * .08, -depth * .65, group));
      detail(box(w * .61, h * .1, depth * .39, type === 'bedroom' ? m.cream : m.rose, -w * .09, h * .18, -depth * .65, group));
      detail(box(w * .62, h * .19, .035, m.sage, -w * .09, h * .29, -depth * .86, group));
      detail(box(w * .2, h * .025, depth * .19, m.cream, -w * .22, h * .25, -depth * .69, group));
      // Framed art hangs on the back wall and remains behind the glass at every angle.
      detail(box(w * .3, h * .23, .012, m.woodDark, w * .07, h * .63, -depth + .018, group, .003));
      detail(box(w * .25, h * .18, .009, m.peach, w * .07, h * .63, -depth + .027, group, .002));
    } else if (type === 'arcade') {
      // A row of coin-op cabinets against the back wall, screens facing the glass.
      detail(box(w * .86, .022, depth * .28, m.woodDark, 0, h * .21, -depth * .60, group));
      for (let i = 0; i < 3; i++) {
        const xx = w * (-.27 + i * .27);
        detail(box(w * .22, h * .30, depth * .20, m.metal, xx, h * .20, -depth * .62, group, .012));
        detail(box(w * .15, h * .13, .011, [m.teal, m.pink, m.warm][i], xx, h * .27, -depth * .50, group, .006));
        detail(box(w * .18, .016, depth * .10, m.dark, xx, h * .36, -depth * .60, group, .005));
      }
      detail(cyl(w * .05, h * .40, m.metal, w * .30, h * .20, -depth * .88, group));
      detail(box(w * .25, h * .11, .03, m.cream, w * .30, h * .53, -depth * .88, group, .012));
    } else if (type === 'studio') {
      detail(box(w * .65, .022, depth * .35, m.wood, 0, h * .27, -depth * .59, group));
      detail(box(w * .33, h * .37, .022, m.cream, -w * .12, h * .55, -depth * .76, group, .005));
      detail(box(w * .27, h * .26, .012, m.sage, -w * .12, h * .56, -depth * .73, group, .003));
      detail(cyl(w * .04, h * .13, m.copper, w * .2, h * .36, -depth * .6, group));
    } else {
      detail(box(w * .6, .027, depth * .35, m.wood, 0, h * .14, -depth * .67, group));
    }
    // A plant, soft side curtain, and a pendant with an angled downward light wash.
    detail(cyl(w * .052, h * .075, m.copper, w * .28, h * .095, -depth * .41, group));
    detail(sphere(w * .065, h * .105, w * .055, m.leaf, w * .28, h * .21, -depth * .41, group));
    if (type === 'bedroom' || type === 'lounge') for (const side of [-1, 1]) {
      detail(box(w * .105, h * .74, .022, curtain, side * w * .42, h * .4, -.075, group, .009));
    }
    const fixtureX = w * .2, fixtureY = h * .76, fixtureZ = -depth * .46;
    cyl(.005, h * .15, m.metal, fixtureX, h * .9, fixtureZ, group);
    const fixture = cyl(w * .095, h * .09, shade, fixtureX, fixtureY, fixtureZ, group, w * .045);
    fixture.castShadow = false;
    const bulb = sphere(w * .053, h * .025, w * .053, lit ? m.warm : unlit, fixtureX, fixtureY - h * .055, fixtureZ, group); bulb.castShadow = false;
    // Thin mullions sit in front of glass; the room stays clearly visible around them.
    if (mullions !== 'none') box(.012, h * (shape === 'rounded' ? .99 : .83), .018, trim, 0, h * .5, .009, group, 0);
    if (mullions === 'cross') box(w, .012, .024, trim, 0, h * .42, .009, group, 0);
    if (shape !== 'round') box(w + .06, .025, .085, m.stone, 0, -.025, 0, group, .008);

    if (lit && realLight) {
      const intensity = .62 + Math.min(w, 1.6) * .32;
      const light = new T.SpotLight('#ffdbb1', intensity, Math.min(w * 1.9, 2.2), Math.PI * .3, .72, 2);
      light.userData.baseIntensity = intensity;
      lights.push({ light, group, from: new T.Vector3(fixtureX, fixtureY - h * .06, fixtureZ), to: new T.Vector3(-w * .17, h * .06, -depth * .65) });
    }
    const entry = { group, pane, frame, back, decor, width: w, height: h, depth, type, lit, curvature, shape };
    windows.push(entry); return entry;
  }
  function attachLights(root) {
    for (const { light, group, from, to } of lights) {
      light.position.copy(group.localToWorld(from.clone())); light.target.position.copy(group.localToWorld(to.clone()));
      root.add(light, light.target);
    }
  }
  return { addWindow, windows, lights, glass, attachLights };
}
