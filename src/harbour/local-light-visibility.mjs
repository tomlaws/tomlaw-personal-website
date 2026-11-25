import { ShaderChunk } from 'three';

// Preserve Three's BRDF, light uniforms, shadows and existing material hooks.
// A light whose evaluated colour is exactly zero contributes nothing; skip
// its expensive physical shading outside its finite range or spotlight cone.
export function cullInvisibleLocalLighting(scene) {
  const source = ShaderChunk.lights_fragment_begin;
  const split = source.indexOf('#if ( NUM_DIR_LIGHTS');
  if (split < 0) throw new Error('Three light shader layout changed');
  const local = source.slice(0, split).replaceAll(
    'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
    'if ( directLight.visible ) { RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); }',
  );
  const chunk = local + source.slice(split), materials = new Set();
  scene.traverse(object => { if (object.isMesh) for (const material of Array.isArray(object.material)?object.material:[object.material]) {
    if (material.isMeshStandardMaterial) materials.add(material);
  }});
  for (const material of materials) {
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', chunk);
    };
    material.customProgramCacheKey = () => key + '|local-light-visibility-v1';
    material.needsUpdate = true;
  }
  return materials.size;
}
