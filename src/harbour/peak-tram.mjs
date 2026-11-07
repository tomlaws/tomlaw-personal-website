import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {TRAM_LIGHT_MESHES} from './tram-light-meshes.mjs';
import {createTramTrackMist,TRAM_TRACK_LIGHTS,tramTrackLightPose} from './tram-track-mist.mjs';

// Compressed Garden Road–Peak Tower relationship. The railway winds through the
// visible flank, with a single-track approach at each end and a central loop.
export function peakTramRoute(heightAt, heights = null) {
  const plan = new T.CatmullRomCurve3([
    [-2.45, 2.35], [-2.40, 1.10], [-2.00, -.50], [-.65, -1.90],
    [.85, -3.00], [2.10, -4.25], [3.50, -5.55], [4.25, -7.00], [4.40, -8.65],
  ].map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
  plan.arcLengthDivisions = 800;
  const length = plan.getLength(), endInset = 1.48, ramp = 1.35;
  const start = plan.getPointAt(0), end = plan.getPointAt(1);
  const low = heights?.low ?? heightAt(start.x, start.z), high = heights?.high ?? heightAt(end.x, end.z);
  const grade = u => {
    const s = T.MathUtils.clamp(u, 0, 1) * length;
    const climbed = s < ramp ? s * s / (2 * ramp) : s > length - ramp
      ? length - ramp - (length - s) ** 2 / (2 * ramp) : s - ramp / 2;
    return low + (high - low) * climbed / (length - ramp);
  };
  const passingOffset = u => u <= .25 || u >= .75 ? 0 : .66 * Math.sin((u - .25) / .50 * Math.PI) ** 2;
  function point(u, branch = 0, railOffset = 0) {
    u = T.MathUtils.clamp(u, 0, 1);
    const p = plan.getPointAt(u), t = plan.getTangentAt(u);
    p.addScaledVector(new T.Vector3(-t.z, 0, t.x), branch * passingOffset(u) + railOffset);
    p.y = grade(u);
    return p;
  }
  function tangent(u, branch = 0) {
    return point(Math.min(1, u + .0002), branch).sub(point(Math.max(0, u - .0002), branch)).normalize();
  }
  const samples = Array.from({ length: 361 }, (_, i) => plan.getPointAt(i / 360));
  const upperU = 1 - endInset / length;
  function closest(x, z) {
    let best = { distance: Infinity, u: 0 };
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i], dx = b.x - a.x, dz = b.z - a.z;
      const t = T.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const distance = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (distance < best.distance) best = { distance, u: (i - 1 + t) / 360 };
    }
    return best;
  }
  function terrainHeight(x, z) {
    const nearest = closest(x, z);
    const towerApron = T.MathUtils.smoothstep(x, 4.95, 5.35) * T.MathUtils.smoothstep(-z, 6.6, 7.25);
    const shoulder = .90 + passingOffset(nearest.u) * .55;
    const blend = (1 - T.MathUtils.smoothstep(nearest.distance, shoulder, shoulder + .60)) * (1 - towerApron);
    // A gently graded cutting shares the mountain mesh. No suspended viaduct
    // or separate green bank is needed to carry the railway across the slope.
    return T.MathUtils.lerp(heightAt(x, z), grade(nearest.u), blend);
  }
  return { length, point, tangent, closest, grade, passingOffset, terrainHeight,
    minU: endInset / length, maxU: upperU, endInset, summitHeight: high };
}

export function createPeakTram({ fixed, root, materials: m, route, landRise }) {
  const material = (name, color, roughness = .65, metalness = 0) => {
    const mat = new T.MeshStandardMaterial({ color, roughness, metalness }); mat.name = name; return mat;
  };
  m.tramGreen = material('Peak Tram heritage green', '#236550', .42, .12);
  m.tramBallast = material('Peak Tram soft limestone track bed', '#e0dbc9', .96);
  m.tramRail = material('Peak Tram satin pale steel rails', '#bac7c8', .60, .25);
  m.tramSleeper = material('Peak Tram weathered light timber sleepers', '#b5ac98', .94);
  const gauge = .55, railRadius = .027, railHeight = .088;
  const cabinScale=new T.Vector3(1.3,1.06,.88);
  const wheelContact = railHeight + railRadius;
  m.tramWindow = new T.MeshPhysicalMaterial({ color: '#89b7bd', roughness: .10, metalness: .12,
    transparent: true, opacity: .56, depthWrite: false, side: T.DoubleSide, clearcoat: .8 });
  m.tramWindow.name = 'Peak Tram panoramic glazing';
  m.tramWindow.emissive.set('#ffda92');
  m.tramWindow.emissiveIntensity=0;
  m.tramInteriorWood=m.wood.clone();m.tramInteriorWood.name='Peak Tram illuminated timber interior';
  m.tramInteriorFloor=m.stone.clone();m.tramInteriorFloor.name='Peak Tram illuminated interior floor';
  m.tramLightHousing=material('Peak Tram recessed light housing','#b7c3bd',.48,.35);
  m.tramCeilingLight=material('Peak Tram warm ceiling diffuser','#fff1c9',.52);
  m.tramGuideLight=material('Peak Tram warm track guide diffuser','#ece4ca',.58);
  for(const finish of [m.tramBallast,m.tramRail,m.tramSleeper,m.tramInteriorWood,m.tramInteriorFloor,m.tramCeilingLight,m.tramGuideLight]){
    finish.emissive.set('#ffdfa1');finish.emissiveIntensity=0;
  }
  const track = new T.Group(); track.name = 'Peak Tram illuminated railway'; fixed.add(track);
  track.add(createTramTrackMist(route));
  const moving = new T.Group(); moving.name = 'Animated Peak Tram'; moving.position.y = landRise; root.add(moving);
  const up = new T.Vector3(0, 1, 0), shapes = new Map();
  function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(geometry, mat); o.position.set(x, y, z);
    o.castShadow = !mat.transparent; o.receiveShadow = !mat.transparent; parent.add(o); return o;
  }
  function box(w, h, d, mat, parent, x, y, z, radius = .025) {
    const r = Math.min(radius, w / 3, h / 3, d / 3), key = `${w},${h},${d},${r}`;
    if (!shapes.has(key)) shapes.set(key, r ? new RoundedBoxGeometry(w, h, d, 2, r) : new T.BoxGeometry(w, h, d));
    return mesh(shapes.get(key), mat, parent, x, y, z);
  }
  const lightParts=TRAM_LIGHT_MESHES.map(({key,position,normal,index})=>{
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setIndex(index);
    return {key,geometry};
  });
  function lightModule(parent,position,scale,rotation,lensMaterial,name){
    const fixture=new T.Group();fixture.name=name;fixture.position.copy(position);fixture.scale.copy(scale);
    fixture.quaternion.copy(rotation);parent.add(fixture);
    for(const {key,geometry} of lightParts)mesh(geometry,key==='housing'?m.tramLightHousing:lensMaterial,fixture);
    return fixture;
  }
  function frame(u, branch = 0) {
    const x = route.tangent(u, branch), z = new T.Vector3(-x.z, 0, x.x).normalize();
    const y = z.clone().cross(x).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  }
  function ribbon(widthAt, top, bottom) {
    const positions = [], indices = [], steps = 260;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, width = widthAt(u);
      for (const y of [top, bottom]) for (const sign of [-1, 1]) {
        const p = route.point(u, 0, sign * width / 2); p.y += y; positions.push(...p.toArray());
      }
      if (i) {
        const a = (i - 1) * 4, b = i * 4;
        indices.push(a, a + 1, b, a + 1, b + 1, b,
          a + 2, a, b + 2, a, b, b + 2, a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);
      }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  mesh(ribbon(u => .92 + route.passingOffset(u) * 2, .035, -.075), m.tramBallast, track).name = 'Continuous graded track bed';
  const railCurves = [];
  class RailCurve extends T.Curve {
    constructor(branch, offset, height) { super(); Object.assign(this, { branch, offset, height }); }
    getPoint(t, target = new T.Vector3()) { return target.copy(route.point(t, this.branch, this.offset)).addScaledVector(up, this.height); }
  }
  // Outside the loop the two branches are identical, so draw their common rail
  // only once; the additional loop rails meet that rail exactly at both switches.
  for (const rail of [-gauge / 2, gauge / 2]) {
    const curve = new RailCurve(-1, rail, railHeight); railCurves.push(curve);
    mesh(new T.TubeGeometry(curve, 300, railRadius, 6, false), m.tramRail, track).name = 'Peak Tram running rail';
    const loopCurve = new RailCurve(1, rail, railHeight);
    class Loop extends T.Curve { getPoint(t, target = new T.Vector3()) { return loopCurve.getPoint(.25 + .5 * t, target); } }
    railCurves.push(loopCurve);
    mesh(new T.TubeGeometry(new Loop(), 160, railRadius, 6, false), m.tramRail, track).name = 'Peak Tram passing-loop rail';
  }
  mesh(new T.TubeGeometry(new RailCurve(0, 0, .072), 300, .008, 5, false), m.tramRail, track).name = 'Funicular haulage cable';
  const sleeperCount = Math.ceil(route.length / .32);
  for (let i = 0; i <= sleeperCount; i++) {
    const u = i / sleeperCount;
    for (const branch of route.passingOffset(u) > .05 ? [-1, 1] : [0]) {
      const p = route.point(u, branch), tie = box(.105, .035, .76, m.tramSleeper, track, p.x, p.y + .055, p.z, .008);
      tie.quaternion.copy(frame(u, branch));
    }
  }
  // Sparse luminaires balance both branches and shoulders of the passing loop.
  // Reuse the original Blender-authored housings instead of a dense edge row.
  for(const lamp of TRAM_TRACK_LIGHTS){
    const {position}=tramTrackLightPose(route,lamp);
    lightModule(track,position,new T.Vector3(.32,1,.40),frame(lamp.u),m.tramGuideLight,'Recessed track guide light');
  }
  for (const u of [0, 1]) {
    const p = route.point(u), g = new T.Group(); g.position.copy(p); g.quaternion.copy(frame(u)); track.add(g);
    box(.12, .20, .80, m.tramRail, g, 0, .16, 0);
    box(.08, .13, .66, m.white, g, u ? -.04 : .04, .31, 0);
  }
  // The stations, retaining foundations and upper connecting landing were
  // removed at the user's request. Preserve the rail alignment and tram stops.
  const stations = [];

  function cabin(outerEnd) {
    const g = new T.Group(); g.name = 'Sixth-generation Peak Tram panoramic carriage';
    // A continuous heritage-green skirt and curved corners carry the tall glazing.
    box(.98, .25, .73, m.tramGreen, g, 0, .28, 0, .075);
    box(.89, .035, .65, m.tramInteriorWood, g, 0, .423, 0, .012);
    box(.94, .035, .735, m.tramInteriorFloor, g, 0, .405, 0, .008);
    for (const side of [-1, 1]) {
      // Glass sits inside one connected frame, with every pane meeting a post.
      const doorX=-outerEnd*.275;
      const boundaries=[-.445,-.105,.160,.435];
      for(let bay=0;bay<3;bay++) {
        const left=boundaries[bay],right=boundaries[bay+1];
        box(right-left-.016,.405,.012,m.tramWindow,g,outerEnd*(left+right)/2,.663,side*.346,.008);
      }
      for(const x of boundaries)box(.027,.47,.042,m.tramGreen,g,outerEnd*x,.663,side*.351,.006);
      box(.012,.41,.028,m.tramGreen,g,doorX,.663,side*.351,.003);
      box(.925,.046,.045,m.tramGreen,g,0,.891,side*.351,.009);
      box(.94,.046,.045,m.tramGreen,g,0,.438,side*.351,.009);
      box(.90,.014,.012,m.stone,g,0,.462,side*.374,.003);
      // Door handles and a restrained brass maker's plaque break up the green skirt.
      box(.013,.065,.012,m.metal,g,doorX+.025,.57,side*.372,.003);
      box(.17,.055,.010,m.copper,g,outerEnd*.18,.31,side*.369,.004);
    }
    // Only the two outer ends are driving cabs; the coupled ends have no headlights.
    const end=outerEnd;
    box(.15,.25,.67,m.tramGreen,g,end*.425,.30,0,.055);
    const windscreen=box(.027,.40,.60,m.tramWindow,g,end*.457,.665,0,.018);
    windscreen.rotation.z=end*.08;
    for(const side of [-1,1]) {
      const pillar=box(.035,.445,.035,m.tramGreen,g,end*.457,.665,side*.316,.009);pillar.rotation.z=end*.08;
      box(.036,.045,.10,m.warm,g,end*.495,.315,side*.235,.017);
      box(.045,.018,.13,m.metal,g,end*.485,.27,side*.235,.006);
    }
    box(.055,.065,.66,m.tramGreen,g,end*.470,.442,0,.012);
    const wiper=box(.016,.22,.012,m.tramGreen,g,end*.481,.64,.055,.003);wiper.rotation.x=.32;
    box(.065,.065,.66,m.tramGreen,g,end*.440,.885,0,.012);
    // Skylights are set into roof openings, flush with the surrounding ribs.
    for(const side of [-1,1]) {
      box(.96,.055,.115,m.stone,g,0,.929,side*.3125,.022);
      box(.91,.025,.040,m.tramGreen,g,0,.955,side*.354,.008);
      box(.060,.45,.10,m.tramGreen,g,end*.439,.664,side*.322,.01);
    }
    for(const x of [-.455,-.15,.15,.455])box(.045,.055,.63,m.stone,g,x,.929,0,.012);
    for(const x of [-.30,0,.30])box(.255,.008,.49,m.tramWindow,g,x,.949,0,.012);
    box(.035,.51,.65,m.tramGreen,g,-end*.468,.674,0,.012);
    for(const x of [-.26,.015,.285])for(const side of [-1,1]) {
      box(.13,.055,.235,m.tramInteriorWood,g,x,.48,side*.18,.018);
      box(.035,.18,.235,m.tramInteriorWood,g,x+.06,.565,side*.18,.015);
      for(const z of [side*.12,side*.24])box(.02,.095,.022,m.metal,g,x,.415,z,.004);
    }
    for (const x of [-.31, .31]) for (const side of [-1, 1]) {
      const wheel = mesh(new T.CylinderGeometry(.105, .105, .065, 12), m.tramRail, g, x, .105 / cabinScale.y, side * gauge / 2 / cabinScale.z);
      wheel.rotation.x = Math.PI / 2;
      wheel.scale.set(1 / cabinScale.x, 1 / cabinScale.z, 1 / cabinScale.y);
    }
    // Consolidate each cabin by material without baking its animated transform.
    g.updateMatrixWorld(true);
    const batches = new Map();
    for (const o of g.children) {
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
      if (!batches.has(o.material)) batches.set(o.material, []); batches.get(o.material).push(geo);
    }
    g.clear();
    for (const [mat, geometries] of batches) mesh(mergeGeometries(geometries), mat, g);
    for(const side of [-1,1])lightModule(g,new T.Vector3(0,.892,side*.285),new T.Vector3(.78,.35,.30),
      new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI),m.tramCeilingLight,'Recessed tram ceiling light');
    g.scale.copy(cabinScale);
    return g;
  }
  const bellowsMaterial=material('Peak Tram flexible fabric bellows','#75877d',.95);
  bellowsMaterial.side=T.DoubleSide;
  const jointRings=7;
  const cars = [-1, 1].map((branch, i) => {
    const g = new T.Group(); g.name = `Peak Tram ${i + 1}`; moving.add(g);
    const cabins = [-.715, .715].map(offset => { const body = cabin(Math.sign(offset)); g.add(body); return { body, offset }; });
    const jointGeometry=new T.BufferGeometry();
    jointGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(jointRings*4*3),3).setUsage(T.DynamicDrawUsage));
    const indices=[];
    for(let ring=0;ring<jointRings-1;ring++)for(let corner=0;corner<4;corner++) {
      const a=ring*4+corner,b=ring*4+(corner+1)%4,c=a+4,d=b+4;
      indices.push(a,b,c,b,d,c);
    }
    jointGeometry.setIndex(indices);
    const joint=mesh(jointGeometry,bellowsMaterial,g);joint.frustumCulled=false;
    joint.name='Flexible inter-car gangway';
    return { g, cabins, joint, branch, u: 0, direction: 1 };
  });
  const {animate,progress,cycle,travel,dwell,phase}=bindPeakTramMotion({route,moving,cars,cabinScale,wheelContact});
  function clearForTrees(x, z, radius = .5) {
    if (route.closest(x, z).distance < 1.28 + radius) return false;
    return true;
  }
  animate(0);
  return { route, track, moving, cars, stations, animate, progress, cycle, travel, dwell, phase,
    clearForTrees, railCurves, gauge, wheelContact, carLength: 2.74, carWidth: .69, frame };
}

// Reuse the exact motion equations when the geometry is loaded from a prepared scene.
export function bindPeakTramMotion({route,moving,cars,cabinScale=new T.Vector3(1.3,1.06,.88),wheelContact=.115}) {
  const up=new T.Vector3(0,1,0),jointRings=7;
  function frame(u, branch = 0) {
    const x = route.tangent(u, branch), z = new T.Vector3(-x.z, 0, x.x).normalize();
    const y = z.clone().cross(x).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  }
  const travel = 31, dwell = 3.5, cycle = 2 * (travel + dwell), phase = 12;
  function progress(time) {
    const t = T.MathUtils.euclideanModulo(time + phase, cycle), leg = travel + dwell;
    if (t < dwell) return { fraction: 0, direction: 0 };
    if (t < leg) return { fraction: .5 - .5 * Math.cos(Math.PI * (t - dwell) / travel), direction: 1 };
    if (t < leg + dwell) return { fraction: 1, direction: 0 };
    return { fraction: .5 + .5 * Math.cos(Math.PI * (t - leg - dwell) / travel), direction: -1 };
  }
  function animate(time) {
    const state = progress(time);
    cars.forEach((car, i) => {
      const fraction = i ? 1 - state.fraction : state.fraction;
      car.u = T.MathUtils.lerp(route.minU, route.maxU, fraction);
      car.direction = state.direction * (i ? -1 : 1);
      car.g.position.copy(route.point(car.u, car.branch)); car.g.position.y += wheelContact;
      car.g.quaternion.copy(frame(car.u, car.branch));
      const inverse = car.g.quaternion.clone().invert();
      for (const { body, offset } of car.cabins) {
        const u = car.u + offset / route.length;
        body.position.copy(route.point(u, car.branch)).addScaledVector(up, wheelContact).sub(car.g.position).applyQuaternion(inverse);
        body.quaternion.copy(inverse).multiply(frame(u, car.branch));
      }
      // Each end ring lies exactly on its own carriage's end plane. Intermediate
      // rings deform between these planes instead of rotating a rigid box into them.
      const corners=[[-1,-1],[-1,1],[1,1],[1,-1]];
      const positions=car.joint.geometry.attributes.position;
      for(let ring=0;ring<jointRings;ring++) {
        const t=ring/(jointRings-1);
        const fold=(ring===0||ring===jointRings-1)?0:(ring%2?.008:-.008);
        for(let corner=0;corner<4;corner++) {
          const [sy,sz]=corners[corner];
          const ends=car.cabins.map(({body},index)=>new T.Vector3(
            (index?-.486:.486)*cabinScale.x,
            (.674+sy*(.265+fold))*cabinScale.y,
            sz*(.275+fold)*cabinScale.z,
          ).applyQuaternion(body.quaternion).add(body.position));
          const p=ends[0].lerp(ends[1],t);positions.setXYZ(ring*4+corner,p.x,p.y,p.z);
        }
      }
      positions.needsUpdate=true;car.joint.geometry.computeVertexNormals();
    });
    moving.updateMatrixWorld(true);
  }
  return {animate,progress,cycle,travel,dwell,phase,frame};
}
