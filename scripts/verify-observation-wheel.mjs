import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Matrix4,Vector3,Scene} from 'three';
import {buildOriginalWorld} from './build-world.mjs';
import {WHEEL_FRAME} from '../src/harbour/wheel-frame-meshes.mjs';
import {createCoastalLighting} from '../src/harbour/coastal-world.mjs';
import {createHarbourTime} from '../src/harbour/harbour-time.mjs';

const world=await buildOriginalWorld(),wheel=world.observationWheel;
assert.equal(wheel.gondolas,16);
assert.equal(WHEEL_FRAME.filter(p=>p.name.startsWith('Observation Wheel primary spoke')).length,16,'Eight paired structural spokes');
assert.equal(WHEEL_FRAME.filter(p=>p.name.startsWith('Observation Wheel luminous outer rim')).length,2);
const bytes=await readFile('assets/blender/observation-wheel-edit-base.glb');
const old=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
for(const cabin of wheel.cabins){
  const oldGroup=old.getObjectByName(cabin.name.replaceAll(' ','_'));
  assert.ok(oldGroup,`Retained source for ${cabin.name}`);
  let first;oldGroup.traverse(o=>{if(!first&&o.isMesh)first=o;});
  assert.deepEqual(cabin.geometry.attributes.position.array,first.geometry.attributes.position.array,`${cabin.name}: original enclosed cabin shape`);
  assert.equal(cabin.count,16);
}
const local=new Matrix4(),full=new Matrix4(),up=new Vector3();
for(const t of [0,.5,7,22,59]){
  world.animate(t);wheel.group.updateWorldMatrix(true,true);
  for(const cabin of wheel.cabins)for(let i=0;i<cabin.count;i++){
    cabin.getMatrixAt(i,local);full.multiplyMatrices(wheel.group.matrixWorld,local);
    up.set(0,1,0).transformDirection(full);
    assert.ok(up.distanceTo(new Vector3(0,1,0))<1e-6,'Hanging cabins remain level throughout rotation');
  }
}
const scene=new Scene();scene.add(world.root);
const time=createHarbourTime(scene,world,createCoastalLighting(scene,world));
const frame=wheel.group.getObjectByName('Observation Wheel rims and primary spokes');
const emission=frame.geometry.attributes.harbourEmission;
assert.ok(emission.array.every(Number.isFinite));
for(let i=0;i<emission.count;i++)assert.ok(emission.getX(i)>=emission.getY(i)*4&&emission.getX(i)>=emission.getZ(i)*5,'Muted warm-red architectural lighting');
const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <emissivemap_fragment>'};
frame.material.onBeforeCompile(shader);
time.set(0);assert.equal(shader.uniforms.harbourNight.value,0);
assert.ok(time.wheelUplights.every(light=>light.intensity===0));
assert.equal(time.wheelCabinFill.intensity,0,'Red cabin fill switches off by day');
time.set(1);assert.equal(shader.uniforms.harbourNight.value,1);
assert.equal(time.wheelUplights.length,2);
assert.ok(time.wheelCabinFill.intensity>0&&!time.wheelCabinFill.castShadow);
assert.equal(time.wheelCabinFill.color.getHex(),time.wheelUplights[0].color.getHex(),'Cabins catch the same red as the base uplights');
const fixedFill=time.wheelCabinFill.position.clone();
assert.ok(time.wheelUplights.every(light=>light.target.position.y>light.position.y+2&&light.penumbra===1&&!light.castShadow),'Soft upward floodlights from the fixed footing');
assert.ok(shader.vertexShader.includes('modelMatrix*vec4(transformed,1.)'),'Uplight wash stays in world space while the wheel rotates');
assert.ok(shader.fragmentShader.includes('mix(1.,.65,smoothstep'),'Soft fade toward the top of the wheel');
const mist=[];world.root.traverse(o=>{if(o.isMesh&&o.material.name==='Wheel soft uplight mist')mist.push(o);});
assert.equal(mist.length,4);
const {data,width,height}=mist[0].material.map.image;
assert.ok(mist[0].material.opacity<.08&&!mist[0].material.depthWrite,'Very transparent haze');
for(let x=0;x<width;x++)assert.equal(data[((height-1)*width+x)*4+3],0,'Mist fades completely before its upper edge');
const cabinLight=wheel.cabins.map(cabin=>cabin.geometry.attributes.harbourEmission.array.slice());
for(const light of cabinLight)assert.ok(light.some(value=>value>0),'Floor, seats and panes receive warm interior light');
const shell=wheel.cabins.find(cabin=>cabin.name==='Red gondola bodies').geometry;
for(let i=0;i<shell.attributes.position.count;i++){
  const y=shell.attributes.position.getY(i);
  if(y>-.135&&y<-.12)assert.equal(shell.attributes.harbourEmission.getX(i),0,'Roof edge cannot produce a thin shimmering light strip');
}
for(const seconds of [0,.5,7,22,59]){
  world.animate(seconds);
  assert.ok(time.wheelCabinFill.position.equals(fixedFill),'Red fill stays anchored to the footing during wheel rotation');
  wheel.cabins.forEach((cabin,i)=>assert.deepEqual(cabin.geometry.attributes.harbourEmission.array,cabinLight[i],
    'Cabin light output remains steady through rotation'));
  assert.equal(shader.uniforms.harbourNight.value,1,'Motion never flickers or pulses the night light');
}
console.log('Observation wheel: red night emission, 16 preserved cabins, eight paired spokes and upright motion passed.');
