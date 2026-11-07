import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Scene,Vector3} from 'three';
import {buildOriginalWorld} from './build-world.mjs';
import {createCoastalLighting} from '../src/harbour/coastal-world.mjs';
import {createHarbourTime} from '../src/harbour/harbour-time.mjs';

const baseline=JSON.parse(await readFile('assets/validation/peak-tram-preserved-geometry.json','utf8'));
const world=await buildOriginalWorld(),tram=world.peakTram;
assert.equal(tram.stations.length,0,'Both termini are removed');
for(const [i,{body}]of tram.cars[0].cabins.entries()){
  const vertices=[];
  // Lighting fixtures are separate groups. Every original cabin vertex must
  // remain exactly where it was, including glazing, seats and running gear.
  for(const part of body.children){
    if(!part.isMesh)continue;
    const geometry=part.geometry.index?part.geometry.toNonIndexed():part.geometry;
    const p=geometry.attributes.position;
    for(let n=0;n<p.count;n++)vertices.push([p.getX(n),p.getY(n),p.getZ(n)].map(value=>value.toFixed(7)).join(','));
  }
  vertices.sort();
  assert.equal(vertices.length,baseline.cabins[i].vertices);
  assert.equal(createHash('sha256').update(vertices.join('\n')).digest('hex'),baseline.cabins[i].sha256);
  assert.equal(body.children.filter(part=>part.name==='Recessed tram ceiling light').length,2);
}
for(let i=0;i<baseline.route.length;i++)assert.deepEqual(tram.route.point(i/10).toArray(),baseline.route[i]);
const guides=[];tram.track.traverse(part=>{if(part.name==='Recessed track guide light')guides.push(part);});
assert.equal(guides.length,6,'Sparse paired loop lights replace the dense edge rows');
const loopSides=[];
for(const light of guides){
  const nearest=tram.route.closest(light.position.x,light.position.z);
  assert.ok(nearest.distance>.36,'Guides stay outside running rails');
  assert.ok(Math.abs(light.position.y-tram.route.grade(nearest.u)-.055)<.03,'Guides follow the hillside grade');
  if(nearest.u>.25&&nearest.u<.75){
    const tangent=tram.route.tangent(nearest.u),across=new Vector3(-tangent.z,0,tangent.x).normalize();
    loopSides.push(Math.sign(light.position.clone().sub(tram.route.point(nearest.u)).dot(across)));
  }
}
assert.deepEqual(loopSides.sort(),[-1,-1,1,1],'Both branches have two lights on their outer shoulder');
const scene=new Scene();scene.add(world.root);
const time=createHarbourTime(scene,world,createCoastalLighting(scene,world));
for(const amount of [0,.5,1]){
  time.set(amount);
  assert.equal(world.materials.tramWindow.opacity,.56,'Glazing remains transparent');
  assert.ok(world.materials.tramCeilingLight.emissiveIntensity>=world.materials.tramGuideLight.emissiveIntensity);
  for(const light of time.tramInteriors){assert.equal(light.castShadow,false);assert.equal(light.parent.name,'Sixth-generation Peak Tram panoramic carriage');}
}
time.set(0);assert.equal(world.materials.tramGuideLight.emissiveIntensity,0);assert.equal(time.tramInteriors[0].intensity,0);
time.set(1);assert.ok(world.materials.tramWindow.emissive.r>world.materials.tramWindow.emissive.b);
assert.equal(time.trackLights.length,6,'Each visible fixture has an actual surroundings light');
for(const [i,light]of time.trackLights.entries()){
  assert.equal(light.castShadow,false);
  assert.ok(light.intensity>0&&light.distance>=3,'Light reaches beyond the rail bed onto the mountain');
  assert.equal(light.decay,0,'Broad near-field attenuation prevents a pinprick hotspot');
  // Three uses this smooth range cutoff when decay is zero. Light at 1.6 m
  // stays close to its value at 0.4 m, instead of concentrating at the source.
  const attenuation=d=>(1-(d/light.distance)**4)**2;
  assert.ok(attenuation(1.6)/attenuation(.4)>.95,'Wash remains broad around the fixture');
  const fixture=guides[i].getWorldPosition(new Vector3());
  assert.ok(Math.hypot(light.position.x-fixture.x,light.position.z-fixture.z)<1e-8,'Wash is anchored to the fixture');
}
time.set(0);assert.ok(time.trackLights.every(light=>light.intensity===0));time.set(1);
for(const phase of [0,12,31,68]){
  world.animate(phase);world.root.updateMatrixWorld(true);
  for(const [i,light]of time.tramInteriors.entries()){
    const position=tram.cars[Math.floor(i/2)].cabins[i%2].body.localToWorld(new Vector3(0,.82,0));
    assert.ok(position.distanceTo(light.getWorldPosition(new Vector3()))<1e-8,'Interior lights follow the tram through curves and grades');
  }
}
console.log('Peak Tram: original cabin geometry/route preserved; broad washes and two-sided passing-loop lighting passed.');
