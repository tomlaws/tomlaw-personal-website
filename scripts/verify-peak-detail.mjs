import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPeakTower,preparePeakLighting} from '../src/harbour/peak-tower.mjs';
import {PEAK_DETAILS} from '../src/harbour/peak-detail-meshes.mjs';
import {PEAK_BOWL} from '../src/harbour/peak-bowl-mesh.mjs';
import {Raycaster,Vector3,Box3} from 'three';
import validator from 'gltf-validator';

const bytes=await readFile('assets/blender/peak-before-simplification.glb');
const before=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const after=createPeakTower(),meshes=root=>{const all=[];root.traverse(o=>{if(o.isMesh)all.push(o);});return all;};
const changed=['Peak recessed louvre backing','Peak fine horizontal louvre','Peak louvre horizontal frame',
  'Peak louvre vertical frame','Peak louvre end return','Peak louvre end slat','Peak roof terrace handrail',
  'Peak roof terrace end handrail','Peak terrace railing post','Peak pier granite stripe',
  'Peak crescent aluminium fascias','Peak crescent shaded soffit',PEAK_BOWL.name,...PEAK_DETAILS.map(p=>p.name)];
const clean=name=>name.replaceAll('_',' ').replace(/(?:\.\d+| \d+)$/,'');
const protectedParts=root=>meshes(root).filter(m=>!changed.includes(clean(m.name)));
const [oldParts,newParts]=[protectedParts(before),protectedParts(after)];
assert.equal(oldParts.length,newParts.length,'Retain all untouched Peak architecture');
for(let i=0;i<oldParts.length;i++){
  const [a,b]=[oldParts[i],newParts[i]];
  assert.equal(clean(a.name),clean(b.name));
  const ag=a.geometry.index?a.geometry.toNonIndexed():a.geometry,bg=b.geometry.index?b.geometry.toNonIndexed():b.geometry;
  assert.deepEqual(ag.attributes.position.array,bg.attributes.position.array,`${b.name}: original silhouette, glazing and lighting geometry`);
}
assert.equal(PEAK_DETAILS.filter(p=>p.name==='Peak broad horizontal louvre').length,12,'Six substantial blades on each elevation');
assert.equal(PEAK_DETAILS.filter(p=>p.name==='Peak terrace railing post').length,8,'Four thicker posts per front/rear railing');
assert.ok(!meshes(after).some(m=>/fine horizontal louvre|pier granite stripe/.test(m.name)),'No leftover fine grille or dense pier stripes');
after.updateMatrixWorld(true);
for(const backing of meshes(after).filter(m=>m.name==='Peak recessed louvre backing')){
  preparePeakLighting(backing);
  assert.ok(backing.geometry.attributes.harbourEmission.array.some(v=>v>1),'Warm upper lighting retained');
}
assert.ok(meshes(after).some(m=>m.name==='Peak Sky Terrace concealed edge lighting'),'Retain rooftop lighting');
const bowl=meshes(after).find(mesh=>mesh.name===PEAK_BOWL.name);
assert.ok(bowl,'Use the complete Blender-authored bowl shell');
const edges=new Map(),key=(position,i)=>[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
const position=bowl.geometry.attributes.position;
for(let i=0;i<position.count;i+=3)for(const [a,b]of [[i,i+1],[i+1,i+2],[i+2,i]]){
  const edge=[key(position,a),key(position,b)].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
}
assert.ok([...edges.values()].every(count=>count===2),'Every bowl edge is closed, including both end cheeks and their undersides');
for(const x of [-1.4,1.4])for(const side of [-1,1]){
  const ray=new Raycaster(new Vector3(x,2.45,side*3),new Vector3(0,0,-side));
  const hit=ray.intersectObject(bowl)[0];
  assert.ok(hit,'Both front and rear end panels close the former gaps beside the grille');
  assert.ok(Math.abs(hit.point.z-side*.87)<1e-6,'End cheeks close to the original outer fascia depth');
}
assert.equal(new Raycaster(new Vector3(0,2.1,3),new Vector3(0,0,-1)).intersectObject(bowl).length,0,'Keep the central grille aperture open');
const bounds=new Box3().setFromObject(bowl);
const deckTop=new Box3().setFromObject(meshes(after).find(mesh=>mesh.name==='Peak Sky Terrace deck')).max.y;
assert.ok(Math.abs(bounds.min.y-1.31)<1e-6,'Keep the original lower bowl');
assert.ok(Math.abs(bounds.max.y-deckTop)<1e-6,'Both ends stop level with the terrace instead of turning upward');
for(const side of [-1,1])for(const x of [1.20,1.40,1.65])for(const z of [-.7,0,.7]){
  const hit=new Raycaster(new Vector3(side*x,4,z),new Vector3(0,-1,0)).intersectObject(bowl)[0];
  assert.ok(hit&&Math.abs(hit.point.y-deckTop)<1e-6,'Both end caps are flat across their full width and depth');
}
assert.ok(Math.abs(bounds.min.x+1.68)<1e-6&&Math.abs(bounds.max.x-1.68)<1e-6,'Keep the original width');
for(let i=0;i<=64;i++){
  const x=-1.68+i/64*3.36,y=1.31+1.11*Math.pow(Math.abs(x)/1.68,2.35);
  for(const side of [-1,1]){
    let found=false;
    for(let vertex=0;vertex<position.count;vertex++)if(Math.abs(position.getX(vertex)-x)<1e-6&&Math.abs(position.getY(vertex)-y)<1e-6&&Math.abs(position.getZ(vertex)-side*.87)<1e-6){found=true;break;}
    assert.ok(found,'Preserve every original lower-curve sample on both elevations');
  }
}
preparePeakLighting(Object.assign(bowl,{material:Object.assign(bowl.material,{name:'Peak Tower aluminium crescent'})}));
assert.ok(bowl.geometry.attributes.harbourEmission.array.some(value=>value>0),'Completed bowl keeps its existing night illumination');
const glb=await readFile('assets/blender/peak-bowl.glb');
const report=await validator.validateBytes(new Uint8Array(glb),{uri:'peak-bowl.glb'});
assert.equal(report.issues.numErrors,0,'Blender bowl GLB validates');
console.log(`Peak Tower: ${oldParts.length} untouched architecture parts preserved; closed bowl ends, simplified grille/rails and night lighting passed.`);
