import {prepareFerryGlazing} from './legacy-glazing.mjs';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Hull-form helpers below build each design's shell; the names are what the world's checks and the
// selection tooltips read, so they are part of the interface rather than decoration.
const HARBOR_BOAT_NAMES = {
  rowing: 'Timber rowing dinghy',
  junk: 'Battened-sail harbour junk',
  launch: 'Pastel cabin launch',
  star: 'Star Ferry',
};

export function buildHarborBoat(design, materials) {
  const m = materials, root = new T.Group(); root.userData.design = design;
  root.name = HARBOR_BOAT_NAMES[design] ?? 'Harbour boat';
  const timber = new T.MeshStandardMaterial({ color: '#c39363', roughness: .78 });
  const trim = new T.MeshStandardMaterial({ color: '#e7d1a8', roughness: .65 });
  const blue = new T.MeshStandardMaterial({ color: '#91c7d5', roughness: .34, metalness: .08 });
  const engine = new T.MeshStandardMaterial({ color: '#7b98b2', roughness: .40, metalness: .2 });
  const upholstery = new T.MeshStandardMaterial({ color: '#f1b4a2', roughness: .86 });
  function mesh(name, geo, mat, parent = root) { const o = new T.Mesh(geo, mat); o.name = name; o.castShadow = !mat.transparent; o.receiveShadow = !mat.transparent; parent.add(o); return o; }
  function box(name, w, h, d, mat, x, y, z, r = .02, parent = root) { const o = mesh(name, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 4, h / 4, d / 4)), mat, parent); o.position.set(x, y, z); return o; }
  function rod(name, a, b, r, mat, parent = root) { const from = new T.Vector3(...a), to = new T.Vector3(...b), delta = to.clone().sub(from); const o = mesh(name, new T.CylinderGeometry(r, r, delta.length(), 12), mat, parent); o.position.copy(from.add(to).multiplyScalar(.5)); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return o; }
  function tube(name, points, r, mat) { return mesh(name, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 64, r, 8, false), mat); }
  // Open shell with distinct outer skin, inner lining, connected gunwales and
  // closed bow/transom end walls. The visible cockpit is an actual cavity.
  function hull(stations, outer, inner, rim) {
    const positions = [], indices = [], steps = 20, n = stations.length, stride = steps + 1;
    for (const inside of [false, true]) for (const [z, width, y, depth] of stations) for (let j = 0; j <= steps; j++) {
      const a = -Math.PI / 2 + j * Math.PI / steps;
      const w = inside ? Math.max(.016, width - .035) : width;
      positions.push(w * Math.sin(a), y - (inside ? Math.max(.025, depth - .045) : depth) * Math.cos(a), z);
    }
    const outerStart = indices.length;
    for (let i = 0; i < n - 1; i++)for (let j = 0; j < steps; j++) { const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1; indices.push(a, b, c, b, d, c); }
    const outerCount = indices.length - outerStart, innerStart = indices.length, offset = n * stride;
    for (let i = 0; i < n - 1; i++)for (let j = 0; j < steps; j++) { const a = offset + i * stride + j, b = a + 1, c = a + stride, d = c + 1; indices.push(a, c, b, b, c, d); }
    const innerCount = indices.length - innerStart, rimStart = indices.length;
    for (let i = 0; i < n - 1; i++)for (const j of [0, steps]) { const a = i * stride + j, b = a + stride, c = a + offset, d = b + offset; if (j === 0) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d); }
    for (const i of [0, n - 1]) for (let j = 0; j < steps; j++) { const a = i * stride + j, b = a + 1, c = a + offset, d = b + offset; if (i === 0) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.setIndex(indices);
    geo.addGroup(outerStart, outerCount, 0); geo.addGroup(innerStart, innerCount, 1); geo.addGroup(rimStart, indices.length - rimStart, 2); geo.computeVertexNormals();
    const shell = mesh('Open shaped hull', geo, [outer, inner, rim]); shell.castShadow = true; shell.receiveShadow = true;
    for (const side of [-1, 1]) tube('Rounded gunwale', stations.map(([z, w, y]) => [side * w, y + .009, z]), .023, rim);
    root.userData.hullStations = stations;
  }
  if (design === 'rowing') {
    const stations = [[-1.03, .055, .37, .15], [-.92, .20, .34, .25], [-.70, .34, .31, .34], [-.43, .42, .29, .39], [0, .45, .28, .40], [.44, .40, .30, .39], [.73, .29, .34, .29], [.94, .15, .38, .18], [1.04, .032, .40, .08]];
    hull(stations, m.stone, timber, trim);
    // An inset sole and curved ribs follow the hull rather than covering it.
    for (let i = 0; i < 5; i++)box('Timber sole plank', .095, .035, 1.13, i % 2 ? m.wood : timber, (i - 2) * .105, -.045, 0, .007);
    for (const station of stations.slice(2, 7)) {
      const [z, w, y, depth] = station, points = [];
      for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + i * Math.PI / 12; points.push([(w - .041) * Math.sin(a), y - (depth - .050) * Math.cos(a), z]); }
      tube('Curved timber rib', points, .012, trim);
    }
    for (const [z, w] of [[-.47, .69], [.09, .78], [.57, .59]]) {
      box('Rowing thwart', w, .055, .18, m.wood, 0, .225, z, .015);
      for (const side of [-1, 1]) box('Thwart support', .045, .17, .11, timber, side * (w / 2 - .07), .13, z, .012);
    }
    for (const side of [-1, 1]) {
      rod('Stowed wooden oar', [side * .15, .273, -.73], [-side * .21, .305, .52], .016, timber);
      const blade = box('Shaped oar blade', .09, .028, .25, m.wood, -side * .225, .31, .63, .025); blade.rotation.y = side * .24;
      rod('Bronze rowlock', [side * .44, .28, -.05], [side * .44, .345, -.05], .014, m.copper);
    }
    box('Bow breasthook', .22, .04, .15, trim, 0, .345, .83, .03);
    for (let i = 0; i < 3; i++) { const coil = mesh('Coiled mooring rope', new T.TorusGeometry(.072 + i * .011, .008, 8, 32), m.stone); coil.rotation.x = Math.PI / 2; coil.position.set(.05, .03, -.69); }
    for (const side of [-1, 1]) rod('Canvas fender', [side * .45, .22, .28], [side * .45, .09, .28], .037, m.stone);
    root.userData.features = ['open hull', 'timber sole', 'curved ribs', 'three thwarts', 'two oars', 'rowlocks'];
  } else if (design === 'junk') {
    // The boat Hong Kong's harbour is actually full of. Three things carry the read and
    // nothing else does: a broad shallow hull, a transom sitting high above the sheer line,
    // and the battened fan sail. The sail is coral rather than scarlet so it belongs to the
    // pastel palette, and it is built from flat stepped panels — at this map's scale the
    // stepped outline reads exactly as a battened sail does, and a curved sheet would cost
    // geometry nobody could see.
    const sailRed = new T.MeshStandardMaterial({ color: '#e8776b', roughness: .74 });
    const stations = [[-1.10, .10, .42, .10], [-.95, .34, .36, .26], [-.62, .52, .32, .40], [-.15, .58, .30, .46], [.34, .56, .31, .46], [.78, .48, .35, .38], [1.02, .36, .42, .24], [1.12, .20, .50, .12]];
    hull(stations, m.wood, m.stone, trim);
    box('Raised transom panel', .74, .46, .09, m.wood, 0, .62, 1.02, .02);
    box('Transom rail', .82, .07, .13, trim, 0, .88, 1.02, .03);
    const battened = 7;
    for (let i = 0; i < battened; i++) {
      const t = i / (battened - 1), w = .96 - t * .30, y = .52 + t * .96;
      box('Battened sail panel', w, .135, .022, sailRed, 0, y, -.055, .008);
      box('Sail batten', w + .05, .022, .034, m.wood, 0, y + .095, -.055, .008);
    }
    for (const side of [-1, 1]) box('Sail leech stay', .018, 1.02, .026, trim, side * .34, 1.02, -.055, .006);
    rod('Main mast', [0, .34, -.06], [0, 1.72, -.06], .035, m.bark);
    rod('Mast fore stay', [0, 1.62, -.06], [0, .40, -.92], .012, trim);
    box('Cabin hatch', .52, .16, .44, m.wood, 0, .50, .52, .03);
    box('Hatch roof', .58, .06, .50, trim, 0, .60, .52, .03);
    for (const side of [-1, 1]) box('Junk side rail', .05, .07, 1.5, trim, side * .50, .40, .15, .02);
    box('Stern lantern', .10, .12, .10, m.warm, 0, .96, 1.02, .02);
    root.userData.features = ['shallow hull', 'raised transom', 'battened fan sail', 'single mast', 'stern lantern'];
  } else if (design === 'star') {
    // Match the supplied Star Ferry photograph: green lower deck, white upper
    // saloon, one low roof and one central white funnel with a black cap.
    const green=new T.MeshStandardMaterial({name:'Star Ferry green enamel',color:'#418c51',roughness:.64});
    const greenDeep=new T.MeshStandardMaterial({color:'#2c6340',roughness:.76});
    const rubber=new T.MeshStandardMaterial({color:'#454a46',roughness:.98});
    const glazing=new T.MeshPhysicalMaterial({color:'#4f736e',roughness:.24,metalness:.08,transparent:true,opacity:.40,depthWrite:false,side:T.DoubleSide});
    glazing.name='Star Ferry warm passenger glazing';glazing.emissive.set('#ffdf88');glazing.emissiveIntensity=0;
    prepareFerryGlazing(glazing);
    const ceilingLamp=new T.MeshStandardMaterial({name:'Star Ferry ceiling lamps',color:'#f3ead4',emissive:'#ffda75',emissiveIntensity:0});
    const lowerDeck=m.wood.clone(),upperDeck=m.white.clone();
    lowerDeck.name='Star Ferry lower deck interior';upperDeck.name='Star Ferry upper deck interior';
    for(const finish of [lowerDeck,upperDeck]){finish.emissive.set('#ffe4a0');finish.emissiveIntensity=0;}
    const stations=[[-1.45,.09,.35,.18],[-1.32,.19,.34,.24],[-1.10,.30,.33,.31],[-.80,.36,.32,.37],[0,.38,.32,.42],[.80,.36,.32,.37],[1.10,.30,.33,.31],[1.32,.19,.34,.24],[1.45,.09,.35,.18]];
    hull(stations,green,greenDeep,green);
    function deck(name,y,h,key,width=.70,length=2.62) {
      const r=width/2,x=width/2,z=length/2,shape=new T.Shape();
      shape.moveTo(-x,-z+r);shape.lineTo(-x,z-r);
      shape.quadraticCurveTo(-x,z,0,z);shape.quadraticCurveTo(x,z,x,z-r);
      shape.lineTo(x,-z+r);shape.quadraticCurveTo(x,-z,0,-z);shape.quadraticCurveTo(-x,-z,-x,-z+r);
      const geometry=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:12});geometry.rotateX(-Math.PI/2);
      const o=mesh(name,geometry,key);o.position.y=y;return o;
    }
    deck('Lower deck sole',.35,.035,lowerDeck,.66,2.60);
    deck('Upper deck sole',.68,.035,upperDeck,.72,2.66);
    deck('Upper deck roof',1.025,.045,m.white,.75,2.68);
    for(const y of [.635,1.002])for(const x of [-.20,.20])box('Passenger deck ceiling lamp',.018,.009,2.22,ceilingLamp,x,y,0,.003);
    for(const side of [-1,1]) {
      box('Lower deck bulwark',.030,.14,1.98,green,side*.335,.43,0,.008);
      box('Lower window header',.030,.035,1.98,green,side*.338,.656,0,.005);
      box('Upper white saloon sill',.035,.10,1.98,m.white,side*.342,.755,0,.008);
      box('Upper white window header',.035,.04,2.02,m.white,side*.347,1.018,0,.006);
      for(let i=0;i<11;i++) {
        const z=-.94+i*.188;
        box('Upper white window pillar',.030,.23,.020,m.white,side*.345,.912,z,.004);
        if(Math.abs(z)>.19) {
          box('Lower green window pillar',.028,.175,.020,green,side*.340,.568,z,.004);
          box('Lower passenger window',.010,.145,.154,glazing,side*.343,.568,z+.083,.004);
        }
        if(i<10)box('Deckhouse window band',.010,.195,.162,glazing,side*.350,.913,z+.094,.004);
      }
      // Full-height paired boarding doors interrupt the lower saloon midships.
      for(const z of [-.072,.072]) {
        box('Green boarding door',.040,.285,.135,green,side*.342,.536,z,.006);
        box('Boarding door window',.009,.10,.087,glazing,side*.367,.607,z,.004);
        box('Boarding door handle',.011,.055,.012,m.metal,side*.371,.496,z*.20,.003);
      }
      box('Name board',.012,.045,.40,m.white,side*.369,.384,-.67,.003);
      for(let i=0;i<10;i++) {
        const ring=mesh('Lifebuoy',new T.TorusGeometry(.043,.011,8,20),m.white);
        ring.position.set(side*.369,.772,-.90+i*.20);ring.rotation.y=Math.PI/2;
      }
      for(const z of [-1.10,-.70,0,.70,1.10]) {
        const tire=mesh('Hanging tyre fender',new T.TorusGeometry(.048,.020,8,16),rubber);
        const curvedEnd=Math.abs(z)>1;
        const normal=new T.Vector3(side*(curvedEnd?.92:1),0,curvedEnd?Math.sign(z)*.39:0).normalize();
        const mount=new T.Vector3(side*(curvedEnd?.322:.403),.36,z);
        tire.position.copy(mount).addScaledVector(normal,.036);
        tire.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);
        rod('Tyre fender hanging rope',[mount.x,.47,mount.z],tire.position.clone().add(new T.Vector3(0,.052,0)).toArray(),.006,greenDeep);
      }
    }
    // Rounded passenger-deck ends continue the same rows of windows; no tall
    // separate wheelhouses stand on the roof.
    function wall(name,a,b,y,h,material,thickness=.02) {
      const dx=b[0]-a[0],dz=b[1]-a[1];
      const o=box(name,thickness,h,Math.hypot(dx,dz)+.008,material,(a[0]+b[0])/2,y,(a[1]+b[1])/2,.004);
      o.rotation.y=Math.atan2(dx,dz);return o;
    }
    for(const end of [-1,1]) {
      const points=Array.from({length:9},(_,i)=>{const a=i/8*Math.PI;return [Math.cos(a)*.34,end*(.98+Math.sin(a)*.31)];});
      for(let i=0;i<8;i++) {
        wall('Rounded green lower deck end',points[i],points[i+1],.43,.14,green,.028);
        wall('Rounded white upper deck sill',points[i],points[i+1],.755,.10,m.white,.028);
        wall('Curved upper passenger window',points[i],points[i+1],.913,.195,glazing,.010);
        wall('Curved lower passenger window',points[i],points[i+1],.568,.145,glazing,.010);
        wall('Rounded upper window header',points[i],points[i+1],1.018,.035,m.white,.028);
      }
      for(const [x,z]of points) {
        box('Rounded-end white window pillar',.020,.23,.020,m.white,x,.912,z,.004);
        box('Rounded-end green window pillar',.020,.175,.020,green,x,.568,z,.004);
      }
    }
    for(const y of [.36,.71])for(const z of [-.78,-.50,-.22,.22,.50,.78])for(const side of [-1,1]) {
      box('Passenger bench seat',.20,.022,.12,timber,side*.17,y+.055,z,.006);
      box('Passenger bench back',.20,.075,.018,timber,side*.17,y+.095,z-.05,.005);
    }
    box('Funnel',.22,.24,.25,m.white,0,1.19,0,.035);
    box('Funnel black cap',.24,.045,.27,rubber,0,1.327,0,.016);
    for(const x of [-.055,.055])rod('Exhaust pipe',[x,1.33,0],[x,1.395,0],.019,rubber);
    const star=new T.Shape();
    for(let i=0;i<10;i++) {
      const a=Math.PI/2+i*Math.PI/5,r=i%2?.018:.045;
      if(i===0)star.moveTo(Math.cos(a)*r,Math.sin(a)*r);else star.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    star.closePath();
    for(const side of [-1,1]) {
      const emblem=mesh('Funnel star emblem',new T.ShapeGeometry(star),rubber);
      emblem.rotation.y=side*Math.PI/2;emblem.position.set(side*.112,1.205,0);
    }
    for(const end of [-1,1]) {
      const top=end<0?1.68:1.44;
      rod('Deck mast',[0,1.06,end*1.08],[0,top,end*1.08],.009,m.white);
      rod('Mast crossarm',[-.105,top-.12,end*1.08],[.105,top-.12,end*1.08],.007,m.white);
      const lamp=mesh('Masthead light',new T.SphereGeometry(.018,8,6),m.warm);lamp.position.set(0,top+.02,end*1.08);
    }
    for(const z of [-.63,.62]) {
      box('Low roof ventilation hatch',.24,.025,.25,m.stone,0,1.083,z,.012);
      for(const x of [-.08,0,.08])box('Roof ventilation slot',.018,.004,.18,greenDeep,x,1.098,z,.002);
    }
    root.userData.features=['double-ended green hull','green lower passenger deck','white upper passenger deck','single central white funnel','long low white roof','rounded saloon ends','lifebuoys','hanging tyre fenders','wooden passenger seating'];
    // Share draws across the repeated windows, posts and life rings. Retain
    // hidden source parts for inspection while the finish batches are rendered.
    root.updateMatrixWorld(true);const batches=new Map();
    for(const part of [...root.children]) {
      if(!part.isMesh||Array.isArray(part.material))continue;
      const geometry=(part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone()).applyMatrix4(part.matrix);
      if(!batches.has(part.material))batches.set(part.material,[]);
      batches.get(part.material).push(geometry);part.visible=false;
    }
    for(const [material,geometries]of batches) {
      mesh('Star Ferry shared finish batch',mergeGeometries(geometries,false),material);
      geometries.forEach(g=>g.dispose());
    }
    const cabinLights=[.58,.91].map(y=>{
      const light=new T.PointLight('#ffdf88',0,1.9,2);light.name='Star Ferry passenger deck light';light.position.set(0,y,0);root.add(light);return light;
    });
    root.userData.setNight=amount=>{
      const night=T.MathUtils.clamp(amount,0,1);
      glazing.emissiveIntensity=night*2.1;ceilingLamp.emissiveIntensity=night*2.4;
      lowerDeck.emissiveIntensity=night*.14;upperDeck.emissiveIntensity=night*.18;
      cabinLights.forEach(light=>light.intensity=night*.14);
    };
    root.userData.setNight(0);
  } else {
    const stations = [[-.97, .39, .31, .32], [-.75, .44, .32, .38], [-.29, .46, .34, .45], [.20, .43, .36, .43], [.50, .34, .40, .36], [.81, .23, .45, .25], [1.06, .085, .50, .13], [1.13, .023, .52, .07]];
    hull(stations, blue, m.stone, trim);
    box('Cockpit teak sole', .64, .04, .96, m.wood, 0, -.018, -.35, .025);
    box('Stern bench base', .64, .19, .23, m.stone, 0, .095, -.70, .035);
    box('Stern bench cushion', .65, .09, .23, upholstery, 0, .23, -.70, .04);
    box('Stern backrest', .65, .17, .065, upholstery, 0, .36, -.81, .035);
    const fore = stations.slice(3), outline = [...fore.map(([z, w]) => new T.Vector2(-w + .012, -z)), ...fore.slice().reverse().map(([z, w]) => new T.Vector2(w - .012, -z))];
    const deckGeo = new T.ShapeGeometry(new T.Shape(outline)); deckGeo.rotateX(-Math.PI / 2);
    const position = deckGeo.attributes.position;
    for (let i = 0; i < position.count; i++)position.setY(i, .368 + (position.getZ(i) - .20) / .93 * .155);
    deckGeo.computeVertexNormals(); mesh('Shaped raised foredeck', deckGeo, m.stone);
    // A small glazed pilothouse, with enough open stern deck to read as a boat.
    box('Pilothouse floor', .60, .06, .61, m.stone, 0, .28, .08);
    for (const x of [-.30, .30]) for (const z of [-.22, .39]) box('Cabin corner frame', .045, .43, .045, trim, x, .54, z, .012);
    box('Cabin roof', .72, .09, .77, m.stone, 0, .805, .085, .045);
    const windshield = box('Raked windshield', .57, .32, .018, m.glass, 0, .59, .39, .004); windshield.rotation.x = -.15;
    for (const x of [-.307, .307]) box('Clear cabin side glazing', .018, .32, .54, m.glass, x, .59, .075, .004);
    box('Helm console', .25, .22, .16, blue, .15, .41, .19, .035);
    box('Instrument panel', .19, .055, .11, engine, .15, .54, .19, .012);
    const wheel = mesh('Steering wheel', new T.TorusGeometry(.065, .010, 8, 24), engine); wheel.position.set(.15, .52, .065); wheel.rotation.x = .25;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod('Steering wheel spoke', [.15, .52, .066], [.15 + Math.cos(a) * .058, .52 + Math.sin(a) * .058, .066], .006, engine); }
    for (const x of [-.16, .16]) { box('Pilot seat cushion', .22, .08, .20, upholstery, x, .35, -.11, .03); box('Pilot seat back', .22, .20, .055, upholstery, x, .47, -.21, .025); }
    box('Warm cabin lamp', .07, .035, .09, m.warm, 0, .738, .06, .009);
    box('Outboard motor cowling', .20, .25, .19, engine, 0, .27, -1.03, .045);
    box('Outboard mounting bracket', .19, .065, .12, m.metal, 0, .16, -.93, .016);
    box('Outboard shaft', .07, .33, .075, engine, 0, -.007, -1.02, .018);
    for (let i = 0; i < 3; i++) { const prop = box('Submerged propeller blade', .035, .15, .025, m.metal, 0, -.185, -1.065, .010); prop.rotation.z = i * Math.PI * 2 / 3; }
    for (const side of [-1, 1]) rod('White cylindrical fender', [side * .465, .28, -.35], [side * .465, .12, -.35], .044, m.stone);
    const green = new T.MeshStandardMaterial({ color: '#85d6b0', emissive: '#69b58c', emissiveIntensity: .8, roughness: .4 });
    box('Port navigation light', .065, .045, .09, m.pink, -.39, .43, .36, .016);
    box('Starboard navigation light', .065, .045, .09, green, .39, .43, .36, .016);
    for (const [z, y] of [[.73, .45], [-.87, .32]]) { rod('Mooring cleat post', [0, y, z], [0, y + .06, z], .012, engine); box('Mooring cleat cap', .105, .022, .035, engine, 0, y + .06, z, .008); }
    root.userData.features = ['open hull', 'raised foredeck', 'glazed pilothouse', 'cockpit seating', 'steering wheel', 'outboard motor', 'navigation lights'];
  }
  return root;
}
