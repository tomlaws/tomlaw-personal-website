import { Color, HalfFloatType, WebGLRenderTarget } from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { linearBackdrop } from './portfolio-atmosphere.mjs';

// Retain Unreal's five mip levels and kernels, but leave its result offscreen.
// The final output samples it directly; no additive writeback into MSAA colour.
export class HarbourBloom extends UnrealBloomPass {
  constructor(...args) {
    super(...args);
    this.lastUpdate = -Infinity;
    for (const target of [this.renderTargetBright, ...this.renderTargetsHorizontal, ...this.renderTargetsVertical]) {
      target.depthBuffer = false;
    }
  }
  invalidate() { this.lastUpdate = -Infinity; }
  setSize(width, height) { super.setSize(width, height); this.invalidate(); }
  update(renderer, input, timestamp, interval) {
    const settings = `${this.strength}/${this.radius}/${this.threshold}`;
    if (timestamp-this.lastUpdate < interval && settings === this.lastSettings) return false;
    const previous = renderer.getRenderTarget(), autoClear = renderer.autoClear;
    const clear = renderer.getClearColor(new Color()), alpha = renderer.getClearAlpha();
    const draw = (material, target) => {
      this._fsQuad.material = material;
      renderer.setRenderTarget(target); renderer.clear(); this._fsQuad.render(renderer);
    };
    try {
      renderer.autoClear = false; renderer.setClearColor(0, 0);
      this.highPassUniforms.tDiffuse.value = input.texture;
      this.highPassUniforms.luminosityThreshold.value = this.threshold;
      draw(this.materialHighPassFilter, this.renderTargetBright);
      let source = this.renderTargetBright;
      for (let i=0;i<this.nMips;i++) {
        const material = this.separableBlurMaterials[i];
        material.uniforms.colorTexture.value = source.texture;
        material.uniforms.direction.value = UnrealBloomPass.BlurDirectionX;
        draw(material, this.renderTargetsHorizontal[i]);
        material.uniforms.colorTexture.value = this.renderTargetsHorizontal[i].texture;
        material.uniforms.direction.value = UnrealBloomPass.BlurDirectionY;
        draw(material, this.renderTargetsVertical[i]);
        source = this.renderTargetsVertical[i];
      }
      this.compositeMaterial.uniforms.bloomStrength.value = this.strength;
      this.compositeMaterial.uniforms.bloomRadius.value = this.radius;
      this.compositeMaterial.uniforms.bloomTintColors.value = this.bloomTintColors;
      draw(this.compositeMaterial, this.renderTargetsHorizontal[0]);
      this.lastUpdate = timestamp; this.lastSettings = settings;
      return true;
    } finally {
      renderer.setRenderTarget(previous); renderer.setClearColor(clear,alpha); renderer.autoClear = autoClear;
    }
  }
  dispose() { this.materialHighPassFilter.dispose(); super.dispose(); }
}

// One sharp scene target and one final output. Beauty alpha already contains
// silhouette coverage, so there is no coverage copy or second MSAA scene target.
export function createHarbourPostProcessing(renderer, scene, camera, {bloom, bloomInterval = () => 0}) {
  const target = new WebGLRenderTarget(1,1,{type:HalfFloatType,samples:2});
  const output = new OutputPass(); output.renderToScreen = true;
  output.material.depthTest = false; output.material.depthWrite = false;
  output.uniforms.harbourBloom = {value:bloom.renderTargetsHorizontal[0].texture};
  output.uniforms.harbourBackground = {value:new Color()};
  output.material.fragmentShader = output.material.fragmentShader
    .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\nuniform sampler2D harbourBloom;\nuniform vec3 harbourBackground;')
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', `
      vec4 beauty = texture2D(tDiffuse, vUv);
      vec4 glow = texture2D(harbourBloom, vUv);
      gl_FragColor = vec4(beauty.rgb + glow.rgb * glow.a + harbourBackground * (1. - beauty.a), 1.);
    `);
  let ratio = renderer.getPixelRatio(), width = 1, height = 1;
  function resize() {
    const w=Math.max(1,Math.floor(width*ratio)),h=Math.max(1,Math.floor(height*ratio));
    if (target.width===w && target.height===h) return;
    target.setSize(w,h); bloom.setSize(w,h);
  }
  return {
    target, output,
    setPixelRatio(value) { ratio=value; resize(); },
    setSize(w,h) { width=w; height=h; resize(); },
    setBackground(css, exposure) {
      output.uniforms.harbourBackground.value.copy(linearBackdrop(css,exposure)); bloom.invalidate();
    },
    invalidate() { bloom.invalidate(); },
    render(timestamp = performance.now()) {
      const previous=renderer.getRenderTarget(), background=scene.background;
      const clear=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
      try {
        scene.background=null; renderer.autoClear=true;
        renderer.setClearColor(0,0); renderer.setRenderTarget(target); renderer.render(scene,camera);
        bloom.update(renderer,target,timestamp,bloomInterval());
        output.render(renderer,null,target);
      } finally {
        scene.background=background; renderer.setClearColor(clear,alpha); renderer.autoClear=autoClear;
        renderer.setRenderTarget(previous);
      }
    },
    dispose() { target.dispose(); output.dispose(); bloom.dispose(); },
  };
}
