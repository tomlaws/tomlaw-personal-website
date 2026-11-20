import { createRenderBudget } from './render-budget.mjs';

// Share phone settings across backends. Geometry, lighting and animation stay
// intact; smaller effect buffers leave room for Safari's page compositor.
export function harbourRenderProfile(width) {
  const mobile = width > 0 && width <= 650;
  return {
    mobile,
    reflectionResolution: mobile ? 512 : 1024,
    shadowResolution: mobile ? 1024 : 2048,
    bloomScale: mobile ? .5 : 1,
    aoScale: mobile ? .5 : .75,
    aoSamples: mobile ? 8 : 16,
    denoiseRadius: mobile ? 2 : 4,
  };
}

// Keep desktop rendering unchanged. Phones start at one render pixel per CSS
// pixel; sustained overload can reduce that to .75 without stopping animation.
export function mapPixelRatio(deviceRatio = 1, width = 0, height = 0) {
  const dpr = Math.min(harbourRenderProfile(width).mobile ? 1 : 1.5,
    Math.max(1, Number.isFinite(deviceRatio) ? deviceRatio : 1));
  if (!(width > 0 && height > 0)) return dpr;
  const pixelBudget = 3_200_000;
  return Math.min(dpr, Math.sqrt(pixelBudget / (width * height)));
}

export function createAdaptiveRenderQuality({ viewport, onChange = () => {} }) {
  const budget = createRenderBudget(onChange, {
    initialPixels: 1_000_000, minimumPixels: 562_500,
    sampleCount: 45, targetFrameMs: 55, gpuBudgetMs: 28,
  });
  return {
    pixelRatio() {
      const {width, height, dpr} = viewport();
      const scale = harbourRenderProfile(width).mobile ? Math.sqrt(budget.pixels / 1_000_000) : 1;
      return mapPixelRatio(dpr, width, height) * scale;
    },
    observe(frameMs, cpuMs, workMs) {
      if (harbourRenderProfile(viewport().width).mobile) budget.observe(frameMs, cpuMs, workMs);
    },
  };
}

// Both the GLSL and TSL bloom implementations size their mip chains here.
export function scaleEffectResolution(effect, getScale) {
  const setSize = effect.setSize.bind(effect);
  effect.setSize = (width, height) => {
    const scale = getScale();
    setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  };
}

export function setSunShadowResolution(light, resolution) {
  const shadow = light.shadow;
  if (shadow.mapSize.x === resolution && shadow.mapSize.y === resolution) return false;
  shadow.mapSize.set(resolution, resolution);
  shadow.map?.setSize(resolution, resolution);
  shadow.mapPass?.setSize(resolution, resolution);
  shadow.needsUpdate = true;
  return true;
}
