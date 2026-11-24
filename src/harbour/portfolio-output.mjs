import { AddEquation, CustomBlending, OneFactor, SrcAlphaFactor, ZeroFactor } from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { linearBackdrop } from './portfolio-atmosphere.mjs';

// UnrealBloomPass normally adds both RGB and alpha. Keep the same RGB blend
// and retain multisample geometry coverage in alpha, including cached bloom.
export function preserveBloomCoverage(bloom) {
  Object.assign(bloom.blendMaterial, {
    blending: CustomBlending,
    blendEquation: AddEquation, blendSrc: SrcAlphaFactor, blendDst: OneFactor,
    blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
  });
}

// Compose the same linear background immediately before Three's original
// tone mapping and sRGB conversion. No additional fullscreen image is needed.
export function createPortfolioOutput() {
  const pass = new OutputPass();
  const sample = 'gl_FragColor = texture2D( tDiffuse, vUv );';
  if (!pass.material.fragmentShader.includes(sample)) throw new Error('Portfolio output shader changed');
  pass.uniforms.uBackground = {value: linearBackdrop('#000000', 1)};
  pass.material.fragmentShader = pass.material.fragmentShader
    .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\n uniform vec3 uBackground;')
    .replace(sample, `${sample}
      gl_FragColor.rgb += uBackground * (1. - gl_FragColor.a);
      gl_FragColor.a = 1.;`);
  pass.material.depthTest = false;
  pass.material.depthWrite = false;
  // Output is the last pass, rendered directly to the canvas. Do not swap the
  // beauty target with a second MSAA/depth target for the following frame.
  pass.needsSwap = false;
  return {pass, setBackground(cssColour, exposure) {
    pass.uniforms.uBackground.value.copy(linearBackdrop(cssColour, exposure));
  }};
}
