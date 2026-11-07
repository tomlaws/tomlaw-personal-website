import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createWorld} from '../src/harbour/coastal-world.mjs';

export async function buildOriginalWorld(){
  const source=await readFile('src/harbour/building-models.mjs','utf8'),models={},loader=new GLTFLoader();
  for(const [,name,url] of source.matchAll(/'([^']+)': import.meta.env.BASE_URL \+ '([^']+)'/g)){
    const bytes=await readFile(`public/${url}`);
    models[name]=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  }
  return createWorld({models});
}
