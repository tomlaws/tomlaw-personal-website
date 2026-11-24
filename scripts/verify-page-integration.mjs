import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
async function sources(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.map(entry=>entry.isDirectory()?sources(`${directory}/${entry.name}`):/\.(?:html|jsx?|mjs)$/.test(entry.name)?[`${directory}/${entry.name}`]:[]))).flat();
}
const forbidden=[/<\s*(?:iframe|frame|frameset|object|embed)\b/i,/createElement\(\s*['"](?:iframe|frame|frameset|object|embed)['"]/i,/\bcontentWindow\b/,/\bparent\s*\.\s*postMessage\b/,/harbour:(?:state|command)/];
for(const path of [...await sources('src'),...await sources('public'),'index.html','harbour/index.html']){
  const code=await readFile(path,'utf8');
  for(const rule of forbidden)assert.doesNotMatch(code,rule,`${path}: site-owned rendering must stay in the current document, including recovery paths`);
}
console.log('Page integration: no embedded documents or cross-window city control paths in application source/HTML.');
