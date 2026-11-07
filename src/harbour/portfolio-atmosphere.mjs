import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Keep the page backdrop in sync without changing the solid map silhouette.
export function createPortfolioAtmosphere() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tCoverage: { value: null },
      uBackground: { value: new T.Color() },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse, tCoverage;
      uniform vec3 uBackground;
      varying vec2 vUv;
      void main() {
        vec3 colour = texture2D(tDiffuse, vUv).rgb;
        // Beauty alpha records multisample coverage at the silhouette. Blend the
        // matching page background into uncovered samples, retaining bloom.
        float coverage = texture2D(tCoverage, vUv).a;
        gl_FragColor = vec4(colour + uBackground * (1. - coverage), 1.);
      }
    `,
  });
  pass.material.toneMapped = false;
  pass.material.depthTest = false;
  pass.material.depthWrite = false;
  return {
    pass,
    setBackground(cssColour) {
      // This pass follows OutputPass, so its uniform is in display colour space.
      pass.uniforms.uBackground.value.set(cssColour).convertLinearToSRGB();
    },
  };
}
