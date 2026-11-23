import { harbourRenderProfile } from './render-quality.mjs';

// The reflective finish, tint, clearcoat and interior-light shaders stay intact.
// On phones, omit refraction's additional opaque-scene capture in both views.
export function createMobileGlazing(root) {
  const original = new Map();
  root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.transmission > 0) original.set(material, material.transmission);
    }
  });
  return {
    setWidth(width) {
      const mobile = harbourRenderProfile(width).mobile;
      let changed = 0;
      for (const [material, transmission] of original) {
        const value = mobile ? 0 : transmission;
        if (material.transmission === value) continue;
        material.transmission = value;
        material.needsUpdate = true;
        changed++;
      }
      return changed;
    },
  };
}
