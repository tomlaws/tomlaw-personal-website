import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {HKCEC_DETAILS} from './hkcec-detail-meshes.mjs';

// A miniature of the 1997 harbour extension. +z faces Victoria Harbour; +x is west.
// Shape references: HK Tourism Board's harbour/foyer photographs and Jack Li's
// elevated photograph in the EOC's "The Way We Are" exhibition. The high frontal
// vault, rear exhibition roof and two lower side canopies all belong to the new
// extension. They are not two parallel roofs on the old and new buildings.
export function createHKCEC({legacyDetails=false,authoring=false}={}) {
  const root = new T.Group(); root.name = 'HKCEC harbour extension';
  const materials = {};
  const material = key => materials[key] ??= Object.assign(new T.MeshStandardMaterial(), { name: key });
  const parts = new Map();
  const layout={roofEdges:[],facades:[],supports:[]};
  let detailContext='roof';
  function add(name, geometry, key) {
    const object = new T.Mesh(geometry, material(key)); object.name = name;
    object.castShadow = key !== 'hkcecGlass'; object.receiveShadow = key !== 'hkcecGlass';
    root.add(object); return object;
  }
  function detail(geometry, key) {
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key).push(geometry);
  }
  function block(w, h, d, x, y, z, key = 'stone') {
    detail(new T.BoxGeometry(w, h, d).translate(x, y, z), key);
  }
  function line(points, radius = .008, key = 'white') {
    if(authoring&&detailContext!=='facade')layout[detailContext==='roof'?'roofEdges':'supports'].push({points,radius,key});
    if(!legacyDetails)return;
    const vertices = points.map(p => new T.Vector3(...p));
    if (vertices.length === 2) {
      const direction = vertices[1].clone().sub(vertices[0]);
      const geometry = new T.CylinderGeometry(radius, radius, direction.length(), 6);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()));
      const center = vertices[0].clone().add(vertices[1]).multiplyScalar(.5);
      detail(geometry.translate(center.x, center.y, center.z), key); return;
    }
    const curve = new T.CurvePath();
    for (let i = 1; i < vertices.length; i++) curve.add(new T.LineCurve3(vertices[i - 1], vertices[i]));
    detail(new T.TubeGeometry(curve, Math.max(8, points.length), radius, 5, false), key);
  }
  const sample = (fn, count = 48) => Array.from({ length: count + 1 }, (_, i) => fn(i / count));
  const bezier = (points, t) => {
    const s = 1 - t;
    return points[0].map((_, axis) => s ** 3 * points[0][axis] + 3 * s * s * t * points[1][axis] + 3 * s * t * t * points[2][axis] + t ** 3 * points[3][axis]);
  };
  const cubic = (t, a, b, c, d) => a * (1 - t) ** 3 + 3 * b * (1 - t) ** 2 * t + 3 * c * (1 - t) * t * t + d * t ** 3;
  // Closed, thin roof skin: independent underside and edge vertices retain a
  // crisp aluminium fascia without a thick rounded lip or a visible open back.
  function shell(fn, nu = 56, nv = 40, thickness = .035) {
    const positions = [], indices = [], row = nu + 1, layer = row * (nv + 1);
    for (const bottom of [false, true]) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const p = fn(i / nu, j / nv); p[1] -= bottom ? thickness : 0; positions.push(...p);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * row + i, b = a + row;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
      indices.push(a + layer, a + 1 + layer, b + layer, a + 1 + layer, b + 1 + layer, b + layer);
    }
    const border = [];
    for (let i = 0; i <= nu; i++) border.push(i);
    for (let j = 1; j <= nv; j++) border.push(j * row + nu);
    for (let i = nu - 1; i >= 0; i--) border.push(nv * row + i);
    for (let j = nv - 1; j > 0; j--) border.push(j * row);
    for (let i = 0; i < border.length; i++) {
      const a = border[i], b = border[(i + 1) % border.length], n = positions.length / 3;
      for (const id of [a, b, a + layer, b + layer]) positions.push(...positions.slice(id * 3, id * 3 + 3));
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  // The exhibition roof widens behind the foyer. The frontal edge is an arch
  // in elevation and a prow in plan, not a wave extruded along the shoreline.
  const roof = (u, v) => {
    const a = 2 * u - 1;
    const originalWidth = cubic(v, 1.08, 1.92, 1.95, 1.24);
    // Stop at the shared valleys instead of carrying the vault's low tips
    // through the side canopies and down across the glass.
    const width = cubic(v, .98, 1.50, 1.57, 1.04);
    const arch = a * width / originalWidth;
    const crown = cubic(v, 2.00, 2.08, 2.03, 2.58);
    const eave = cubic(v, 1.65, 1.80, 1.82, 1.28);
    return [a * width, crown - (crown - eave) * arch * arch, -1.28 + 2.30 * v + .31 * (1 - arch * arch) * v ** 3];
  };
  const mainRoof = add('HKCEC continuous vaulted roof', shell(roof), 'hkcecRoof');
  // Place facade heads against the actual triangulated underside, including the
  // extra height gained when the wall is set back from a sloping overhang.
  const downward = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
  function ceiling(mesh, point, thickness) {
    downward.ray.origin.set(point[0], 4, point[1]);
    const hits = downward.intersectObject(mesh, false);
    if (!hits.length) throw new Error(`HKCEC wall lies outside its canopy at ${point}`);
    return hits[0].point.y - thickness + .002;
  }
  // At the map's distant camera, the arch and central ridge carry the silhouette.
  // Fine roof-panel seams would become noise at this scale.
  line(sample(t => roof(t, 1)), .020, 'white');
  for (const side of [0, 1]) line(sample(t => roof(side, t)), .012, 'white');
  line(sample(v => { const p = roof(.5, v); p[1] += .004; return p; }), .007, 'hkcecRoof');

  // The side roofs continue inward beyond their intersections with the vault.
  // Their forward tips project below the central cover, leaving a visible lap.
  const wings = [];
  for (const side of [-1, 1]) {
    const seam = v => roof(1, v);
    const leading = [seam(1), [1.35, 1.82, 1.30], [2.10, 1.98, .36], [1.89, 1.14, -.52]];
    const trailing = [seam(0), [1.15, 1.78, -1.10], [1.50, 1.68, -1.22], [1.57, 1.50, -1.23]];
    const wing = (u, v) => {
      if(u<0) {
        const joint=seam(v),start=seam(0),end=seam(1);
        // Match the existing loft's tangent at the intersection. The previous
        // straight extrusion changed slope here and made the extension kink.
        const tangent=joint.map((_,axis)=>T.MathUtils.lerp(
          3*(trailing[1][axis]-trailing[0][axis]),
          3*(leading[1][axis]-leading[0][axis]),v,
        )-(joint[axis]-T.MathUtils.lerp(start[axis],end[axis],v)));
        tangent[1]+=.075*Math.PI*Math.sin(v*Math.PI);
        const tip=[joint[0]-.27,joint[1]-.156,joint[2]+.195*v*v*v];
        const control=joint.map((value,axis)=>value-tangent[axis]*.10);
        const tipControl=tip.map((value,axis)=>T.MathUtils.lerp(joint[axis],value,.70));
        // Continue the side roof's vertical curvature, rather than pulling the
        // tip up to a fixed height (which created the visible S-shaped curl).
        const curvatureY=T.MathUtils.lerp(
          6*(trailing[2][1]-2*trailing[1][1]+trailing[0][1]),
          6*(leading[2][1]-2*leading[1][1]+leading[0][1]),v,
        );
        tip[1]=joint[1]-.30*tangent[1]+.045*curvatureY;
        tipControl[1]=tip[1]+.10*(tangent[1]-.30*curvatureY);
        const p=bezier([joint,control,tipControl,tip],-u/.30);
        p[0]*=side;
        return p;
      }
      const a = bezier(trailing, u), b = bezier(leading, u);
      const p = a.map((x, i) => T.MathUtils.lerp(x, b[i], v));
      const joint = seam(v), start = seam(0), end = seam(1);
      for (let i = 0; i < 3; i++) p[i] += (1 - u) * (joint[i] - T.MathUtils.lerp(start[i], end[i], v));
      p[0] *= side; p[1] += .075 * Math.sin(v * Math.PI) * Math.sin(u * Math.PI); return p;
    };
    // Mirroring positions also changes winding; reverse u to keep the top outward.
    const surface = side === 1 ? (u,v)=>wing(-.30+1.30*u,v) : (u,v)=>wing(1-1.30*u,v);
    const mesh = add(`HKCEC ${side === 1 ? 'west' : 'east'} swept canopy`, shell(surface, 52, 40, .035), 'hkcecRoof');
    line(sample(t => wing(-.30+1.30*t, 1),104), .017, 'white');
    wings.push({ wing, mesh, side });
  }

  // Continuous stepped plan: straight landward connection, curved harbour end.
  function plan(inset = 0) {
    const points = [
      [-1.48, -1.29], [1.48, -1.29],
      ...sample(t => bezier([[1.48, -1.29], [2.25, -.40], [2.12, .66], [1.22, 1.07]], t), 20).slice(1),
      ...sample(t => bezier([[1.22, 1.07], [.58, 1.39], [-.58, 1.39], [-1.22, 1.07]], t), 24).slice(1),
      ...sample(t => bezier([[-1.22, 1.07], [-2.12, .66], [-2.25, -.40], [-1.48, -1.29]], t), 20).slice(1),
    ];
    return points.map(([x, z]) => [x * (1 - inset), z * (1 - inset)]);
  }
  function slab(points, y, height, key = 'white', name) {
    const shape = new T.Shape(points.map(([x, z]) => new T.Vector2(x, -z)));
    const g = new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
    g.rotateX(-Math.PI / 2).translate(0, y, 0);
    return name ? add(name, g, key) : detail(g, key);
  }
  const glassGeometries = [];
  // Vertical faceted curtain wall. Roof and facade use corresponding sampled
  // curves, so the head of every bay follows the vault without an empty gap.
  function curtain(points, base, tops, { horizontal = 8, uprights = 2, major = 8 } = {}) {
    if(authoring)layout.facades.push({points,base,tops,horizontal,uprights,major});
    const previousContext=detailContext;detailContext='facade';
    const pos = [], idx = [];
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i]; pos.push(x, base, z, x, tops[i], z);
      if (i < points.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); glassGeometries.push(g);
    for (let i = 0; uprights > 0 && i < points.length; i += uprights) {
      const [x, z] = points[i]; line([[x, base, z], [x, tops[i], z]], i % major === 0 ? .021 : .008, i % major === 0 ? 'white' : 'metal');
    }
    const top = Math.max(...tops);
    for (let y = base + horizontal; y < top - .035; y += horizontal) {
      let run = [];
      const flush = () => { if (run.length > 1) line(run, .012, 'white'); run = []; };
      for (let i = 0; i < points.length; i++) {
        if (y < tops[i] - .02) run.push([points[i][0], y, points[i][1]]); else flush();
      }
      flush();
    }
    detailContext=previousContext;
  }
  slab(plan(), 0, .09, 'stone', 'HKCEC waterfront podium');
  const lowerPlan = plan(.055);
  curtain(lowerPlan, .09, lowerPlan.map(() => 1.04), { horizontal: 2, uprights: 8, major: 8 });
  // Two tall podium storeys and one generous foyer, matching the other miniatures.
  for (const [y, inset, height] of [[.09, .005, .08], [.55, .025, .09], [1.02, .055, .08]]) slab(plan(inset), y, height,'hkcecTerrace',`HKCEC terrace fascia ${y}`);

  // High harbour foyer under the central arch, with a faceted rounded prow.
  const front = sample(t => roof(t, 1));
  const frontPlan = front.map(([x, , z]) => [x * .91, z - .17]);
  curtain(frontPlan, 1.04, frontPlan.map(p => ceiling(mainRoof, p, .035)), { horizontal: .82, uprights: 8, major: 8 });
  // The side walls follow the underside of the broad roof, inside its eaves.
  for (const side of [0, 1]) {
    const rim = sample(t => roof(side, t), 36);
    const points = rim.map(([x, , z], i) => [x * .91, z + .10 - .27 * i / (rim.length - 1)]);
    curtain(points, 1.04, points.map(p => ceiling(mainRoof, p, .035)), { horizontal: .82, uprights: 12, major: 12 });
  }
  const back = sample(t => roof(t, 0), 30);
  const backPlan = back.map(([x, , z]) => [x * .91, z + .10]);
  curtain(backPlan, 1.04, backPlan.map(p => ceiling(mainRoof, p, .035)), { horizontal: .82, uprights: 10, major: 10 });
  // Glass under the two low leading edges; inset enough to expose the overhang.
  for (const { wing, mesh, side } of wings) {
    const edge = sample(t => wing(.015 + .97 * t, .94), 32);
    const points = edge.map(([x, , z]) => [x, z]);
    curtain(points, 1.04, points.map(p => ceiling(mesh, p, .035)), { horizontal: .82, uprights: 8, major: 8 });
    // Close the small inset between the foyer and wing glazing under each valley.
    const start = frontPlan[side === 1 ? frontPlan.length - 1 : 0], end = points[0];
    const join = sample(t => start.map((value, i) => T.MathUtils.lerp(value, end[i], t)), 4);
    const tops = join.map(p => {
      downward.ray.origin.set(p[0], 4, p[1]);
      const hit = downward.intersectObjects([mainRoof, mesh], false)[0];
      if (!hit) throw new Error('HKCEC facade join lies outside its roof');
      return hit.point.y - .035 + .002;
    });
    curtain(join, 1.04, tops, { horizontal: .82, uprights: 0 });
  }
  detailContext='structure';
  const glass = mergeGeometries(glassGeometries.map(g => g.toNonIndexed()), false);
  add('Convention centre glazing', glass, 'hkcecGlass');
  glassGeometries.forEach(g => g.dispose());

  // Recessed hall volumes, concourse decks and roof supports give the translucent
  // facade depth. No opaque block fills the foyer or cuts through the canopy.
  slab(plan(.19), .16, .045, 'room');
  slab(plan(.24), .57, .045, 'room');
  block(2.02, .78, 1.02, 0, 1.43, -.58, 'room');
  for (const x of [-.92, 0, .92]) {
    const top = 2.40 - .85 * (x / .92) ** 2;
    line([[x, .16, .88], [x, top, .88]], .025, 'white');
  }
  // One readable entrance replaces the tiny repeated doors and balcony rails.
  block(.80, .40, .035, 0, .32, 1.12, 'room');
  for (const x of [-.38, 0, .38]) block(.025, .40, .025, x, .32, 1.15, 'white');
  block(.90, .055, .25, 0, .56, 1.17, 'white');
  // A low rectangular atrium connection on the landward edge, rather than a
  // second invented shell. It meets the rear hall without changing the plot.
  block(1.50, .24, .20, 0, .80, -1.22, 'room');
  block(1.58, .045, .22, 0, .945, -1.22, 'white');

  for (const [key, geometries] of parts) {
    const flat = geometries.map(g => {
      const out = g.index ? g.toNonIndexed() : g;
      for (const attr of Object.keys(out.attributes)) if (!['position', 'normal'].includes(attr)) out.deleteAttribute(attr);
      return out;
    });
    add(`HKCEC ${key} details`, mergeGeometries(flat, false), key);
    for (const g of new Set([...geometries, ...flat])) g.dispose();
  }
  if(!legacyDetails&&!authoring)for(const part of HKCEC_DETAILS){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(part.position,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(part.normal,3));
    add(part.name,geometry,part.key);
  }
  root.userData.landmark = 'HKCEC';
  if(authoring)root.userData.detailLayout=layout;
  root.userData.front = '+z';
  root.userData.footprint = plan();
  root.userData.reference = 'HK Tourism Board harbour photographs; EOC / Jack Li elevated view';
  return root;
}
