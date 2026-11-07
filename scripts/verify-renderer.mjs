import assert from 'node:assert/strict';
import { Color, ShaderChunk, Vector2, WebGLRenderTarget } from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HarborBloom, createBloomOutput } from '../src/HarborBloom.js';
import { areaLightChunk } from '../src/areaLightShader.js';

assert.match(ShaderChunk.lights_physical_pars_fragment,/dot\( lightNormal, P - rectCoords\[ 0 \] \) < 0.0/,
  'Review the optimization if Three changes its LTC rejection rule');
assert(areaLightChunk.includes('position - rectCoords[ 0 ] ) < 0.0 ) return;'));
assert(areaLightChunk.indexOf('vec3 areaV1')<areaLightChunk.indexOf('vec2 uv = LTC_Uv'));

const bloom=new HarborBloom(),reference=new UnrealBloomPass(new Vector2(1,1),.24,.65,1.2);
const output=createBloomOutput(bloom),sceneBuffer=new WebGLRenderTarget(1216,1234,{samples:4});
bloom.setSize(1216,1234);reference.setSize(1216,1234);
assert.equal(sceneBuffer.samples,4);
assert.equal(bloom.nMips,reference.nMips,'Retain every blur level');
for(let i=0;i<bloom.nMips;i++){
  assert.equal(bloom.renderTargetsHorizontal[i].width,reference.renderTargetsHorizontal[i].width);
  assert.equal(bloom.renderTargetsVertical[i].height,reference.renderTargetsVertical[i].height);
  assert.deepEqual(bloom.separableBlurMaterials[i].uniforms.gaussianCoefficients.value,
    reference.separableBlurMaterials[i].uniforms.gaussianCoefficients.value,'Retain the complete blur kernels');
}
assert.equal(output.needsSwap,false,'Screen output must not allocate a second multisampled scene');
assert.match(output.material.fragmentShader,/bloom\.rgb \* bloom\.a/,'Preserve SRC_ALPHA, ONE additive light intensity');
assert(output.material.fragmentShader.indexOf('bloom.rgb * bloom.a')<output.material.fragmentShader.indexOf('// tone mapping'));

// Exercise the actual passes against a recording renderer. The optimized bloom
// must never write into the multisampled scene or leave renderer state changed.
const calls=[],savedTarget={name:'previous'},clear=new Color('#123456');let target=savedTarget,alpha=.7;
const renderer={
  autoClear:true,getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},
  getClearColor:out=>out.copy(clear),getClearAlpha:()=>alpha,
  setClearColor:(c,a)=>{clear.set(c);alpha=a;},
  render:mesh=>{calls.push({target,material:mesh.material});},
};
bloom.render(renderer,null,sceneBuffer);
assert.equal(calls.length,12,'Only threshold, ten blur passes and the bloom composite');
assert(calls.every(c=>c.target!==sceneBuffer&&c.target.depthBuffer===false));
assert.equal(target,savedTarget);assert.equal(alpha,.7);assert.equal(clear.getHexString(),'123456');assert(renderer.autoClear);
assert.equal(output.uniforms.bloomTexture.value,calls.at(-1).target.texture);
renderer.render=()=>{throw Error('simulated context failure');};
assert.throws(()=>bloom.render(renderer,null,sceneBuffer),/simulated context failure/);
assert.equal(target,savedTarget);assert.equal(alpha,.7);assert.equal(clear.getHexString(),'123456');assert(renderer.autoClear);
bloom.dispose();reference.materialHighPassFilter.dispose();reference.dispose();output.dispose();sceneBuffer.dispose();
console.log('✓ Bloom retains its kernels, resolution and alpha-weighted light; skips the MSAA writeback; restores renderer state');
