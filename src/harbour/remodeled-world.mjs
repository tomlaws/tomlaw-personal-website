import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { facadeGeometry } from './interiors.mjs';
import { letteringGeometry } from './cyberpunk.mjs';
import { CITY_LAYOUT as site } from './layout.mjs';

// A complete second model set. The old authoring sources remain available, but
// none of their models or decorative linework are placed in this scene.
export function createWorld() {
  const root = new T.Group(); root.name = 'Remodeled Lantern Quarter';
  const fixed = new T.Group(); fixed.name = 'New construction'; root.add(fixed);
  const materials = {}, buildings = [], windows = [], places = [], cars = [], fans = [];
  const palette = {
    ground:'#dcd9d5', stone:'#f7f2e8', road:'#b4b6b8', white:'#fffefa',
    peach:'#ffbc85', rose:'#ff9cc3', blue:'#93c3f8', sage:'#90e5b3', lavender:'#d8c8f5',
    copper:'#f2c396', wood:'#f0c890', metal:'#b3cef7', tire:'#ccd1e2',
    leaf:'#9fdb9f', leafLight:'#c2ea9f', leafDark:'#8ed2ab', bark:'#ddd0b8',
    soil:'#e4d8bc', clay:'#f5b894', flower:'#f7a6c6', sea:'#63a9ef', seaLight:'#9ad7ff',
    warm:'#fff0c4', teal:'#b0efe3', pink:'#ffa2cc', violet:'#a97ff0',
  };
  for (const [name,color] of Object.entries(palette)) {
    materials[name] = new T.MeshStandardMaterial({color, roughness:.72, metalness:0});
    materials[name].name = `Pastel ${name}`;
  }
  for (const [name,color] of [['warm','#ffcf8a'],['teal','#5fd7e0'],['pink','#f79ac8']]) {
    materials[name].emissive.set(color); materials[name].emissiveIntensity=.5;
  }
  const m = materials;
  m.glass = new T.MeshPhysicalMaterial({color:'#d8ecfa', transparent:true, opacity:.18, depthWrite:false, roughness:.12, metalness:0, side:T.DoubleSide});
  m.water = new T.MeshPhysicalMaterial({color:'#9fd8f5', transparent:true, opacity:.65, depthWrite:false, roughness:.18, metalness:.12});
  const cache = new Map();
  function mesh(geometry, material, parent, x=0,y=0,z=0) {
    const o = new T.Mesh(geometry,material); o.position.set(x,y,z);
    o.castShadow = !material.transparent; o.receiveShadow = !material.transparent;
    parent.add(o); return o;
  }
  function box(w,h,d,material,parent,x=0,y=0,z=0,r=.045) {
    r = Math.min(r,w*.22,h*.22,d*.22);
    const key = [w,h,d,r].join(':');
    if (!cache.has(key)) cache.set(key,new RoundedBoxGeometry(w,h,d,3,r));
    return mesh(cache.get(key),material,parent,x,y,z);
  }
  const ball = new T.SphereGeometry(1,16,12);
  function puff(w,h,d,material,parent,x,y,z) {
    const o=mesh(ball,material,parent,x,y,z); o.scale.set(w,h,d); return o;
  }
  function cylinder(r,h,material,parent,x=0,y=0,z=0,top=r) {
    const key=`c:${r}:${h}:${top}`;
    if (!cache.has(key)) cache.set(key,new T.CylinderGeometry(top,r,h,20));
    return mesh(cache.get(key),material,parent,x,y,z);
  }
  function group(name,parent=fixed,x=0,y=0,z=0) {
    const g=new T.Group(); g.name=name; g.position.set(x,y,z); parent.add(g); return g;
  }
  function beam(a,b,width,material,parent) {
    const av=new T.Vector3(...a), bv=new T.Vector3(...b), delta=bv.clone().sub(av);
    const o=box(width,delta.length(),width,material,parent,...av.clone().add(bv).multiplyScalar(.5).toArray());
    o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()); return o;
  }
  function label(text,w,parent,x,y,z,ink=m.white) {
    const o=mesh(letteringGeometry(text,w,.19),ink,parent,x,y,z); o.castShadow=false; return o;
  }
  function sign(text,w,parent,x,y,z,color) {
    box(w,.36,.13,color,parent,x,y,z,.06); label(text,w*.85,parent,x,y,z+.072);
  }
  function selectable(name,g,w,d,h,note) {
    const hit = new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial({visible:false}));
    g.updateWorldMatrix(true,false); g.getWorldPosition(hit.position); hit.position.y+=h/2;
    hit.userData={name,note,position:hit.position.clone(),focusZoom:2.5}; root.add(hit); places.push(hit);
  }
  function plant(parent,x,y,z,size=.17,flowers=false) {
    cylinder(size,.25,m.clay,parent,x,y+.125,z,size*.82);
    cylinder(size*.75,.04,m.soil,parent,x,y+.25,z);
    for (let i=0;i<5;i++) { const a=i*2.4; puff(size*.64,size*.9,size*.64,flowers?m.flower:m.leaf,parent,x+Math.cos(a)*size*.48,y+.33+size*.25,z+Math.sin(a)*size*.48); }
  }
  function roofPlant(parent,w,d,y) {
    box(.45,.16,.65,m.stone,parent,-w/2+.34,y+.08,-d/2+.46);
    for(let i=0;i<3;i++) puff(.17,.19,.17,i%2?m.leafLight:m.leaf,parent,-w/2+.34,y+.24,-d/2+.24+i*.2);
    box(.5,.27,.45,m.metal,parent,w/2-.38,y+.14,-d/2+.4);
    box(.36,.07,.31,m.white,parent,w/2-.38,y+.31,-d/2+.4);
    parent.updateWorldMatrix(true,false);
    const anchor=parent.localToWorld(new T.Vector3(w/2-.38,y+.395,-d/2+.4));
    const fan=box(.25,.045,.09,m.metal,root,...anchor.toArray(),.025);fans.push(fan);
  }
  // Thick, calm ground surfaces: no tile grid, route outlines, neon kerbs, or wires.
  box(35.5,2.6,36.5,m.sea,fixed,-5.25,-5.6,-7.25,.15);
  box(35.5,2.8,36.5,m.seaLight,fixed,-5.25,-2.9,-7.25,.15);
  box(19.9,4.45,18.9,m.stone,fixed,-2,-2.225,-1.5,.12);
  box(19.82,.08,18.82,m.ground,fixed,-2,.04,-1.5,.1);
  box(19.72,.035,1.8,m.road,fixed,-2,.099,5.65,.025);
  box(1.8,.035,16.3,m.road,fixed,6.9,.099,-1.6,.025);
  // Raised footpaths meet solid tapered crossing ramps; only traffic markings remain.
  box(17.7,.14,14.3,m.stone,fixed,-3,.15,-2.9,.18);
  box(17.7,.12,1.16,m.stone,fixed,-3,.14,7.35,.12);
  for(const x of [-.9,-.6,-.3,0,.3,.6,.9]) box(.15,.018,1.72,m.white,fixed,x,.128,5.65,.005);
  for(let i=0;i<7;i++) box(1.65,.018,.15,m.white,fixed,6.9,.128,2.8+i*.3,.005);
  const threshold = .225;
  function ramp(x,z,turn=0) {
    const g=group('Crossing ramp',fixed,x,.12,z); g.rotation.y=turn;
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute([-1,0,.35,1,0,.35,1,.1,-.35,-1,.1,-.35],3));
    geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();mesh(geo,m.stone,g);
  }
  ramp(0,4.57);ramp(0,6.74,Math.PI);ramp(5.84,3.7,Math.PI/2);
  // Windows open through actual walls. New furnishings are substantial simple
  // forms rather than a web of curtain rods, wires, miniature rails and mullions.
  function room(parent,spec,trim,index) {
    const {width:w,height:h,x=0,y=0}=spec;
    const g=group('Remodeled furnished room',parent,x,y,0);
    box(w,.06,.48,m.wood,g,0,.015,-.27);
    box(w,h,.055,index%2?m.stone:m.lavender,g,0,h/2,-.51);
    for(const xx of [-w/2,w/2]) box(.065,h,.51,m.stone,g,xx,h/2,-.26);
    box(w,.06,.48,m.stone,g,0,h,-.27);
    // A recessed sill and a single solid reveal around the opening.
    box(w+.10,.08,.16,trim,g,0,-.035,.02);
    box(w+.10,.08,.13,trim,g,0,h+.025,.015);
    for(const xx of [-w/2-.025,w/2+.025]) box(.065,h,.13,trim,g,xx,h/2,.015);
    let owner=parent;while(owner&&!owner.userData.program)owner=owner.parent;
    const program=owner?.userData.program || 'home';
    if (h>.65 && /Archive|Ramen|Voltage|Retail/.test(program)) {
      for(let level=0;level<3;level++) {
        box(w*.78,.075,.22,m.wood,g,0,.17+level*h*.22,-.36);
        for(let i=0;i<4;i++) {
          const xx=-w*.27+i*w*.18,yy=.24+level*h*.22;
          if(program.includes('Ramen'))puff(w*.07,.06,.07,m.peach,g,xx,yy,-.32);
          else box(w*.10,h*.14,.12,[m.sage,m.blue,m.rose,m.peach][i],g,xx,yy,-.35,.025);
        }
      }
      box(w*.70,.25,.18,m.stone,g,0,.16,-.12);
    } else if (h>.65) {
      box(w*.72,.16,.21,index%3?m.peach:m.sage,g,0,.25,-.35,.06);
      box(w*.70,.20,.10,index%3?m.peach:m.sage,g,0,.40,-.44,.05);
      box(w*.24,.12,.16,m.wood,g,w*.23,.11,-.17);
      plant(g,-w*.30,.09,-.22,.075);
      box(w*.30,h*.22,.035,m.white,g,w*.12,h*.72,-.468);
      box(w*.19,h*.13,.025,index%2?m.rose:m.blue,g,w*.12,h*.72,-.443);
    } else {
      box(w*.8,.08,.16,m.wood,g,0,h*.40,-.36);
      for(let i=0;i<4;i++) box(w*.1,h*.32,.10,[m.peach,m.sage,m.blue,m.rose][i],g,-w*.24+i*w*.16,h*.60,-.35);
    }
    box(w,h,.014,m.glass,g,0,h/2,.035,.002);
    windows.push(g);
  }
  function volume(parent,w,d,h,y,wall,trim,floors=1,front=true) {
    const g=group('New architectural volume',parent,0,y,0), corner=.13;
    const faces=[{w:w-2*corner,x:0,z:d/2,a:0},{w:d-2*corner,x:w/2,z:0,a:Math.PI/2},{w:w-2*corner,x:0,z:-d/2,a:Math.PI},{w:d-2*corner,x:-w/2,z:0,a:-Math.PI/2}];
    faces.forEach((f,faceIndex)=>{
      const wallGroup=group('Recessed facade',g,f.x,0,f.z);wallGroup.rotation.y=f.a;
      const specs=[];
      for(let floor=0;floor<floors;floor++) {
        const openingW=Math.min(f.w-.22,faceIndex===0?1.7:1.15);
        if(openingW<.25||(!front&&faceIndex===0)) continue;
        specs.push({width:openingW,height:h/floors*.63,x:0,y:floor*h/floors+.19,shape:'rounded',radius:.055});
      }
      mesh(facadeGeometry(f.w,h,specs,.08,0),wall,wallGroup);
      specs.forEach((spec,i)=>room(wallGroup,spec,trim,i+faceIndex));
    });
    for(const x of [-w/2+corner/2,w/2-corner/2]) for(const z of [-d/2+corner/2,d/2-corner/2]) box(corner,h,corner,wall,g,x,h/2,z,.055);
    box(w+.10,.12,d+.10,trim,g,0,.015,0,.07);
    box(w+.13,.13,d+.13,trim,g,0,h+.05,0,.08);
    for(let f=1;f<floors;f++) box(w+.08,.10,d+.08,trim,g,0,f*h/floors,0,.055);
    return g;
  }
  const wallColors=['#fff4ea','#fafdff','#f9fffc','#fdf9ff','#fdfaff','#f8fbff','#fdf7ff','#fffefa'].map(color=>new T.MeshStandardMaterial({color,roughness:.83}));
  function building(name,anchor,w,d,h,color,wallIndex,floors,kind) {
    const g=group(name,fixed,anchor[0],threshold,anchor[1]);
    g.userData.program=name;
    volume(g,w,d,h,0,wallColors[wallIndex],color,floors);
    // Broad canopies and deep fascias keep the original neighborhood vocabulary.
    box(w*.82,.14,.43,color,g,0,h/floors*.80,d/2+.16,.055);
    sign(name.split(' ')[0].toUpperCase(),w*.73,g,0,h/floors*.86+.15,d/2+.24,color);
    roofPlant(g,w,d,h+.13);
    if(kind==='pitched') {
      for(const side of [-1,1]) {const o=box(w/2+.18,.13,d+.23,m.copper,g,side*w*.24,h+.39,0,.045);o.rotation.z=side*-.34;}
    } else if(kind==='sawtooth') {
      for(let i=0;i<2;i++){const o=box(w+.19,.13,d*.58,color,g,0,h+.32,-d*.25+i*d*.5,.035);o.rotation.x=-.22;}
    } else if(kind==='shed') {const o=box(w+.23,.14,d+.25,m.copper,g,0,h+.36,0,.045);o.rotation.x=.14;}
    plant(g,-w*.34,0,d/2+.37,.13);
    buildings.push({name,group:g,width:w,depth:d,height:h});
    selectable(name,g,w,d,h+.7,`${name}, rebuilt with soft corners, recessed furnished windows and a ${kind} roof in the original pastel palette.`);
    return g;
  }
  building('Ramen diner',site.diner,2.30,1.85,1.85,m.peach,0,1,'flat');
  const apartments=building('Record room',site.apartments,2.25,1.90,2.35,m.blue,1,2,'flat');
  const penthouse=group('Setback penthouse',apartments,0,2.48,-.19);
  volume(penthouse,1.45,1.36,1.25,0,wallColors[1],m.blue,1);
  for(const side of [-1,1]) {const o=box(.94,.12,1.63,m.copper,penthouse,side*.39,1.57,0);o.rotation.z=side*-.34;}
  building('Archive bookshop',site.books,1.95,1.85,1.92,m.sage,2,1,'sawtooth');
  building('Orchid atelier',site.studio,1.78,2.42,2.60,m.rose,3,2,'shed');
  const arcade=building('Voltage arcade',site.arcade,1.72,1.88,2.9,m.rose,7,2,'flat');
  box(1.23,.61,.17,m.lavender,arcade,0,3.32,.3,.07);label('PLAY',.9,arcade,0,3.32,.391,m.white);
  for(const [i,a] of site.towers.entries()) {
    const g=group(i?'Signal exchange':'Relay residences',fixed,a[0],threshold,a[1]);
    const w=i?2.7:2.5,d=2.25;
    volume(g,w,d,1.26,0,wallColors[5+i],m.blue,1);
    const shaft=group('Stepped residential shaft',g,0,1.41,-.05);
    volume(shaft,w-.31,d-.24,i?5.25:6.35,0,wallColors[5+i],m.blue,i?5:6);
    const top=1.41+(i?5.25:6.35)+.17;
    const crown=group('Setback crown',g,.10,top,-.15);
    volume(crown,w-.80,d-.65,.94,0,wallColors[5+i],m.blue,1);
    roofPlant(crown,w-.80,d-.65,1.07);
    plant(g,-w*.31,1.42,.83,.12);
    sign(i?'SIGNAL':'RELAY',1.60,g,0,1.03,d/2+.12,m.blue);
    buildings.push({name:g.name,group:g,width:w,depth:d,height:top+1.12});
    selectable(g.name,g,w,d,top+1.12,'A newly modeled stepped tower with blue floor bands, a planted terrace and recessed rooms.');
  }
  const bridge=group('New enclosed skybridge',fixed,-1.85,3.9,-7.55);
  box(4.00,.20,.85,m.blue,bridge);box(4,.15,.91,m.blue,bridge,0,.95,0);
  for(const z of [-.41,.41]) box(4,.79,.035,m.glass,bridge,0,.47,z,.005);
  // The galleria is remodeled as two wings around an open glazed lantern.
  const mall=group('Lantern Galleria',fixed,...[site.mall[0],threshold,site.mall[1]]);
  for(const side of [-1,1]) {
    const wing=group('Retail wing',mall,side*1.40,0,0);
    wing.userData.program='Retail';
    volume(wing,1.35,3.35,2.55,0,wallColors[4],m.lavender,2);
    roofPlant(wing,1.35,3.35,2.69);
    box(1.46,.30,.19,m.lavender,wing,0,2.84,-1.66,.055);
  }
  box(1.46,.10,3.35,m.lavender,mall,0,.015,0);
  box(1.46,.12,3.35,m.lavender,mall,0,2.69,0);
  for(const x of [-.65,.65]) for(const z of [-1.6,1.6]) box(.13,3.68,.13,m.copper,mall,x,1.84,z,.035);
  for(const z of [-1.6,1.6]) box(1.42,3.20,.025,m.glass,mall,0,1.94,z,.005);
  box(1.45,.15,3.40,m.copper,mall,0,3.7,0);
  // Single roof panels replace the old web of intersecting skylight ribs.
  for(const side of [-1,1]) {const pane=box(.85,.07,3.46,m.glass,mall,side*.36,3.88,0,.012);pane.rotation.z=side*-.32;}
  sign('GALLERIA',2.0,mall,0,2.85,1.77,m.lavender);
  const mallDoors=[];
  for(const side of [-1,1]) {
    const door=group('Sliding entry door',root,site.mall[0]+side*.28,threshold,site.mall[1]+1.63);
    box(.52,1.48,.045,m.glass,door,0,.74,0,.01);box(.055,1.48,.065,m.copper,door,side*.23,.74,.01);
    mallDoors.push({door,side});
  }
  const escalator=group('Remodeled escalator',mall,0,.10,.18);
  for(const side of [-1,1]) {const o=box(.14,.33,2.45,m.lavender,escalator,side*.34,.61,0);o.rotation.x=-.46;}
  const steps=[];
  for(let i=0;i<16;i++){const step=box(.55,.10,.17,m.metal,escalator,0,0,0);steps.push(step);}
  for(let i=0;i<3;i++) cylinder(.12,.18,m.warm,mall,0,3.3,.85-i*.85);
  buildings.push({name:mall.name,group:mall,width:4.15,depth:3.35,height:4.12});
  selectable(mall.name,mall,4.15,3.35,4.12,'The rebuilt galleria has two furnished retail wings, a clean bronze lantern, sliding doors and a moving escalator.');
  // New landscape models use rounded foliage clusters with clear, sturdy trunks.
  const trees=[];
  for(const [i,t] of site.trees.entries()) {
    const g=group('Remodeled tree',fixed,t.x,threshold,t.z);
    box(.74,.18,.74,m.stone,g,0,.09,0,.13);cylinder(.28,.05,m.soil,g,0,.20,0);
    cylinder(.07,1.05,m.bark,g,0,.73,0,.045);
    for(const side of [-1,1]) beam([0,.82,0],[side*.26,1.22,0],.075,m.bark,g);
    const crown=group('Rounded canopy',root,t.x,threshold+1.36,t.z);
    for(const [x,y,z,s] of [[0,.20,0,.52],[-.30,.06,.1,.38],[.3,.10,-.06,.39],[.07,.38,.12,.34]]) puff(s,s*.84,s,i<2?m.flower:(i%2?m.leafLight:m.leaf),crown,x,y,z);
    trees.push(crown);
  }
  for(const bed of site.gardens) {
    const g=group('New planted bed',fixed,bed.x,threshold,bed.z);
    box(bed.width,.14,bed.depth,m.stone,g,0,.07,0,.07);
    box(Math.max(.16,bed.width-.10),.05,bed.depth-.12,m.soil,g,0,.15,0,.03);
    for(let i=0;i<5;i++) puff(bed.width*.40,.15,.22,i%2?m.leaf:m.leafDark,g,0,.25,-bed.depth*.34+i*bed.depth*.17);
  }
  function bench(name,x,z,angle=0,parent=fixed) {
    const g=group(name,parent,x,threshold,z);g.rotation.y=angle;
    for(const xx of [-.41,.41]) box(.12,.33,.42,m.metal,g,xx,.17,0);
    box(1.15,.12,.43,m.wood,g,0,.36,0,.055);
    box(1.15,.28,.12,m.wood,g,0,.57,-.17,.05);
    for(const xx of [-.48,.48]) box(.11,.12,.39,m.wood,g,xx,.55,-.01,.04);
    return g;
  }
  for(const s of site.seats) bench(s.name,s.x,s.z,s.angle);
  const cafe=group('Moon coffee pavilion',fixed,site.cafe[0],threshold,site.cafe[1]);
  for(const x of [-.96,.96]) for(const z of [-.72,.72]) box(.13,1.50,.13,m.wood,cafe,x,.75,z);
  box(2.17,.19,1.85,m.sage,cafe,0,1.56,0,.09);
  box(1.85,.77,.54,m.sage,cafe,0,.40,-.55,.065);box(1.97,.10,.68,m.wood,cafe,0,.82,-.55);
  box(.4,.33,.28,m.metal,cafe,.48,1.02,-.52);cylinder(.07,.09,m.white,cafe,.13,.93,-.41);
  sign('MOON COFFEE',1.67,cafe,0,1.58,1.0,m.sage);
  cylinder(.15,.18,m.warm,cafe,0,1.33,.13);
  selectable('Moon coffee',cafe,2.2,1.85,1.8,'A new rounded canopy, timber posts, espresso counter and terrace furniture.');
  for(const t of site.tables) {
    const g=group('New bistro table',fixed,t.x,threshold,t.z);
    cylinder(.07,.49,m.metal,g,0,.26,0);cylinder(.21,.08,m.metal,g,0,.04,0);cylinder(.35,.10,m.wood,g,0,.55,0);
    for(const side of [-1,1]) {
      const chair=group('New bistro chair',g,side*.55,0,0);chair.rotation.y=side*Math.PI/2;
      for(const xx of [-.10,.10]) for(const zz of [-.10,.10]) box(.065,.30,.065,m.wood,chair,xx,.15,zz);
      box(.32,.09,.30,m.wood,chair,0,.34,0);box(.32,.27,.08,m.wood,chair,0,.50,-.12,.035);
    }
    if(t.umbrella) {
      cylinder(.04,1.68,m.wood,g,0,.84,0);
      const umbrella=mesh(new T.ConeGeometry(.74,.32,24,1,true),m.stone,g,0,1.68,0);umbrella.material.side=T.DoubleSide;
      cylinder(.06,.09,m.wood,g,0,1.87,0);
    }
  }
  const pool=group('Limestone water court',fixed,site.water[0],threshold,site.water[1]);
  box(1.92,.16,1.08,m.stone,pool,0,.08,0,.10);box(1.65,.06,.81,m.blue,pool,0,.17,0,.09);
  box(1.57,.025,.73,m.water,pool,0,.211,0,.08);
  cylinder(.11,.30,m.copper,pool,0,.26,0);puff(.07,.18,.07,m.water,pool,0,.5,0);
  selectable('Water court',pool,1.92,1.08,.8,'A newly modeled limestone basin with a quiet central bubbler.');
  for(const [i,a] of [site.flowers,site.market].entries()) {
    const cart=group(i?'Market cart':'Flower cart',fixed,a[0],threshold,a[1]);cart.rotation.y=site.marketAngle;
    box(1.18,.59,.70,m.wood,cart,0,.43,0,.07);box(1.28,.11,.82,m.stone,cart,0,.79,0);
    for(const x of [-.48,.48]) for(const z of [-.29,.29]) {const wheel=cylinder(.12,.10,m.tire,cart,x,.13,z);wheel.rotation.x=Math.PI/2;}
    for(const x of [-.53,.53]) for(const z of [-.28,.28]) box(.08,.63,.08,m.wood,cart,x,1.10,z);
    for(const side of [-1,1]) {const roof=box(1.39,.09,.52,i?m.rose:m.sage,cart,0,1.45,side*.22);roof.rotation.x=side*.28;}
    for(let j=0;j<3;j++) {
      box(.31,.11,.39,m.copper,cart,-.4+j*.4,.88,0);
      for(let k=0;k<3;k++) puff(.075,.09,.075,i?(j%2?m.peach:m.leafLight):m.flower,cart,-.43+j*.4+k*.06,.99,(k-1)*.08);
    }
    selectable(cart.name,cart,1.39,.99,1.66,'A fully rebuilt wheeled timber stall with a broad folded canopy and modeled goods.');
  }
  const stop=group('New bus shelter',fixed,site.busStop[0],threshold,site.busStop[1]);
  for(const x of [-.89,.89]) box(.13,1.53,.13,m.metal,stop,x,.76,-.30);
  box(2.09,.17,.99,m.blue,stop,0,1.58,0,.08);box(1.83,1.32,.025,m.glass,stop,0,.80,-.30);
  box(1.55,.13,.35,m.wood,stop,0,.43,-.1);for(const x of [-.5,.5]) box(.10,.36,.28,m.metal,stop,x,.20,-.1);
  box(.45,.64,.08,m.stone,stop,.60,.96,-.24);label('23',.25,stop,.60,1.05,-.19,m.blue);
  selectable('Night bus shelter',stop,2.1,1,1.8,'A newly modeled blue canopy, two sturdy supports, glass back and timber waiting seat.');
  for(const anchor of Object.values(site.lamps)) {
    const g=group('New street lamp',fixed,anchor[0],threshold,anchor[1]);
    cylinder(.065,1.38,m.metal,g,0,.73,0);cylinder(.14,.10,m.stone,g,0,.05,0);
    puff(.17,.12,.17,m.warm,g,0,1.5,0);cylinder(.19,.06,m.metal,g,0,1.59,0);
  }
  for(const [i,x] of [-7.05,-6.66,-6.27].entries()) {const g=group('Sorting bin',fixed,x,threshold,-.89);box(.27,.48,.30,[m.sage,m.blue,m.rose][i],g,0,.24,0,.06);box(.31,.07,.34,m.stone,g,0,.51,0);}
  // Bicycle tubes have physical thickness; no free-floating decorative spokes.
  function bike(x,z) {
    const g=group('Remodeled parked bicycle',fixed,x,threshold,z);
    for(const xx of [-.30,.30]) {const o=mesh(new T.TorusGeometry(.22,.045,8,24),m.tire,g,xx,.25,0);o.rotation.y=0;cylinder(.065,.07,m.metal,g,xx,.25,0).rotation.x=Math.PI/2;}
    for(const [a,b] of [[[-.30,.25,0],[0,.28,0]],[[0,.28,0],[-.12,.58,0]],[[-.12,.58,0],[-.30,.25,0]],[[-.12,.58,0],[.23,.58,0]],[[.23,.58,0],[0,.28,0]],[[.23,.58,0],[.30,.25,0]]]) beam(a,b,.045,m.blue,g);
    box(.20,.07,.12,m.wood,g,-.13,.65,0);box(.07,.07,.29,m.metal,g,.24,.68,0);
  }
  bike(2.10,7.63);
  const scooter=group('New scooter',fixed,3.1,threshold,7.63);
  for(const x of [-.27,.27]) cylinder(.15,.12,m.tire,scooter,x,.16,0).rotation.x=Math.PI/2;
  box(.53,.28,.24,m.sage,scooter,0,.35,0,.065);box(.34,.11,.27,m.wood,scooter,-.10,.55,0);box(.12,.48,.27,m.sage,scooter,.27,.44,0,.05);
  beam([.27,.55,0],[.31,.75,0],.07,m.metal,scooter);box(.09,.07,.35,m.metal,scooter,.31,.75,0);
  const utility=group('New utility cabinet',fixed,5.27,threshold,-6.36);box(.44,.74,.36,m.metal,utility,0,.37,0,.07);box(.07,.18,.06,m.stone,utility,.13,.38,.20);
  const hydrant=group('New hydrant',fixed,5.62,threshold,4.02);cylinder(.10,.37,m.peach,hydrant,0,.20,0);puff(.11,.10,.11,m.peach,hydrant,0,.43,0);box(.32,.10,.12,m.peach,hydrant,0,.29,0);
  for(const x of [-1.20,1.20]) {const g=group('New crossing bollard',fixed,x,threshold,4.50);cylinder(.065,.48,m.metal,g,0,.24,0);cylinder(.08,.09,m.stone,g,0,.46,0);}
  const signals=[];
  for(const [x,z,angle] of [[1.34,4.49,0],[-1.33,6.89,Math.PI]]) {
    const g=group('New traffic signal',fixed,x,threshold,z);g.rotation.y=angle;
    cylinder(.06,1.46,m.metal,g,0,.73,0);box(.21,.54,.19,m.metal,g,0,1.48,0,.055);
    const lamps=[];for(const [i,color] of [m.rose,m.warm,m.sage].entries()){const lamp=puff(.061,.061,.035,color,g,0,1.65-i*.16,.104);lamp.userData.baseScale=lamp.scale.clone();lamps.push(lamp);}signals.push(lamps);
  }
  const vendor=group('New vending cabinet',fixed,2.20,threshold,-2.78);
  box(.44,.86,.37,m.blue,vendor,0,.43,0,.065);box(.30,.57,.03,m.glass,vendor,-.035,.47,.20,.005);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)cylinder(.032,.11,[m.peach,m.sage,m.rose][col],vendor,-.13+col*.083,.27+row*.17,.135);
  box(.08,.13,.04,m.stone,vendor,.15,.35,.22);box(.23,.09,.04,m.metal,vendor,-.03,.12,.22);
  const mailbox=group('New mailbox',fixed,site.mailbox[0],threshold,site.mailbox[1]);
  cylinder(.075,.61,m.metal,mailbox,0,.31,0);box(.31,.30,.29,m.blue,mailbox,0,.74,0,.09);box(.20,.05,.045,m.stone,mailbox,0,.78,.16);
  const notice=group('New notice board',fixed,4.98,threshold,-1.02);
  for(const x of [-.28,.28])box(.09,1.05,.09,m.wood,notice,x,.53,0);
  box(.71,.56,.12,m.wood,notice,0,.97,0,.06);for(const x of [-.17,.17])box(.24,.33,.025,m.stone,notice,x,.98,.072,.025);
  // Ground tram, delivery drone, birds, roof machinery and street steam are
  // also new models, so the smaller animated details retain the same treatment.
  box(19.1,.12,.62,m.stone,fixed,-2,.14,site.tramZ,.035);
  for(const z of [-.18,.18])box(19.1,.04,.055,m.metal,fixed,-2,.22,site.tramZ+z,.01);
  const tram=group('Remodeled ground tram',root,0,.23,site.tramZ);
  box(1.93,.44,.56,m.sage,tram,0,.35,0,.10);box(1.81,.10,.55,m.stone,tram,0,.62,0,.045);
  for(const z of [-.288,.288])for(let i=0;i<4;i++)box(.31,.24,.018,m.glass,tram,-.63+i*.42,.43,z,.005);
  for(const x of [-.67,.67])for(const z of [-.27,.27])cylinder(.10,.07,m.tire,tram,x,.105,z).rotation.x=Math.PI/2;
  const drone=group('Remodeled delivery drone',root);
  box(.34,.17,.30,m.blue,drone,0,0,0,.06);box(.25,.21,.24,m.peach,drone,0,-.20,0,.05);
  const rotors=[];
  for(const x of [-.30,.30])for(const z of [-.25,.25]) {
    beam([0,0,0],[x,.04,z],.065,m.metal,drone);
    const rotor=box(.24,.045,.09,m.stone,drone,x,.08,z,.025);rotors.push(rotor);
  }
  const birds=[];
  for(let i=0;i<3;i++) {
    const g=group('Remodeled bird',root),wings=[];
    puff(.08,.075,.16,m.white,g,0,0,0);
    for(const side of [-1,1]){const wing=puff(.17,.045,.09,m.white,g,side*.12,.015,0);wings.push({wing,side});}
    birds.push({g,wings,phase:i*2.1});
  }
  const steam=[];
  for(const anchor of [[-5.8,-2.73],[4.8,-5.75]]) {
    box(.36,.045,.32,m.metal,fixed,anchor[0],threshold,anchor[1],.04);
    for(let i=0;i<3;i++){const o=puff(.12,.17,.12,m.white,root,anchor[0],.4,anchor[1]);steam.push({o,anchor,phase:i/3});}
  }
  const screen=group('New galleria display',mall,1.38,3.30,.62);
  box(1.18,.74,.20,m.lavender,screen,0,0,0,.065);
  const advertisements=['NIGHT MARKET','FORM & HOME','OPEN ALL DAY'].map(text=>label(text,.99,screen,0,0,.108,m.white));
  // Every road vehicle is built anew, with rounded shells, inset glazing and
  // proper wheels. Their silhouette no longer depends on hairline chrome trims.
  function vehicle(name,color,length=1.1,parent=root) {
    const g=group(name,parent);box(length,.25,.52,color,g,0,.27,0,.10);
    box(length*.59,.26,.46,color,g,-.06,.48,0,.07);
    for(const z of [-.236,.236]) box(length*.42,.15,.018,m.glass,g,-.06,.51,z,.005);
    box(.025,.15,.38,m.glass,g,length*.25,.51,0,.005);
    for(const x of [-length*.32,length*.32]) for(const z of [-.265,.265]) {const wheel=cylinder(.13,.09,m.tire,g,x,.17,z);wheel.rotation.x=Math.PI/2;}
    for(const z of [-.17,.17]) box(.045,.09,.10,m.warm,g,length/2+.012,.31,z,.016);
    box(.07,.11,.35,m.stone,g,-length/2-.01,.25,0,.025);return g;
  }
  for(const [i,color] of [m.blue,m.peach,m.rose].entries()) cars.push({g:vehicle('Remodeled road car',color),phase:i*6.1,dir:i===1?-1:1});
  // Sweep the railway once. Continuous deck, rails and parapets replace
  // overlapping boxes, jagged joins and the unsupported contact-wire network.
  const west=-13.8,north=-13.8,radius=3.6,startZ=6.4,endX=10.6;
  const straight=startZ-(north+radius),arcLength=radius*Math.PI/2,northLength=endX-(west+radius),railLength=straight+arcLength+northLength;
  const split=straight+arcLength+3.2;
  function route(s,lane=0) {
    let x,z,heading;
    if(s<straight){x=west;z=startZ-s;heading=Math.PI/2;}
    else if(s<straight+arcLength){const a=Math.PI+(s-straight)/radius;x=west+radius+Math.cos(a)*radius;z=north+radius+Math.sin(a)*radius;heading=1.5*Math.PI-a;}
    else{x=west+radius+s-straight-arcLength;z=north;heading=0;}
    const t=T.MathUtils.clamp((s-split)/10,0,1),high=lane<0;
    const y=4.45+(high?2.5*t*t*(3-2*t):0);
    return {x:x+Math.sin(heading)*lane,z:z+Math.cos(heading)*lane,y,heading};
  }
  function sweep(lane,offset,width,height,dy,material) {
    const vertices=[],indices=[],samples=Math.ceil(railLength/.18);
    for(let i=0;i<=samples;i++) {
      const p=route(railLength*i/samples,lane);
      for(const [across,up] of [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]]) vertices.push(p.x+Math.sin(p.heading)*(offset+across),p.y+dy+up,p.z+Math.cos(p.heading)*(offset+across));
      if(i)for(let j=0;j<4;j++){const a=(i-1)*4+j,b=(i-1)*4+(j+1)%4,c=i*4+(j+1)%4,d=i*4+j;indices.push(a,d,b,b,d,c);}
    }
    indices.push(0,1,2,0,2,3);const n=samples*4;indices.push(n,n+2,n+1,n,n+3,n+2);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(geo,material,fixed);
  }
  for(const lane of [-.72,.72]) {
    sweep(lane,0,1.40,.24,0,m.stone);
    for(const side of [-1,1]) sweep(lane,side*.30,.075,.07,.17,m.metal);
    sweep(lane,lane<0?-.65:.65,.10,.32,.26,m.blue);
    for(let s=.3;s<railLength;s+=.58){const p=route(s,lane);const tie=box(.15,.05,.87,m.wood,fixed,p.x,p.y+.14,p.z,.01);tie.rotation.y=p.heading;}
  }
  for(let s=1.5;s<railLength;s+=5.8) {
    const p=route(s),high=route(s,-.72).y;
    const g=group('Remodeled viaduct pier',fixed,p.x,0,p.z);g.rotation.y=p.heading;
    cylinder(.24,8.82,m.stone,g,0,.01,0,.20);box(.68,.25,2.86,m.blue,g,0,4.27,0,.06);
    if(high>4.8){box(.24,high-4.45,.24,m.stone,g,0,(high+4.45)/2,-.72);box(.70,.25,1.46,m.blue,g,0,high-.17,-.72);}
  }
  const trains=[];
  for(const [lane,dir,phase] of [[.72,1,4],[-.72,-1,11]]) {
    const fleet=[];
    for(let i=0;i<2;i++) {
      const car=vehicle('New metro carriage',m.white,1.6);box(1.03,.13,.035,m.blue,car,0,.52,.25);box(1.03,.13,.035,m.blue,car,0,.52,-.25);fleet.push(car);
    }
    trains.push({fleet,lane,dir,phase});
  }
  const railHit=group('Elevated line selection',root,-2,0,north);selectable('Elevated line',railHit,25,2.8,7.5,'A rebuilt two-level railway with continuous curved track beds, solid parapets and correctly aligned trains.');
  // Rebuilt small animals and clouds use volumes instead of fine wisps.
  const cat=group('New courtyard cat',root,-3.1,threshold,2.1);
  puff(.16,.15,.29,m.stone,cat,0,.19,0);puff(.13,.13,.13,m.stone,cat,0,.33,.20);
  for(const side of [-1,1]) mesh(new T.ConeGeometry(.055,.12,4),m.stone,cat,side*.085,.46,.20);
  for(const x of [-.09,.09]) for(const z of [-.16,.14]) box(.065,.13,.065,m.stone,cat,x,.065,z);
  const tail=puff(.055,.07,.24,m.stone,cat,.09,.20,-.30);
  const clouds=[];
  for(const [i,a] of [[-15.5,9.2,-4],[-8.5,11.4,-16],[8.6,10.4,-11]].entries()) {
    const g=group('New cloud',root,...a);
    for(const [x,y,s] of [[-.5,0,.54],[0,.18,.74],[.63,0,.47]]) puff(s,s*.55,s*.62,m.white,g,x,y,0);
    clouds.push({g,base:a,phase:i});
  }
  // Merge opaque static geometry by palette after authoring. Glass stays separate
  // so its sorting and depth-write policy cannot hide solids behind it.
  root.updateMatrixWorld(true);
  const batches=new Map();
  fixed.traverse(o=>{if(!o.isMesh||o.material.transparent)return;const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!geometry.attributes.uv)geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));const key=o.material;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(geometry);});
  const merged=group('Remodeled static batches',root);
  for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries,false);if(!geometry)throw new Error('Incompatible new geometry');const o=new T.Mesh(geometry,material);o.castShadow=true;o.receiveShadow=true;merged.add(o);geometries.forEach(g=>g.dispose());}
  const remove=[];fixed.traverse(o=>{if(o.isMesh&&!o.material.transparent)remove.push(o);});remove.forEach(o=>o.removeFromParent());
  const framingBounds=new T.Box3(new T.Vector3(-23,-6.9,-25.5),new T.Vector3(12.5,0,11));
  // Add the upper scene separately so framing is based on real content, rather
  // than an enormous empty box reaching from the sea corners up to the clouds.
  const framingPoints=[];
  function corners(b){for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])framingPoints.push(new T.Vector3(x,y,z));}
  corners(framingBounds);for(const b of buildings)corners(new T.Box3(new T.Vector3(b.group.position.x-b.width/2,threshold,b.group.position.z-b.depth/2),new T.Vector3(b.group.position.x+b.width/2,b.height+threshold,b.group.position.z+b.depth/2)));
  for(const c of clouds)corners(new T.Box3(c.g.position.clone().addScalar(-1.4),c.g.position.clone().addScalar(1.4)));
  for(let s=0;s<=railLength;s+=.5){for(const lane of [-.72,.72]){const p=route(s,lane);framingPoints.push(new T.Vector3(p.x,p.y+1,p.z));}}
  let lastTime=0;
  function animate(time) {
    lastTime=time;
    for(const car of cars){const distance=(time*.63+car.phase)%18.4;car.g.position.set(-11.2+distance,.0765,car.dir>0?5.22:6.08);car.g.rotation.y=car.dir>0?0:Math.PI;}
    for(const train of trains)for(const [i,car] of train.fleet.entries()) {
      const distance=(time*1.05+train.phase)%railLength;
      const s=train.dir>0?distance-i*1.78:railLength-distance+i*1.78;
      car.visible=s>.9&&s<railLength-.9;
      if(!car.visible)continue;
      const p=route(s,train.lane),a=route(s-.52,train.lane),b=route(s+.52,train.lane);
      car.position.set(p.x,p.y+.165,p.z);car.rotation.set(0,p.heading+(train.dir<0?Math.PI:0),Math.atan2(b.y-a.y,1.04)*train.dir);
    }
    for(const [i,step] of steps.entries()){const u=((i/steps.length+time*.15)%1);step.position.set(0,.15+u*.95,.95-u*1.9);}
    for(const {door,side} of mallDoors)door.position.x=site.mall[0]+side*(.28+.30*(.5+.5*Math.sin(time*.35)));
    tram.position.x=-10.3+((time*.48+5.2)%16.6);
    drone.visible=time%32<11;drone.position.set(-11+(time%32)*1.4,5.5+Math.sin(time*.8)*.15,-1.6);rotors.forEach(r=>r.rotation.y=time*16);
    birds.forEach(({g,wings,phase})=>{g.position.set(-2+Math.cos(time*.15+phase)*4,9+Math.sin(time*.24+phase)*.35,-5+Math.sin(time*.15+phase)*2);wings.forEach(({wing,side})=>wing.rotation.z=side*Math.sin(time*6+phase)*.35);});
    steam.forEach(({o,anchor,phase})=>{const u=(time*.28+phase)%1;o.position.set(anchor[0]+Math.sin(time+phase)*.06,.33+u*.6,anchor[1]);o.scale.set(.10+u*.08,.13+u*.06,.10+u*.08);});
    fans.forEach(f=>f.rotation.y=time*1.4);
    advertisements.forEach((ad,i)=>ad.visible=i===Math.floor(time/8)%3);
    signals.forEach(lamps=>lamps.forEach((lamp,i)=>lamp.scale.copy(lamp.userData.baseScale).multiplyScalar(i===(time%20<11?2:time%20<14?1:0)?1:.6)));
    trees.forEach((c,i)=>c.rotation.z=Math.sin(time*.55+i)*.025);
    clouds.forEach(c=>{c.g.position.x=c.base[0]+Math.sin(time*.035+c.phase)*.35;});
    tail.rotation.y=Math.sin(time)*.18;root.updateMatrixWorld(true);
  }
  const cyberpunk={materials:{cyan:m.teal,magenta:m.pink,violet:m.violet,acid:m.sage},setGlow(){}};
  animate(0);
  return {root,materials,buildings,windows,places,cars,trains,trees,clouds,steps,mallDoors,tram,drone,birds,advertisements,animate,cyberpunk,framingPoints,rail:{route,length:railLength},worldSize:20,worldWidth:20,worldDepth:19,worldBounds:{minX:-23,maxX:12.5,minZ:-25.5,maxZ:11},interiorLights:[],statistics:{staticBatches:batches.size},get time(){return lastTime;}};
}

