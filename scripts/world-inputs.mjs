import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function worldSourceHash(){
  const files=['package-lock.json'];
  for(const directory of ['src/harbour','public/hk-models']){
    for(const name of (await readdir(directory)).sort())if(/\.(?:mjs|js|glb)$/.test(name))files.push(`${directory}/${name}`);
  }
  const hash=createHash('sha256');
  for(const path of files.sort()){hash.update(path);hash.update(await readFile(path));}
  return hash.digest('hex');
}
