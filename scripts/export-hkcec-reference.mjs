import {writeFile,access} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createHKCEC} from '../src/harbour/hkcec.mjs';

// Geometry-only Blender authoring input; no browser or external textures.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const exporter=new GLTFExporter();
async function save(root,path){
  root.updateMatrixWorld(true);
  const bytes=await exporter.parseAsync(root,{binary:true,onlyVisible:false});
  await writeFile(path,new Uint8Array(bytes));
}
const before='assets/blender/hkcec-before-detail.glb';
try{await access(before);}catch{await save(createHKCEC({legacyDetails:true}),before);}
const base=createHKCEC({legacyDetails:false,authoring:true});
const layout=base.userData.detailLayout;delete base.userData.detailLayout;
await writeFile('assets/blender/hkcec-detail-layout.json',JSON.stringify(layout,null,2)+'\n');
await save(base,'assets/blender/hkcec-detail-base.glb');
console.log(JSON.stringify({facades:layout.facades.length,roofEdges:layout.roofEdges.length,supports:layout.supports.length}));
