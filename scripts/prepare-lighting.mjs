import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {decodeEnvironmentData} from '../src/harbour/environment-data.mjs';
import {orientWebGLLighting,encodePreparedLighting} from '../src/harbour/prepared-lighting.mjs';

const source=JSON.parse(await readFile('src/harbour/environment-asset.json','utf8'));
const original=gunzipSync(await readFile('public/lighting/'+source.file));
const sourceSha256=createHash('sha256').update(original).digest('hex');
if(sourceSha256!==source.sha256)throw new Error('Lighting source checksum mismatch');
const entries=decodeEnvironmentData(original.buffer.slice(original.byteOffset,original.byteOffset+original.byteLength));
const raw=encodePreparedLighting(entries.map(entry=>({...entry,data:orientWebGLLighting(entry)})));
const sha256=createHash('sha256').update(new Uint8Array(raw)).digest('hex');
const file=`harbour-webgl-${sha256.slice(0,12)}.bin.gz`,compressed=gzipSync(new Uint8Array(raw),{level:9});
const manifest='src/harbour/prepared-lighting-asset.json';
const previous=await readFile(manifest,'utf8').then(JSON.parse).catch(()=>null);
await mkdir('public/lighting',{recursive:true});await writeFile('public/lighting/'+file,compressed);
await writeFile(manifest,JSON.stringify({file,sha256,sourceSha256},null,2)+'\n');
if(previous?.file!==file&&/^harbour-webgl-[a-f0-9]{12}\.bin\.gz$/.test(previous?.file??''))
  await unlink('public/lighting/'+previous.file).catch(()=>{});
console.log(JSON.stringify({lighting:file,bytes:compressed.length,sourceSha256}));
