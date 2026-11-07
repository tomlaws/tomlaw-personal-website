import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Match the page background after Three.js NeutralToneMapping and sRGB output.
// Inverting the tone curve lets antialiasing blend in linear light before output.
export function neutralToneMap(colour) {
  const x = Math.min(colour.r, colour.g, colour.b);
  const offset = x < .08 ? x - 6.25 * x * x : .04;
  const result = colour.clone().addScalar(-offset);
  const peak = Math.max(result.r, result.g, result.b);
  if (peak < .76) return result;
  const next = 1 - .24 * .24 / (peak + .24 - .76);
  const desaturation = 1 - 1 / (.15 * (peak - next) + 1);
  return result.multiplyScalar(next / peak).lerp(new T.Color(next, next, next), desaturation);
}

export function linearBackdrop(cssColour, exposure) {
  const target = new T.Color(cssColour);
  const guess = target.clone().addScalar(.04);
  for (let i = 0; i < 100; i++) {
    const mapped = neutralToneMap(guess);
    guess.r = Math.max(0, guess.r + .9 * (target.r - mapped.r));
    guess.g = Math.max(0, guess.g + .9 * (target.g - mapped.g));
    guess.b = Math.max(0, guess.b + .9 * (target.b - mapped.b));
  }
  return guess.multiplyScalar(1 / exposure);
}

// Composite the backdrop in linear light, before the output tone curve.
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
    setBackground(cssColour, exposure) {
      pass.uniforms.uBackground.value.copy(linearBackdrop(cssColour, exposure));
    },
  };
}
