import * as T from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Keep the page backdrop in sync without changing the solid map silhouette.
export function createPortfolioAtmosphere(contactShadows) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: contactShadows.depthTexture },
      uBackground: { value: new T.Color() },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse, tDepth;
      uniform vec3 uBackground;
      varying vec2 vUv;
      void main() {
        vec3 colour = texture2D(tDiffuse, vUv).rgb;
        float depth = texture2D(tDepth, vUv).r;
        if (depth < .99999) {
          gl_FragColor = vec4(colour, 1.);
        } else {
          // The scene is rendered over black. Keep bloom outside silhouettes,
          // adding its soft light to the site's exact time-of-day colour.
          gl_FragColor = vec4(uBackground + colour, 1.);
        }
      }
    `,
  });
  // ShaderPass clones its declaration; these resources must stay live as the
  // camera moves and the contact pass refreshes its existing depth attachment.
  pass.uniforms.tDepth.value = contactShadows.depthTexture;
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
