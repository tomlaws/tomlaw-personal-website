import { DataUtils } from 'three';

// Development-only GPU readback. The fixed-scene run alternates reflection
// captures and compares the scene, bloom and final colour buffers over 16 frames.
export function createTemporalSampler(renderer, targets) {
  const previousSamples = new Map();
  return async () => {
    const results = {};
    for (const [name, target] of targets()) {
      const x = Math.floor(target.width * .40), y = Math.floor(target.height * .30);
      const width = Math.floor(target.width * .58), height = Math.floor(target.height * .40);
      const data = await renderer.readRenderTargetPixelsAsync(target, x, y, width, height);
      const samples = [];
      for (let i = 0; i < data.length; i += 64)
        for (let channel = 0; channel < 3; channel++) samples.push(DataUtils.fromHalfFloat(data[i + channel]));
      const previous = previousSamples.get(name);
      results[name] = { mean: samples.reduce((a, b) => a + b, 0) / samples.length };
      if (previous) {
        const deltas = samples.map((value, index) => Math.abs(value - previous[index]));
        results[name].delta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        results[name].max = deltas.reduce((a, b) => Math.max(a, b), 0);
      }
      previousSamples.set(name, samples);
    }
    return results;
  };
}
