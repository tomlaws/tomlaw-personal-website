import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PropertyBinding,Raycaster,Vector3} from 'three';
import validator from 'gltf-validator';
import {createHKCEC} from '../src/harbour/hkcec.mjs';
import {HKCEC_DETAILS} from '../src/harbour/hkcec-detail-meshes.mjs';
import {prepareHKCECAccent} from '../src/harbour/hkcec-lighting.mjs';

const loader=new GLTFLoader();
async function load(path){const bytes=await readFile(path);return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}
const [before,base]=await Promise.all(['assets/blender/hkcec-before-detail.glb','assets/blender/hkcec-detail-base.glb'].map(load));
const after=createHKCEC();after.updateMatrixWorld(true);
let protectedCount=0;
for(const part of after.children.filter(part=>!HKCEC_DETAILS.some(detail=>detail.name===part.name))){
  const previous=base.getObjectByName(PropertyBinding.sanitizeNodeName(part.name));
  assert.ok(previous,`${part.name}: protected architectural part retained`);
  const a=part.geometry.index?part.geometry.toNonIndexed():part.geometry;
  const b=previous.geometry.index?previous.geometry.toNonIndexed():previous.geometry;
  for(const name of ['position','normal'])assert.deepEqual(a.attributes[name].array,b.attributes[name].array,`${part.name}: unchanged ${name}`);
  if(!part.name.endsWith('details')){
    const original=before.getObjectByName(PropertyBinding.sanitizeNodeName(part.name));
    const originalGeometry=original.geometry.index?original.geometry.toNonIndexed():original.geometry;
    assert.deepEqual(a.attributes.position.array,originalGeometry.attributes.position.array,`${part.name}: original roof/glass/podium shape`);
  }
  if(part.material.name==='hkcecRoof'||part.material.name==='hkcecTerrace'){
    previous.updateWorldMatrix(true,false);
    prepareHKCECAccent(part,part.material.name==='hkcecRoof'?'roof':'terrace');
    prepareHKCECAccent(previous,part.material.name==='hkcecRoof'?'roof':'terrace');
    assert.deepEqual(part.geometry.attributes.harbourEmission.array,previous.geometry.attributes.harbourEmission.array,'Original roof and terrace night lighting retained');
  }
  protectedCount++;
}
const layout=JSON.parse(await readFile('assets/blender/hkcec-detail-layout.json','utf8'));
const originalPosts=layout.facades.reduce((sum,run)=>sum+(run.uprights?Math.ceil(run.points.length/run.uprights):0),0);
const posts=HKCEC_DETAILS.filter(part=>part.role==='facade-mullion');
assert.equal(originalPosts,38);assert.equal(posts.length,23,'Fewer facade divisions at miniature scale');
assert.ok(posts.every(part=>part.width>=.07),'Posts remain readable on small screens');
assert.equal(HKCEC_DETAILS.filter(part=>part.role==='roof-coping').length,5,'Preserve the main curved edges without the fine ridge');
const roofs=after.children.filter(part=>part.material.name==='hkcecRoof');
const roofRay=new Raycaster(new Vector3(),new Vector3(0,1,0));
let fittedHeadSamples=0;
for(const part of HKCEC_DETAILS){
  const edges=new Map(),p=part.position;
  const key=index=>p.slice(index*3,index*3+3).map(v=>Math.round(v*1e6)).join(',');
  for(let i=0;i<p.length/3;i+=3)for(const [a,b]of [[i,i+1],[i+1,i+2],[i+2,i]]){
    const edge=[key(a),key(b)].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
  }
  assert.ok([...edges.values()].every(count=>count===2),`${part.name}: closed profile and end caps`);
  if(part.role==='facade-mullion'){
    const ys=p.filter((_,i)=>i%3===1),run=layout.facades[part.run];
    assert.ok(Math.abs(Math.min(...ys)-run.base)<1e-6,'Posts contact their original floor');
    assert.ok(Math.max(...ys)<=Math.max(...run.tops)+1e-6,'Posts remain below their original canopy profile');
  }
  if(['facade-mullion','foyer-support','floor-transom'].includes(part.role)){
    // Test the complete width/depth of every head, including overlapping side
    // canopies. A global maximum-height check missed supports through a wing.
    for(let i=0;i<p.length;i+=9){
      const a=new Vector3(...p.slice(i,i+3)),b=new Vector3(...p.slice(i+3,i+6)),c=new Vector3(...p.slice(i+6,i+9));
      if(b.clone().sub(a).cross(c.clone().sub(a)).y<=1e-8)continue;
      for(let u=0;u<=6;u++)for(let v=0;v<=6-u;v++){
        const point=a.clone().multiplyScalar(1-(u+v)/6).addScaledVector(b,u/6).addScaledVector(c,v/6);
        roofRay.ray.origin.set(point.x,.095,point.z);
        const hit=roofRay.intersectObjects(roofs,false)[0];
        if(part.role==='foyer-support')assert.ok(hit,'Support head stays beneath a canopy across its full footprint');
        if(!hit)continue;
        assert.ok(point.y<=hit.point.y-.001,`${part.name}: no head protrudes through the lowest overlapping roof at ${point.toArray()}`);
        fittedHeadSamples++;
      }
    }
  }
}
assert.ok(fittedHeadSamples>500,'Verify frame heads at densely sampled points');
const report=await validator.validateBytes(new Uint8Array(await readFile('assets/blender/hkcec-details.glb')));
assert.equal(report.issues.numErrors,0,'Blender detail GLB validates');
console.log(`HKCEC: ${protectedCount} protected roof/glass/podium/interior parts unchanged; 38 facade posts reduced to 23 broader posts, closed fitted details and night lighting passed.`);
