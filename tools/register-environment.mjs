import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { gzipSync,gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { decodeEnvironmentData } from '../src/harbour/environment-data.mjs';

if(!process.argv[2])throw new Error('Pass the file downloaded from /tools/bake-environment.html');
const raw=gunzipSync(await readFile(process.argv[2]));
decodeEnvironmentData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const compressed=gzipSync(raw,{level:9});
const file=`harbour-environment-${createHash('sha256').update(compressed).digest('hex').slice(0,12)}.bin.gz`;
await mkdir(new URL('../public/lighting/',import.meta.url),{recursive:true});
await writeFile(new URL(`../public/lighting/${file}`,import.meta.url),compressed);
await writeFile(new URL('../src/harbour/environment-asset.json',import.meta.url),JSON.stringify({file,sha256:createHash('sha256').update(raw).digest('hex')},null,2)+'\n');
console.log(`Registered ${file}: original half-float reflection data, losslessly compressed.`);
