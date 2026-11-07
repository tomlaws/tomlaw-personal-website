import { Float32BufferAttribute } from 'three';
import {
  attribute, reference, materialColor, materialEmissive, positionLocal,
  vec3, float, min, mix, smoothstep, length, step, positionWorld,
} from 'three/tsl';

// Preserve the original material objects: lighting/animation keeps updating
// those objects, and both renderer backends read the same live properties.
export function portHarbourMaterials(root, nightState) {
  const features = new Map();
  root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const flags = features.get(material) ?? { emission: false, soft: false, vehicle: false, ferry: false };
      flags.emission ||= !!object.geometry.attributes.harbourEmission;
      flags.soft ||= !!object.geometry.attributes.harbourLightUV;
      flags.vehicle ||= !!object.geometry.attributes.vehicleLightUV;
      flags.ferry ||= material.name === 'Star Ferry warm passenger glazing';
      flags.wheel ||= !!material.userData.wheelUplightRange;
      features.set(material, flags);
    }
  });
  const night = reference('value', 'float', nightState);
  for (const [material, flags] of features) {
    let emission = materialEmissive;
    if (flags.emission) {
      let diffusion = float(1);
      if (flags.soft) {
        const lightUV = attribute('harbourLightUV', 'vec2');
        const edge = min(lightUV, lightUV.oneMinus());
        const rectangular = smoothstep(0, .20, edge.x).mul(smoothstep(0, .18, edge.y));
        const circular = smoothstep(.34, .50, length(lightUV.sub(.5))).oneMinus();
        diffusion = mix(rectangular, circular, step(.5, attribute('harbourRoundWindow', 'float')));
      }
      if(flags.wheel){
        const [bottom,top]=material.userData.wheelUplightRange;
        diffusion=diffusion.mul(mix(float(1),float(.65),smoothstep(bottom,top,positionWorld.y)));
      }
      emission = emission.add(attribute('harbourEmission', 'vec3').mul(night).mul(diffusion));
    }
    if (flags.vehicle) {
      const lightUV = attribute('vehicleLightUV', 'vec2');
      const edge = min(lightUV, lightUV.oneMinus());
      const softness = smoothstep(0, .13, edge.x).mul(smoothstep(0, .16, edge.y));
      material.colorNode = materialColor.mul(mix(vec3(.50, .65, .76), vec3(1), lightUV.y));
      emission = emission.mul(attribute('vehicleLightGain', 'float')).mul(softness)
        .mul(smoothstep(0, 1, lightUV.y).mul(.60).add(.40));
    }
    if (flags.ferry) {
      const height = positionLocal.y;
      const ceiling = height.lessThan(.70).select(smoothstep(.49, .65, height), smoothstep(.81, 1.01, height));
      emission = emission.mul(ceiling.mul(.82).add(.18));
    }
    if (flags.emission || flags.vehicle || flags.ferry) material.emissiveNode = emission;
  }
  // A shared finish may also occur on an unlit structural part. Supply neutral
  // attributes there, instead of changing that geometry or its appearance.
  root.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const count = object.geometry.attributes.position.count;
    const ensure = (name, size) => {
      if (!object.geometry.hasAttribute(name)) object.geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(count * size), size));
    };
    for (const material of materials) {
      const flags = features.get(material);
      if (flags?.emission) ensure('harbourEmission', 3);
      if (flags?.soft) { ensure('harbourLightUV', 2); ensure('harbourRoundWindow', 1); }
      if (flags?.vehicle) { ensure('vehicleLightUV', 2); ensure('vehicleLightGain', 1); }
    }
  });
  return features;
}
