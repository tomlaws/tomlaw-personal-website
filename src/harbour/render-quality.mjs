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

// Keep the phone's image sharp at a fixed 2x pixel ratio. Rendering load must
// not lower the resolution of the scene after it has appeared.
export function mapPixelRatio(deviceRatio = 1, width = 0, height = 0) {
  const dpr = Math.min(harbourRenderProfile(width).mobile ? 2 : 1.5,
    Math.max(1, Number.isFinite(deviceRatio) ? deviceRatio : 1));
  if (!(width > 0 && height > 0)) return dpr;
  const pixelBudget = 3_200_000;
  return Math.min(dpr, Math.sqrt(pixelBudget / (width * height)));
}

export function createAdaptiveRenderQuality({ viewport }) {
  return {
    pixelRatio() {
      const {width, height, dpr} = viewport();
      return mapPixelRatio(dpr, width, height);
    },
    // Preserve the renderer interface without resizing buffers during load.
    observe() {},
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
