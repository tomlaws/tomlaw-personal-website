import * as T from 'three/webgpu';
import { Fn, texture, uniform, vec4, vec3, float, max, mix, exp, smoothstep, renderOutput } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { createTemporalSampler } from './webgpu-temporal-qa.mjs';
import { cacheViewPass } from './cached-view-pass.mjs';

export function createNodePostProcessing(renderer, scene, camera, {search = ''} = {}) {
  const post = new T.PostProcessing(renderer);
  // Sampleable depth is needed by GTAO and composition. Use a single-sample
  // G-buffer, then apply FXAA to the finished image instead of MSAA depth.
  const target = new T.RenderTarget(1, 1, { samples: 0, type: T.HalfFloatType });
  target.depthTexture = new T.DepthTexture();
  target.texture.name = 'output';
  const beauty = { renderTarget: target, dispose: () => target.dispose() };
  function beginBeauty() {
    renderer.getDrawingBufferSize(bufferSize);
    target.setSize(bufferSize.x, bufferSize.y);
    const previousTarget = renderer.getRenderTarget(), previousMRT = renderer.getMRT();
    const toneMapping = renderer.toneMapping, colourSpace = renderer.outputColorSpace;
    renderer.toneMapping = T.NoToneMapping; renderer.outputColorSpace = T.LinearSRGBColorSpace;
    renderer.setRenderTarget(target); renderer.setMRT(null);
    return () => {
      renderer.setRenderTarget(previousTarget); renderer.setMRT(previousMRT);
      renderer.toneMapping = toneMapping; renderer.outputColorSpace = colourSpace;
    };
  }
  const colour = texture(target.textures[0]), depth = texture(target.depthTexture);
  const occlusion = ao(depth, null, camera);
  occlusion.radius.value = .14; occlusion.thickness.value = .12;
  occlusion.distanceFallOff.value = 1; occlusion.scale.value = .65; occlusion.samples.value = 16;
  occlusion.resolutionScale = .75;
  const bufferSize = new T.Vector2();
  const softenedAO = denoise(occlusion.getTextureNode(), depth, null, camera);
  softenedAO.radius.value = 4; softenedAO.lumaPhi.value = 8;
  softenedAO.depthPhi.value = 2; softenedAO.normalPhi.value = 3;
  // Cache the complete AO + 16-tap bilateral denoise chain, not just raw AO.
  const invalidateAO = cacheViewPass(occlusion, renderer, camera, 100);
  const invalidateDenoise = cacheViewPass(softenedAO, renderer, camera, 100);
  const aoStrength = uniform(.25);
  const shaded = vec4(colour.rgb.mul(mix(float(1), softenedAO.r, aoStrength)), colour.a);
  const glow = bloom(shaded, .12, .62, 2.2);
  glow.smoothWidth.value = .20;
  const invalidateBloom = cacheViewPass(glow, renderer, camera, 1000 / 15);
  const originalBloomSetup = glow.setup.bind(glow);
  glow.setup = builder => {
    const result = originalBloomSetup(builder);
    // Match the existing max-channel threshold, soft knee and bounded HDR
    // highlights; the five bloom mip levels and all their blur kernels remain.
    glow._highPassFilterMaterial.fragmentNode = Fn(() => {
      const source = glow.inputNode;
      const peak = max(source.r, max(source.g, source.b));
      const bounded = float(3).sub(exp(peak.sub(2.5).div(-.5)).mul(.5));
      const gain = peak.greaterThan(2.5).select(bounded.div(max(peak, .0001)), float(1));
      const texel = vec4(source.rgb.mul(gain), source.a);
      const value = max(texel.r, max(texel.g, texel.b));
      const knee = glow.threshold.mul(mix(.75, 1, smoothstep(.70, 2.2, glow.threshold)));
      return mix(vec4(0), texel, smoothstep(knee, glow.threshold.add(glow.smoothWidth), value));
    })().context(builder.getSharedContext());
    glow._highPassFilterMaterial.needsUpdate = true;
    return result;
  };
  const background = uniform(new T.Color());
  // The classic additive blend weights bloom RGB by its alpha as well.
  const lit = vec4(shaded.rgb.add(glow.rgb.mul(glow.a)), 1);
  const output = renderOutput(lit, T.NeutralToneMapping, T.SRGBColorSpace);
  post.outputColorTransform = false;
  const composite = vec4(depth.lessThan(.99999).select(output.rgb, output.rgb.add(background)), 1);
  const antialiasing = fxaa(composite);
  const temporalSample = import.meta.env?.DEV && new URLSearchParams(search).has('qaTemporal')
    ? createTemporalSampler(renderer, () => [
      ['beauty', target], ['bloom', glow._renderTargetsHorizontal[0]],
      ['final', antialiasing.textureNode.renderTarget],
    ]) : undefined;
  // Full-strength FXAA softened the tiny window frames and facade linework.
  // Retain a light edge treatment while preserving the native-resolution image.
  post.outputNode = mix(composite, antialiasing, .35);
  if (import.meta.env?.DEV) {
    const stage = new URLSearchParams(search).get('gpuStage');
    if (stage === 'beauty') post.outputNode = renderOutput(colour, T.NeutralToneMapping, T.SRGBColorSpace);
    if (stage === 'shaded') post.outputNode = renderOutput(shaded, T.NeutralToneMapping, T.SRGBColorSpace);
    if (stage === 'ao') post.outputNode = vec4(vec3(softenedAO.r), 1);
    if (stage === 'glow') post.outputNode = renderOutput(vec4(glow.rgb, 1), T.NeutralToneMapping, T.SRGBColorSpace);
    if (stage === 'glowalpha') post.outputNode = vec4(vec3(glow.a), 1);
  }
  return {
    temporalSample,
    async compileScene(){
      const restore=beginBeauty();
      try{await renderer.compileAsync(scene,camera);}finally{restore();}
      invalidateAO();invalidateDenoise();invalidateBloom();
    },
    async compileEffects(){
      // Discover the real fullscreen passes without submitting a large burst of
      // synchronous driver compilations. Snapshot each reusable quad's material.
      const draw=renderer.render,originalTarget=renderer.getRenderTarget();
      const toneMapping=renderer.toneMapping,colourSpace=renderer.outputColorSpace;
      const depthEnabled=renderer.depth,stencilEnabled=renderer.stencil;
      const jobs=[],seen=new Map();
      renderer.render=(quad,camera)=>{
        if(!quad.isQuadMesh)return draw.call(renderer,quad,camera);
        const target=renderer.getRenderTarget();
        let targets=seen.get(quad.material);if(!targets)seen.set(quad.material,targets=new Set());
        if(targets.has(target))return;targets.add(target);
        jobs.push({quad:new T.QuadMesh(quad.material),camera,target});
      };
      try{
        post._update();
        renderer.toneMapping=T.NoToneMapping;renderer.outputColorSpace=T.LinearSRGBColorSpace;
        await renderer.compileAsync(post._quadMesh,post._quadMesh.camera);
        for(let index=0;index<jobs.length;index++){
          const {quad,camera,target}=jobs[index];renderer.setRenderTarget(target);
          renderer.depth=target?target.depthBuffer:depthEnabled;
          renderer.stencil=target?target.stencilBuffer:stencilEnabled;
          await renderer.compileAsync(quad,camera);
        }
      }finally{
        renderer.render=draw;renderer.setRenderTarget(originalTarget);
        renderer.depth=depthEnabled;renderer.stencil=stencilEnabled;
        renderer.toneMapping=toneMapping;renderer.outputColorSpace=colourSpace;
        invalidateAO();invalidateDenoise();invalidateBloom();
      }
    },
    render() {
      const restore = beginBeauty();
      try { renderer.render(scene, camera); } finally { restore(); }
      post.render();
    },
    setTime(amount) {
      invalidateAO(); invalidateDenoise(); invalidateBloom();
      const haze = T.MathUtils.smoothstep(amount, .35, .95);
      glow.strength.value = T.MathUtils.lerp(.12, .62, amount);
      glow.threshold.value = T.MathUtils.lerp(2.2, .70, amount);
      glow.radius.value = T.MathUtils.lerp(.62, .90, haze);
      aoStrength.value = T.MathUtils.lerp(.25, .30, amount);
    },
    setBackground(css) { background.value.set(css).convertLinearToSRGB(); },
    dispose() {
      beauty.dispose(); occlusion.dispose(); softenedAO.dispose(); glow.dispose();
      antialiasing.textureNode.renderTarget.dispose();
      antialiasing.textureNode._quadMesh.material.dispose();
      post.dispose();
    },
  };
}
