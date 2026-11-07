import * as T from 'three';

// Fine aggregate and plaster grain, generated in memory with no image files.
export function surfaceGrain(material, bump = .008, repeats = 4) {
  const size = 96, pixels = new Uint8Array(size * size * 4);
  let seed = 451;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (seed * 16807) % 2147483647;
    const coarse = Math.sin(x * .27) * Math.cos(y * .31) * 13;
    const value = Math.round(190 + coarse + (seed / 2147483647 - .5) * 52);
    pixels.set([value, value, value, 255], (y * size + x) * 4);
  }
  const texture = new T.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(repeats, repeats);
  texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  material.bumpMap = texture; material.bumpScale = bump;
  material.roughnessMap = texture;
  return material;
}
