import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {createWorld} from '../src/harbour/coastal-world.mjs';
import {geometrySignature,decodeGeometryMaps,applyGeometryMap,readGeometryMaps} from '../src/harbour/prepared-geometry.mjs';

const asset=JSON.parse(await readFile('src/harbour/geometry-asset.json','utf8'));
const gzip=await readFile(`public/geometry/${asset.file}`),raw=gunzipSync(gzip);
assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256);
const entries=await readGeometryMaps(new Response(gzip));
assert.deepEqual(await readGeometryMaps(new Response(raw)),entries,'HTTP-decoded and raw gzip work equally');
assert.throws(()=>decodeGeometryMaps(new ArrayBuffer(4)));
const maps=new Map(entries.map(entry=>[entry.signature,entry]));
const catalog=await readFile('src/harbour/building-models.mjs','utf8'),models={},loader=new GLTFLoader();
for(const [,name,url] of catalog.matchAll(/'([^']+)': import.meta.env.BASE_URL \+ '([^']+)'/g)){
  const bytes=await readFile(`public/${url}`);
  models[name]=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const world=createWorld({models}),meshes=[];
world.root.getObjectByName('Coastal static batches').traverse(mesh=>{if(mesh.isMesh&&!mesh.geometry.index)meshes.push(mesh);});
let vertices=0;
for(const mesh of meshes){
  const original=mesh.geometry,signature=await geometrySignature(original),entry=maps.get(signature);
  assert.ok(entry,`Current ${mesh.material.name} geometry has a prepared map`);
  const expected=mergeVertices(original,1e-6),actual=applyGeometryMap(original,entry);
  assert.deepEqual(actual.index.array,expected.index.array,'Same triangle indices');
  for(const [name,attribute] of Object.entries(expected.attributes))assert.deepEqual(actual.attributes[name].array,attribute.array,`${name} is bit-for-bit identical to runtime welding`);
  vertices+=actual.attributes.position.count;actual.dispose();expected.dispose();
}
assert.equal(meshes.length,entries.length);assert.equal(vertices,219237);
console.log(`Prepared geometry: all ${meshes.length} batches and ${vertices} vertices match original runtime indexing, including every lighting attribute.`);
