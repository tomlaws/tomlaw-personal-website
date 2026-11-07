import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Scene} from 'three';
import validator from 'gltf-validator';
import {buildOriginalWorld} from './build-world.mjs';
import {createCoastalLighting} from '../src/harbour/coastal-world.mjs';
import {createHarbourTime} from '../src/harbour/harbour-time.mjs';

const bytes=await readFile('public/hk-models/two-ifc.glb');
const report=await validator.validateBytes(new Uint8Array(bytes));
assert.equal(report.issues.numErrors,0,'IFC remains a valid GLB');
const loader=new GLTFLoader();
async function load(path){
  const bytes=await readFile(path);
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const [before,after]=await Promise.all(['assets/blender/ifc-before-crown.glb','public/hk-models/two-ifc.glb'].map(load));
const parts=scene=>{const list=[];scene.traverse(node=>{if(node.isMesh)list.push(node);});return list;};
const oldBody=parts(before).filter(mesh=>!mesh.name.startsWith('IFC_open_crown_fin'));
const body=parts(after).filter(mesh=>!mesh.name.startsWith('IFC_compact_crown_fin'));
assert.equal(oldBody.length,252);assert.equal(body.length,oldBody.length);
for(let i=0;i<body.length;i++){
  const [a,b]=[body[i],oldBody[i]];
  assert.equal(a.name,b.name,'All non-crown parts retained');
  assert.deepEqual(a.matrix.elements,b.matrix.elements,`${a.name}: original placement`);
  assert.deepEqual(a.geometry.index.array,b.geometry.index.array,`${a.name}: original triangles`);
  for(const [name,attribute] of Object.entries(b.geometry.attributes))
    assert.deepEqual(a.geometry.attributes[name].array,attribute.array,`${a.name}: unchanged ${name}`);
  assert.equal(a.material.name,b.material.name,`${a.name}: unchanged finish`);
}
const fins=parts(after).filter(mesh=>mesh.name.startsWith('IFC_compact_crown_fin'));
assert.equal(fins.length,16,'Four fingers per face');
for(const fin of fins){
  const box=new Box3().setFromObject(fin);
  assert.ok(Math.abs(box.min.y-13.72)<1e-5,'Fins stay connected to the existing roof');
  assert.ok(box.max.y<=14.90&&box.max.y>=14.70,'Shorter crown silhouette');
  const positions=fin.geometry.attributes.position;
  const face=Number(fin.name.match(/fin_(\d)-/)[1]);
  const tips=[];
  for(let i=0;i<positions.count;i++)if(Math.abs(positions.getY(i)-box.max.y)<1e-5)
    tips.push(Math.abs(face<2?positions.getX(i):positions.getZ(i)));
  assert.ok(Math.abs((Math.min(...tips)+Math.max(...tips))/2-.58)<1e-5,'Tips curl inward while leaving the centre open');
}
const world=await buildOriginalWorld(),scene=new Scene();scene.add(world.root);
const time=createHarbourTime(scene,world,createCoastalLighting(scene,world));
const lit=[];world.root.traverse(mesh=>{if(mesh.isMesh&&mesh.material===world.materials.ifcCrown)lit.push(mesh);});
assert.equal(lit.length,1,'Crown remains one shared static draw batch');
const emission=lit[0].geometry.attributes.harbourEmission.array;
assert.ok(emission.every(Number.isFinite));assert.ok(Math.min(...emission)>.20);assert.ok(Math.max(...emission)<1);
const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <emissivemap_fragment>'};
lit[0].material.onBeforeCompile(shader);
time.set(0);assert.equal(shader.uniforms.harbourNight.value,0,'Crown lighting off by day');
time.set(1);assert.equal(shader.uniforms.harbourNight.value,1,'Crown floodlighting on at night');
console.log('IFC: 16 shorter fins, 252 unchanged body meshes, day/night crown lighting and GLB validation passed.');
