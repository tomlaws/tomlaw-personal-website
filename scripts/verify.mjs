import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { validateBytes } from 'gltf-validator';
import { OrthographicCamera,Vector3 } from 'three';
import { ISO_POLAR,RAIL,nearestIsometricYaw,shortestAngle,isometricOffset,hongKongHours,sampleAtmosphere,KEYFRAMES,ROAD_LENGTH,routePoint,shuttlePosition,liftHeight,visibleLaneRange } from '../src/cityMath.js';
import { pixelRatioBudget } from '../src/renderQuality.js';
import { createWindClock, createTreeWind, treeWindWeight } from '../src/treeWind.js';
import { TRAFFIC } from '../src/trafficSignals.js';

// A paused simulation must freeze the wind clock and its shadow refresh budget.
const breeze=createWindClock();
for(let i=0;i<60;i++)breeze.advance(1/60,true);
const frozenTime=breeze.time,frozenShadow=breeze.shadowElapsed;
for(let i=0;i<60;i++)assert.equal(breeze.advance(1/30,false),false);
assert.equal(breeze.time,frozenTime);assert.equal(breeze.shadowElapsed,frozenShadow);
breeze.advance(30,true);assert(Math.abs(breeze.time-frozenTime-.1)<1e-10,'Tab resume must not jump the tree pose');
for(const slow of [false,true]){
  const c=createWindClock();let refreshes=0;
  for(let i=0;i<600;i++)if(c.advance(1/60,true,slow))refreshes++;
  assert(refreshes<=(slow?20:40),'Wind shadows exceeded their refresh budget');
  assert(refreshes>=(slow?19:39));
}
const sampleTree={root:[16,.87,2.5],height:5.53,radius:3.6};
for(let x=15.4;x<16.7;x+=.1)assert.equal(treeWindWeight([x,1.4,2.5],sampleTree),0,'Tree root flare must stay pinned');
assert.equal(treeWindWeight([24,6,2.5],sampleTree),0,'Wind must not displace nearby architecture');
assert(treeWindWeight([16,6,2.5],sampleTree)>.7);
const wind=createTreeWind([sampleTree]);
for(let i=0;i<1200;i++){
  wind.animate(1/60,true,false);
  assert(wind.uniforms.uWindSway.value.length()<.39,'Breeze must remain gentle at metre scale');
}
const still=wind.uniforms.uWindSway.value.clone(),time=wind.uniforms.uWindTime.value;
wind.animate(10,false,false);
assert.equal(wind.uniforms.uWindTime.value,time);assert(wind.uniforms.uWindSway.value.equals(still));
console.log('✓ Tree roots stay fixed, wind pauses without jumps and shadow updates stay bounded');

assert(Math.abs((Math.PI/2-ISO_POLAR)*180/Math.PI-35.26438968)<1e-7);
for(let yaw=-Math.PI*4;yaw<Math.PI*4;yaw+=.07){
  const snapped=nearestIsometricYaw(yaw),offset=isometricOffset(snapped);
  assert(Math.abs(shortestAngle(yaw,snapped))<=Math.PI/4+1e-9);
  const c=new OrthographicCamera(-100,100,100,-100,.1,900);c.position.set(...offset);c.lookAt(0,0,0);c.updateMatrixWorld();
  const origin=new Vector3().project(c),lengths=[[1,0,0],[0,1,0],[0,0,1]].map(p=>{const v=new Vector3(...p).project(c);return Math.hypot(v.x-origin.x,v.y-origin.y);});
  assert(Math.max(...lengths)-Math.min(...lengths)<1e-9,'Every settled view must project all three axes at equal scale');
}
for(const [w,h] of [[390,844],[1440,900],[3840,2160]])for(const device of [1,2,3]){
  const dpr=pixelRatioBudget(w,h,device);assert(w*h*dpr*dpr<=1500000+1);assert(dpr<=device&&dpr<=1.25);
}
assert.equal(hongKongHours(new Date('2026-10-08T16:00:00Z')),0);
assert.equal(hongKongHours(new Date('2026-10-09T04:30:30.500Z')),12.508472222222222);
for(const key of KEYFRAMES){
  const a=sampleAtmosphere(key.hour-1e-7),b=sampleAtmosphere(key.hour+1e-7);
  for(const p of ['night','ambient','sun'])assert(Math.abs(a[p]-b[p])<1e-5,`Lighting discontinuity at ${key.hour}`);
  for(const p of ['r','g','b'])assert(Math.abs(a.sky[p]-b.sky[p])<1e-5);
}
assert(sampleAtmosphere(0).night>sampleAtmosphere(12).night);
const start=routePoint(0),end=routePoint(ROAD_LENGTH);
assert(Math.hypot(start[0]-end[0],start[1]-end[1])<1e-7,'The road loop must close');
for(const [lx,lz] of [[-18,18.8],[17,18.8],[-27.3,-8],[27.3,-8]]){
  for(let s=0;s<ROAD_LENGTH;s+=.2){
    const [x,z,yaw]=routePoint(s),dx=lx-x,dz=lz-z;
    const side=Math.abs(Math.cos(yaw)*dx-Math.sin(yaw)*dz);
    const along=Math.abs(Math.sin(yaw)*dx+Math.cos(yaw)*dz);
    assert(side>1.35||along>2.65,'Taxi swept body intersects a streetlight');
  }
}
for(let s=0;s<ROAD_LENGTH*2;s+=.03){
  const a=routePoint(s),b=routePoint(s+.01);
  assert(Math.hypot(a[0]-b[0],a[1]-b[1])<.010001,'Traffic must maintain speed through corners');
  assert(Math.abs(Math.atan2(Math.sin(a[2]-b[2]),Math.cos(a[2]-b[2])))<.0033,'Vehicle heading must not snap');
}
for(let t=0;t<120;t+=.01){
  const x=shuttlePosition(t),e=liftHeight(t);
  assert(x>=-RAIL.travelLimit&&x<=RAIL.travelLimit);assert(e>=.66-1e-9&&e<=4.56+1e-9);
  assert(Math.abs(shuttlePosition(t+.001)-x)<.0026);
  assert(Math.abs(liftHeight(t+.001)-e)<.001);
}
assert.equal(shuttlePosition(0),shuttlePosition(RAIL.cycleSeconds));assert.equal(liftHeight(0),liftHeight(20));
assert.equal(shuttlePosition(2),-RAIL.travelLimit);assert.equal(shuttlePosition(36),RAIL.travelLimit);
for(const t of [16,18,22,50,53,56])assert.equal(shuttlePosition(t),0,'Train must dwell at aligned platform gates');
assert(Math.abs(liftHeight(0)+.14-.8)<1e-9,'Lift floor must meet the ground landing');
assert(Math.abs(liftHeight(10)+.14-4.7)<1e-9,'Lift floor must meet the terrace');
for(const zoom of [.7,1,3])for(const yaw of [.3,.8,1.7,3.8]){
  const c=new OrthographicCamera(-60,60,42,-42,.1,900);
  c.position.set(20+100*Math.sin(yaw),90,100*Math.cos(yaw));c.lookAt(20,6,0);c.zoom=zoom;c.updateProjectionMatrix();c.updateMatrixWorld();
  const range=visibleLaneRange(c,40,-1.63);
  if(range)for(const x of range){const p=new Vector3(x,-1.63,40).project(c);assert(Math.abs(p.x)>1||Math.abs(p.y)>1,'Ferry wrap must stay outside the viewport after orbit/zoom/pan');}
}
console.log('✓ Hong Kong time, midnight continuity, lighting, traffic, rail dwell and lift travel');

const root=new URL('../public/models/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root),'utf8'));
assert.equal(manifest.units,'metres');assert.equal(manifest.version,2);
const signLights=manifest.lights.filter(light=>light.signSurface);
assert.equal(new Set(manifest.lights.map(light=>light.name)).size,manifest.lights.length,'Exported light identities must be unique for React reconciliation');
assert.deepEqual(new Set(signLights.map(l=>l.name)),new Set(['Repair blade pink bounce','Cinema pylon pink spill',
  'Night repair facade wash','Night cinema crown wash','Night toyshop fascia wash','Night galleria campaign wash',
  'Night tea shopfront neon']),
  'Each facade sign and new architectural light needs a validated receiver');
for(const light of signLights){
  const surface=light.signSurface,center=new Vector3(...surface.center),normal=new Vector3(...surface.normal);
  const position=new Vector3(...light.position),aim=new Vector3(...light.target).sub(position).normalize();
  assert(aim.dot(normal)<-.9999,`${light.name}: spill must face into the facade`);
  assert(Math.abs(aim.y)<1e-5,`${light.name}: tilting the source slices the vertical receiver`);
  assert(light.width>0&&light.height>0,'Sign footprint must survive the Blender export');
  const tangent=new Vector3().crossVectors(new Vector3(0,1,0),normal);
  // All corners, bevel depth and a surrounding halo must lie ahead of the
  // emitting plane. This catches the previous sharply chopped area-light spill.
  for(const x of [-1,1])for(const y of [-1,1])for(const depth of [-.12,.12]){
    const corner=center.clone().addScaledVector(tangent,x*(surface.width/2+.6))
      .add(new Vector3(0,y*(surface.height/2+.6),0)).addScaledVector(normal,depth);
    assert(corner.sub(position).dot(aim)>.4,`${light.name}: sign or halo crosses the light's back plane`);
  }
}
console.log('✓ Facade sign emitters cover their complete receiver without a lighting-plane cutoff');
const names=new Set(manifest.assets.map(a=>a.name));assert.equal(names.size,manifest.assets.length);
assert(manifest.assets.some(asset=>asset.file==='cloudberry-toyshop.glb'&&!asset.moving&&!asset.renderStyle),'The toyshop belongs to the normal physically shaded city');
const toyshopGeometry=JSON.parse(await fs.readFile(new URL('../assets/validation/geometry-report.json',import.meta.url),'utf8')).toyshopAssembly;
assert(toyshopGeometry.connectedClosedShell&&toyshopGeometry.continuousPavingAndClearApproach);
assert(toyshopGeometry.openRoofLightwell&&toyshopGeometry.ceilingLightsAboveWindows,'The roof lantern must open into the lit room');
assert(toyshopGeometry.planarRoofNormals,'Flat roof surfaces must not show diagonal smoothed shading');
assert.equal(toyshopGeometry.clearGlazedOpenings,10);assert(toyshopGeometry.displayToys>=10);
assert(toyshopGeometry.physicalMaterialsAndShadows&&toyshopGeometry.texturedFinishes===4);
// The rebuilt teahouse is one hollow envelope with real apertures, and its shop
// interior must stay lit by a real broad emitter rather than a glowing panel.
const teahouseGeometry=JSON.parse(await fs.readFile(new URL('../assets/validation/geometry-report.json',import.meta.url),'utf8')).cyberpunkTeahouseAssembly;
assert(teahouseGeometry.connectedClosedShell&&teahouseGeometry.realApertures===5,'The teahouse keeps five real apertures in one closed envelope');
assert(teahouseGeometry.continuousInteriorLightEnvelope&&teahouseGeometry.cladBeltAndFixings,'Keep the lit interior and the pressed-sheet detailing');
assert(teahouseGeometry.flatMachineRoof&&teahouseGeometry.rooftopPlant?.length===5,'The teahouse roof must stay the flat machine deck with its plant');
const teaLights=manifest.lights.filter(light=>/tea/i.test(light.name));
assert.equal(teaLights.length,3,'The teahouse keeps to three local emitters');
const teaInterior=teaLights.find(light=>light.name==='Tea interior cool ceiling');
assert(teaInterior&&teaInterior.width>4&&teaInterior.height>2,'A broad emitter must light the room, not a glowing back panel');
assert(teaInterior.position[1]>3&&teaInterior.target[1]<teaInterior.position[1],'The interior emitter must sit at ceiling height and face down');
assert(teaInterior.position[0]>-16&&teaLights.length===3,'The interior emitter must sit inside the shop');
const toyshopLights=manifest.lights.filter(light=>light.name.startsWith('Toyshop'));
assert.equal(toyshopLights.length,3);
assert(toyshopLights.every(light=>light.position[1]>5.1&&light.target[1]<light.position[1]),'Toyshop lights must sit above the windows and face downward');
assert(manifest.vegetation?.length>0,'The Blender manifest must retain tree wind anchors');
for(const tree of manifest.vegetation){
  assert(tree.root.length===3&&tree.root.every(Number.isFinite));
  assert(tree.height>4&&tree.height<7&&tree.radius>2&&tree.radius<4,'Street trees retain authored metre-scale canopy bounds');
}
const taxi=manifest.assets.find(a=>a.file==='taxi.glb');
const taxiLength=taxi.bounds.max[1]-taxi.bounds.min[1];assert(taxiLength>4.5&&taxiLength<4.8);
assert(Math.abs(taxiLength-TRAFFIC.vehicleLength)<.02,'Signal stopping clearance must use the exported taxi length');
const taxiHeight=taxi.bounds.max[2]-taxi.bounds.min[2];assert(taxiHeight>1.4&&taxiHeight<1.9);
const taxiWidth=taxi.bounds.max[0]-taxi.bounds.min[0];assert(taxiWidth>1.8&&taxiWidth<2.15,'Sedan width including mirrors must remain proportional to its 4.7 m length');
const train=manifest.assets.find(a=>a.file==='metro.glb');
const lift=manifest.assets.find(a=>a.file==='lift.glb');
assert(liftHeight(10)+lift.bounds.max[2]<7.7,'Lift cabin must fit below the shaft cap at the upper stop');
const trainLength=train.bounds.max[1]-train.bounds.min[1];assert(trainLength>19.8&&trainLength<20.3);
const trainWidth=train.bounds.max[0]-train.bounds.min[0];
assert(trainLength/2/trainWidth>3.1&&trainLength/2/trainWidth<3.5,'Cartoon coaches retain compact, consistent proportions');
assert(RAIL.travelLimit+trainLength/2<RAIL.bufferInnerEdge,'The train must clear the end buffers at both turnbacks');
assert(Math.abs(train.bounds.max[2]-RAIL.bodyHeight)<.01,'Exported train height must match its clearance configuration');
const reports=[];
// Read exported PNG texels, not material metadata: a linear image mislabeled
// as glTF sRGB previously made mineral-blue walls almost black in the browser.
function pngMean(bytes){
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),channels=bytes[25]===6?4:3;
  assert.equal(bytes[24],8);assert([2,6].includes(bytes[25]));assert.equal(bytes[28],0);
  const chunks=[];
  for(let p=8;p<bytes.length;){const length=bytes.readUInt32BE(p);if(bytes.subarray(p+4,p+8).toString()==='IDAT')chunks.push(bytes.subarray(p+8,p+8+length));p+=length+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=Buffer.alloc(stride*height),total=[0,0,0];
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert(filter<=4);
    for(let x=0;x<stride;x++){
      const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;
      pixels[i]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
      if(x%channels<3)total[x%channels]+=pixels[i];
    }
  }
  return total.map(v=>v/(width*height));
}
for(const file of [...manifest.assets.map(a=>a.file),'nocturne-city.glb']){
  const bytes=await fs.readFile(new URL(file,root));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(json.asset.version,'2.0');
  assert((json.images??[]).every(im=>im.bufferView!==undefined),'All material images must be embedded');
  assert(json.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert(json.materials.some(m=>m.normalTexture)||file==='lift.glb');
  if(file==='signals.glb'){
    assert.equal(json.materials.length,5,'Signal animation stays within five small draw batches');
    assert.deepEqual(json.materials.map(m=>m.extras.paletteKey).sort(),['Traffic red','Traffic amber','Traffic green','Pedestrian red','Pedestrian green'].sort());
    for(const material of json.materials){
      assert(material.normalTexture&&material.emissiveTexture,'Signal optics retain embedded detail and illumination maps');
      assert(material.emissiveFactor.some(v=>v>0),'Lens emission survives export');
    }
  }
  if(file==='jade-corner-teahouse.glb'){
    const cladding=json.materials.find(m=>m.extras?.paletteKey==='Neon panel');
    assert(cladding,'The teahouse must keep its pressed-metal cladding finish');
    assert(cladding.pbrMetallicRoughness.baseColorTexture&&cladding.pbrMetallicRoughness.metallicRoughnessTexture&&cladding.normalTexture,
      'Cladding keeps albedo, roughness and panel-joint relief');
    assert(cladding.occlusionTexture&&json.materials.some(m=>m.extras?.paletteKey==='Night magenta'),
      'The teahouse receives baked contact shading and keeps its neon tubes');
  }
  if(file==='cloudberry-toyshop.glb'){
    const finishes=json.materials.filter(m=>m.extras?.paletteKey?.startsWith('Toyshop '));
    assert.equal(finishes.length,4,'The toyshop has four coordinated architectural finishes');
    for(const material of finishes)assert(material.pbrMetallicRoughness.baseColorTexture&&material.pbrMetallicRoughness.metallicRoughnessTexture&&material.normalTexture);
    assert(json.materials.some(m=>m.alphaMode==='BLEND'),'Shop windows and the lantern retain real glazing');
    assert(finishes.every(m=>m.occlusionTexture),'The toyshop receives the same baked contact shading as its neighbours');
    for(const mesh of json.meshes)for(const primitive of mesh.primitives)assert(primitive.attributes.COLOR_0===undefined,'The abandoned painted-shadow experiment must not darken PBR materials');
  }
    if(['taxi.glb','lift.glb','metro.glb','ferry.glb'].includes(file)){
    assert(json.materials.some(m=>m.alphaMode==='BLEND'),'Transport cabin windows must be transparent');
    assert(json.materials.some(m=>m.emissiveFactor?.some(v=>v>0)),'Transport interior fixtures must retain emission');
  }
  if(!manifest.assets.find(a=>a.file===file)?.moving){
    assert(json.materials.some(m=>m.occlusionTexture),'Physical static assets require baked occlusion');
    if(!['thermal-exchange.glb','quay-and-streets.glb'].includes(file)) assert(json.materials.some(m=>m.alphaMode==='BLEND'),'Building glazing must survive export');
  }
  if(file==='nocturne-city.glb'){
    assert(json.materials.length<=52,'Keep the district batched; the quarter shares its neon tube and cladding materials');
    assert(json.materials.some(m=>m.extras?.paletteKey==='Toyshop tobacco brick'),'The toyshop belongs in the single batched runtime city');
    const aoImages=new Set(json.materials.filter(m=>m.occlusionTexture).map(m=>json.textures[m.occlusionTexture.index].source));
    assert.equal(aoImages.size,1,'The runtime city must share a single occlusion atlas image');
    // Daylight target: sand paving, warm near-white walls and a saturated
    // cobalt accent, matching reference/daytime/pastel-toytown-isometric.png.
    for(const [name,expected] of [['Mineral blue',[51,128,171]],['Paving stone',[205,185,146]],['Street asphalt',[142,135,121]]]){
      const mat=json.materials.find(m=>m.extras?.paletteKey===name);
      const texture=json.textures[mat.pbrMetallicRoughness.baseColorTexture.index];
      const view=json.bufferViews[json.images[texture.source].bufferView];
      const offset=28+bytes.readUInt32LE(12)+(view.byteOffset??0);
      const mean=pngMean(bytes.subarray(offset,offset+view.byteLength));
      mean.forEach((v,i)=>assert(Math.abs(v-expected[i])<expected[i]*.15,`${name} exported colour must retain its authored sRGB palette; got ${mean}`));
    }
    for(const mesh of json.meshes)for(const p of mesh.primitives){
      const mat=json.materials[p.material];
      if(mat.emissiveTexture)assert(p.attributes['TEXCOORD_'+(mat.emissiveTexture.texCoord??0)]!==undefined,'Room illumination UVs must survive batching');
    }
  }
  const result=await validateBytes(new Uint8Array(bytes),{uri:file,maxIssues:40});
  reports.push({file,errors:result.issues.numErrors,warnings:result.issues.numWarnings,issues:result.issues.messages});
  assert.equal(result.issues.numErrors,0,`${file}: ${JSON.stringify(result.issues.messages.filter(m=>m.severity===0))}`);
}
await fs.mkdir(new URL('../assets/validation/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../assets/validation/gltf-report.json',import.meta.url),JSON.stringify(reports,null,2));
const warnings=reports.reduce((n,r)=>n+r.warnings,0);
console.log(`✓ ${reports.length} GLB assets validated: no errors, ${warnings} warnings (see assets/validation/gltf-report.json)`);
console.log('✓ Metre-scale vehicles, exported sRGB palette, embedded PBR maps, baked occlusion and local Draco assets');
