import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWorld } from '../src/harbour/coastal-world.mjs';

const source=await readFile('src/harbour/building-models.mjs','utf8');
const models={},loader=new GLTFLoader();
for(const [,name,url] of source.matchAll(/'([^']+)': import.meta.env.BASE_URL \+ '([^']+)'/g)){
  const bytes=await readFile(`public/${url}`);
  models[name]=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength), '')).scene;
}
const started=performance.now(),world=createWorld({models});
console.log('World CPU ms:',Math.round(performance.now()-started));
const batches=[];
world.root.getObjectByName('Coastal static batches').traverse(mesh=>{
  if(!mesh.isMesh)return;
  const expanded=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
  const hash=createHash('sha256');
  for(const [name,attribute] of Object.entries(expanded.attributes).sort(([a],[b])=>a.localeCompare(b))){
    hash.update(name);hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
  }
  batches.push({material:mesh.material.name,vertices:mesh.geometry.attributes.position.count,triangles:expanded.attributes.position.count/3,hash:hash.digest('hex')});
  if(expanded!==mesh.geometry)expanded.dispose();
});
console.log(JSON.stringify(batches));
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(batches,null,2));
