import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Color,Scene,OrthographicCamera,Mesh,BoxGeometry,MeshStandardMaterial,
  NeutralToneMapping,SRGBColorSpace,Vector2,DataUtils} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {HarbourBloom,createHarbourPostProcessing} from '../src/harbour/webgl-post.mjs';
import {compactPointLightLoops} from '../src/harbour/point-light-loop.mjs';
import {loadWebGLEnvironments,webGLCubeUV} from '../src/harbour/webgl-environment.mjs';
import {readEnvironmentResponse} from '../src/harbour/environment-data.mjs';
import {linearBackdrop} from '../src/harbour/portfolio-atmosphere.mjs';

const calls=[],previous={name:'previous'},clear=new Color('#123456');
let target=previous,alpha=.7;
const renderer={autoClear:true,toneMapping:NeutralToneMapping,outputColorSpace:SRGBColorSpace,toneMappingExposure:.9,
  getPixelRatio:()=>2,getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},
  getClearColor:out=>out.copy(clear),getClearAlpha:()=>alpha,
  setClearColor:(value,a)=>{clear.set(value);alpha=a;},clear(){},
  render(object){calls.push({target,material:object.material,object});},
};
const bloom=new HarbourBloom(new Vector2(1,1),.62,.62,.72);
const reference=new UnrealBloomPass(new Vector2(1,1),.62,.62,.72);
for(let i=0;i<5;i++) assert.deepEqual(bloom.separableBlurMaterials[i].uniforms.gaussianCoefficients.value,
  reference.separableBlurMaterials[i].uniforms.gaussianCoefficients.value,'Preserve all original bloom kernels');
reference.materialHighPassFilter.dispose();reference.dispose();
const scene=new Scene(),camera=new OrthographicCamera(),background=new Color('#abcdef');scene.background=background;
const post=createHarbourPostProcessing(renderer,scene,camera,{bloom,bloomInterval:()=>1000/15});
post.setSize(390,680);
assert.equal(post.target.width,780);assert.equal(post.target.height,1360);
assert.equal(post.target.samples,2,'Sharp scene keeps multisample antialiasing');
assert.equal(post.target.depthTexture,null,'Do not allocate an unused sampleable depth attachment');
post.setBackground('#123456',.9);
assert.ok(post.output.uniforms.harbourBackground.value.equals(linearBackdrop('#123456',.9)));
const shader=post.output.material.fragmentShader;
assert.match(shader,/glow\.rgb \* glow\.a/,'Preserve alpha-weighted additive glow');
assert.match(shader,/1\. - beauty\.a/,'Use the original scene coverage directly');
assert.ok(shader.indexOf('beauty.rgb + glow.rgb')<shader.indexOf('// tone mapping'),'Composite in linear HDR before output');
post.render(0);
assert.equal(calls.length,14,'One scene, twelve bloom draws and one final output');
assert.equal(calls.filter(call=>call.target===post.target).length,1,'Bloom never writes into the scene MSAA buffer');
assert.ok(calls.filter(call=>call.target!==post.target&&call.target!==null).every(call=>call.target.depthBuffer===false));
calls.length=0;post.render(33);
assert.equal(calls.length,2,'Cached glow leaves only live scene and output draws');
assert.equal(calls[0].object,scene,'Cache reuse still redraws the moving city');
calls.length=0;post.render(70);assert.equal(calls.length,14,'Moving lights retain periodic glow refresh');
calls.length=0;post.invalidate();post.render(71);assert.equal(calls.length,14,'Camera and lighting changes refresh immediately');
assert.equal(target,previous);assert.equal(alpha,.7);assert.equal(clear.getHexString(),'123456');
assert.equal(scene.background,background);assert.equal(renderer.autoClear,true);
renderer.render=()=>{throw Error('Simulated draw failure');};
assert.throws(()=>post.render(150),/Simulated draw failure/);
assert.equal(target,previous);assert.equal(alpha,.7);assert.equal(clear.getHexString(),'123456');
assert.equal(scene.background,background);assert.equal(renderer.autoClear,true);post.dispose();

const material=new MeshStandardMaterial();
material.onBeforeCompile=shader=>{shader.fragmentShader='// original glazing hook\n'+shader.fragmentShader;};
material.customProgramCacheKey=()=> 'original-glazing';
const root=new Scene(),mesh=new Mesh(new BoxGeometry(),material);root.add(mesh);
const before=mesh.geometry.attributes.position.array.slice();
assert.equal(compactPointLightLoops(root),1);
const pointLights={value:Array(26).fill({})};
const program={uniforms:{pointLights},fragmentShader:'#include <lights_fragment_begin>'};
material.onBeforeCompile(program,{});
assert.equal(program.uniforms.harbourPointLightCount.value,26);
pointLights.value=[];assert.equal(program.uniforms.harbourPointLightCount.value,0,'Read the actual uploaded light count without recompiling');
assert.match(program.fragmentShader,/original glazing hook/);
assert.match(program.fragmentShader,/i < harbourPointLightCount/);
assert.match(program.fragmentShader,/if \( directLight.visible \) RE_Direct/);
assert.match(program.fragmentShader,/#if NUM_POINT_LIGHT_SHADOWS == 0/,'Point-shadow scenes retain the upstream unrolled path');
assert.equal(material.customProgramCacheKey(),'original-glazing-harbour-point-loop-v1');
assert.deepEqual(mesh.geometry.attributes.position.array,before);mesh.geometry.dispose();material.dispose();

const asset=JSON.parse(await readFile('src/harbour/environment-asset.json'));
const bytes=await readFile('public/lighting/'+asset.file);
const expected=await readEnvironmentResponse(new Response(bytes));
let downloads=0;
const textures=await loadWebGLEnvironments('https://assets.example/lighting',async(url,options)=>{
  downloads++;assert.ok(options.signal instanceof AbortSignal);return new Response(bytes);
});
assert.equal(downloads,1);
for(let i=0;i<2;i++){
  assert.equal(textures[i].image.width,expected[i].width);assert.equal(textures[i].image.height,expected[i].height);
  assert.deepEqual(webGLCubeUV({...expected[i],data:textures[i].image.data}),expected[i].data,
    'Orientation conversion is an exact reversible texel permutation');
  assert.equal(textures[i].mapping,expected[i].mapping);textures[i].dispose();
}
const zenithOffset=(128*textures[0].image.width+384)*4;
const zenith=Array.from(textures[0].image.data.slice(zenithOffset,zenithOffset+3),DataUtils.fromHalfFloat);
const skyColour=new Color('#3f8ed4');
assert.ok(zenith.every((value,i)=>Math.abs(value-skyColour.toArray()[i])<.002),
  'The WebGL +Y face reflects the blue sky, preserving the prepared environment orientation');
await assert.rejects(loadWebGLEnvironments('https://assets.example/lighting',async()=>new Response('',{status:503})),/503/);
console.log('WebGL: sharp single scene buffer, cached bloom without MSAA writeback, fused HDR output, compact exact lighting and original prepared sky passed.');
