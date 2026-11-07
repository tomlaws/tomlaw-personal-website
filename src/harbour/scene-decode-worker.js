import { readSceneData } from './scene-codec.mjs';

// Decoding the unquantised scene takes place off the page thread. Transfer its
// typed-array buffers back rather than copying the geometry a second time.
self.onmessage = async ({ data: { url } }) => {
  try {
    const scene = await readSceneData(await fetch(url));
    const buffers = new Set();
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (ArrayBuffer.isView(value)) { buffers.add(value.buffer); return; }
      if (value instanceof ArrayBuffer) { buffers.add(value); return; }
      for (const child of Object.values(value)) visit(child);
    };
    visit(scene);
    self.postMessage({ scene }, [...buffers]);
  } catch (error) {
    self.postMessage({ error: String(error?.message || error) });
  }
};
