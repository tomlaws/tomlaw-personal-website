import { ShaderChunk } from 'three';

// Preserve Three's point-light attenuation and PBR equations. A uniform-bound
// loop avoids expanding the whole BRDF once per lamp; zero-contribution lamps
// skip that work. Keep Three's unrolled path when point-light shadows are used.
const source = ShaderChunk.lights_fragment_begin;
const start = source.indexOf('\t#pragma unroll_loop_start');
const end = source.indexOf('\t#pragma unroll_loop_end',start)+'\t#pragma unroll_loop_end'.length;
const original = source.slice(start,end);
if (!original.includes('getPointLightInfo') || !original.includes('RE_Direct')) {
  throw new Error('Review the harbour lighting loop for this Three.js version');
}
const compact = original
  .replace(/\s*#pragma unroll_loop_(?:start|end)/g,'')
  .replace('i < NUM_POINT_LIGHTS','i < harbourPointLightCount')
  .replace('RE_Direct( directLight,', 'if ( directLight.visible ) RE_Direct( directLight,');
const lights = source.slice(0,start)+
  `\n#if NUM_POINT_LIGHT_SHADOWS == 0\n${compact}\n#else\n${original}\n#endif\n`+source.slice(end);

export function compactPointLightLoops(root) {
  const materials=new Set();
  root.traverse(object => {
    if (object.isMesh) for (const material of Array.isArray(object.material)?object.material:[object.material]) {
      if (material.isMeshStandardMaterial) materials.add(material);
    }
  });
  for (const material of materials) {
    const previous=material.onBeforeCompile, key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,renderer) {
      previous.call(this,shader,renderer);
      shader.uniforms.harbourPointLightCount={
        get value() { return shader.uniforms.pointLights?.value?.length ?? 0; },
      };
      shader.fragmentShader='uniform int harbourPointLightCount;\n'+shader.fragmentShader
        .replace('#include <lights_fragment_begin>',lights);
    };
    material.customProgramCacheKey=() => key+'-harbour-point-loop-v1';
    material.needsUpdate=true;
  }
  return materials.size;
}
