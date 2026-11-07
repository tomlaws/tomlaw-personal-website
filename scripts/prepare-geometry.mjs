import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createWorld} from '../src/harbour/coastal-world.mjs';
import {geometrySignature,encodeGeometryMaps} from '../src/harbour/prepared-geometry.mjs';

const catalog=await readFile('src/harbour/building-models.mjs','utf8');
const models={},loader=new GLTFLoader();
for(const [,name,url] of catalog.matchAll(/'([^']+)': import.meta.env.BASE_URL \+ '([^']+)'/g)){
  const bytes=await readFile(`public/${url}`);
  models[name]=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const world=createWorld({models}),meshes=[];
world.root.getObjectByName('Coastal static batches').traverse(mesh=>{if(mesh.isMesh&&!mesh.geometry.index)meshes.push(mesh);});
const entries=[];
for(const mesh of meshes){
  const original=mesh.geometry,indexed=mergeVertices(original,1e-6);
  const index=new Uint32Array(indexed.index.array),sources=new Uint32Array(indexed.attributes.position.count).fill(0xffffffff);
  for(let i=0;i<index.length;i++)if(sources[index[i]]===0xffffffff)sources[index[i]]=i;
  entries.push({signature:await geometrySignature(original),index,sources});indexed.dispose();
}
const raw=encodeGeometryMaps(entries),sha256=createHash('sha256').update(new Uint8Array(raw)).digest('hex');
const file=`harbour-geometry-${sha256.slice(0,12)}.bin.gz`,compressed=gzipSync(new Uint8Array(raw),{level:9});
await mkdir('public/geometry',{recursive:true});await writeFile(`public/geometry/${file}`,compressed);
await writeFile('src/harbour/geometry-asset.json',JSON.stringify({file,sha256},null,2)+'\n');
console.log(JSON.stringify({file,bytes:compressed.length,batches:entries.length,vertices:entries.reduce((sum,entry)=>sum+entry.sources.length,0)}));
