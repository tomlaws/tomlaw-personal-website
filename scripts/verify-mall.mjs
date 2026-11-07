import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { MALL, MALL_LIFT_CYCLE, mallLiftPose } from '../src/mallMotion.js';
import { mallLightFloor, areaLightChunk, terraceLightChunk, optimizeAreaLights } from '../src/areaLightShader.js';

const floors=[...MALL.floors,MALL.roof];
assert.equal(MALL.floors.length,3);
assert.equal(new Set(MALL.floorUses).size,3);
const reached=new Set();
for(let t=0;t<MALL_LIFT_CYCLE;t+=.02){
  const pose=mallLiftPose(t),next=mallLiftPose(t+.001);
  assert(pose.height>=floors[0]-1e-8&&pose.height<=MALL.roof+1e-8);
  assert(pose.door>=0&&pose.door<=1);
  assert(Math.abs(pose.height-next.height)<.00121,'Lift speed or cycle boundary discontinuity');
  if(pose.door>.00001){
    assert(Math.abs(pose.height-floors[pose.floor])<1e-8,'Landing doors opened while cabin was travelling');
    reached.add(pose.floor);
  }
}
assert.equal(reached.size,4,'The lift must serve the roof and all three floors');
assert.deepEqual(mallLiftPose(1.6),mallLiftPose(MALL_LIFT_CYCLE+1.6));
for(const [height,floor] of [[8.52,5.10],[12.68,9.26]])assert.equal(mallLightFloor(height),floor);
assert.equal(mallLightFloor(4.36),-1000,'Ground entrance light may spill onto the forecourt');
assert.equal(mallLightFloor(8.30),-1000,'The double-height foyer remains lit to its ground floor');
assert(areaLightChunk.includes('mallReceiver.y<mallFloor-0.05'),'Upper room lights must not leak through the slabs');
const manifest=JSON.parse(await fs.readFile(new URL('../public/models/manifest.json',import.meta.url),'utf8'));
const roofLamps=manifest.lights.filter(light=>light.roofOnly);
assert.equal(roofLamps.length,4,'Four shielded rooftop lamps must have actual light sources');
for(const lamp of roofLamps){
  assert.equal(lamp.type,'spot');assert.equal(lamp.daylightFactor,0);
  assert.equal(lamp.position[0],lamp.target[0]);assert.equal(lamp.position[2],lamp.target[2]);
  assert(Math.abs(lamp.target[1]-MALL.roof)<.001&&Math.abs(lamp.position[1]-MALL.roof-2.10)<.001);
  assert(lamp.distance<=5.5&&lamp.penumbra>=.8&&lamp.angle<Math.PI/2);
}
assert(terraceLightChunk.includes(`roofReceiver.y<${(MALL.roof-.02).toFixed(3)}`),'Roof lamps must not leak into the dining floor');
const patched={fragmentShader:'#include <lights_pars_begin>\n#include <lights_physical_pars_fragment>'};
optimizeAreaLights(patched);
assert(patched.fragmentShader.includes('roofSource=spotLight.position')&&!patched.fragmentShader.includes('#include <lights_pars_begin>'));
for(const name of ['mall-lift.glb','mall-doors.glb'])assert(manifest.assets.some(a=>a.file===name&&a.moving),`${name} must be independently animated`);
const cabin=manifest.assets.find(a=>a.file==='mall-lift.glb');
assert(Math.abs(cabin.bounds.max[2]-2.70)<.01,'Cabin must fit beneath the roof machinery cap');
assert(Math.abs(cabin.bounds.min[2]+.12)<.01,'Cabin top floor datum must align with the finished landings');
const geom=JSON.parse(await fs.readFile(new URL('../assets/validation/geometry-report.json',import.meta.url),'utf8'));
for(const key of ['threeDistinctFloorProgrammes','fourAlignedProtectedLiftStops','clearProtectedRooftop','originalGlassDomeProportions','digitalScreensOnOpaqueFacade'])assert.equal(geom.easternMallAssembly[key],true);
assert(geom.easternMallAssembly.approvedDomeObjectsPreserved>=16);
assert.equal(geom.easternMallAssembly.viewingTerrace.outwardFacingBenches,4);
assert.equal(geom.easternMallAssembly.viewingTerrace.rooftopLamps,4);
assert.equal(geom.easternMallAssembly.viewingTerrace.lampBenchGaps.length,4);
assert(geom.easternMallAssembly.viewingTerrace.lampBenchGaps.every(gap=>gap>1.10&&gap<1.40));
assert(geom.easternMallAssembly.viewingTerrace.lampViewerClearance>3.0);
assert(geom.easternMallAssembly.viewingTerrace.groundedFeet&&geom.easternMallAssembly.viewingTerrace.domeClearance);
assert(manifest.vegetation.every(tree=>tree.root[1]<10),'Removed roof trees must not retain wind anchors');
console.log('✓ Mall: three uses, resized glass dome, clear roof, protected four-stop lift, closed travel doors and isolated ceiling lighting');
