import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ASSET_URL = '/models/lantern-organic.glb';
export const ASSET_NAMES = [
  'tree-trunk', 'tree-crown', 'garden-bed', 'round-tree-planter', 'terracotta-planter', 'trailing-vine',
  'cafe-roof', 'parasol', 'market-sage', 'market-rose', 'bentwood-bench',
  'fountain-bowl', 'fountain-spout', 'diner-roof', 'barrel-roof', 'studio-roof', 'bistro-chair',
  'blossom-crown', 'apartment-roof', 'shop-awning', 'market-cart', 'bus-shelter', 'retro-car',
  'mall-escalator', 'mall-skylight',
];

export async function parseOrganicAssets(buffer) {
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const templates = new Map();
  const instances = [];
  // Three tones per building. Primary: near-white stone, plaster and canvas that
  // read as the mass. Secondary: roofs, canopies, metalwork and timber, which
  // carry the colour. Accent: pots, blossom, lamps and tyres, spent sparingly.
  // Accents (roofs, awnings, planting, pottery, lamps) carry real saturation; the
  // neutral masses — stone, chrome, glass, oat canvas, bark, soil, rubber — stay put.
  const palette = {
    'Stone · honed limestone': '#f7f2e8', 'Chrome · brushed silver': '#e8eef7',
    'Glass · clear blue': '#d8ecfa',
    'Metal · graphite blue': '#b3cef7', 'Canvas · oat': '#fbeecf',
    'Canvas · cinnabar': '#f7ab9f', 'Canvas · jade': '#9fe3bd',
    'Clay tile · oxblood': '#f5a8bc', 'Clay tile · sun worn': '#f5c48c',
    'Zinc · turquoise patina': '#9fdde8', 'Copper · mellow patina': '#f2c396',
    'Timber · oiled ash': '#f0c890', 'Bark · weathered olive': '#ddd0b8',
    'Car paint · enamel': '#f2cf7f',
    'Leaf · eucalyptus': '#9fdb9f', 'Leaf · new growth': '#c2ea9f',
    'Leaf · shadow': '#8ed2ab', 'Soil · damp garden': '#e4d8bc',
    'Ceramic · terracotta': '#f5b894', 'Flowers · cherry pink': '#f7a6c6',
    'Flowers · petal highlights': '#f9c2d6', 'Rubber · soft charcoal': '#ccd1e2',
    'Lamp · headlight ivory': '#ffefb3', 'Lamp · ruby taillight': '#f28f9c',
  };
  const styled = new Set();
  const wind = { value: 0 };
  const preparedMaterials = new Set();
  const windShader = shader => {
    shader.uniforms.uCityWind = wind;
    shader.vertexShader = 'uniform float uCityWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed.x += sin(uCityWind * 1.7 + position.y * 11.0 + position.z * 13.0) * 0.009;
      transformed.z += sin(uCityWind * 1.1 + position.x * 15.0) * 0.006;
    `);
  };
  const windDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, side: T.DoubleSide });
  windDepth.onBeforeCompile = windShader;
  windDepth.customProgramCacheKey = () => 'lantern-wind-depth-v2';
  function prepareMesh(mesh) {
    if (mesh.material.name.startsWith('Leaf') || mesh.material.name.startsWith('Flowers')) mesh.customDepthMaterial = windDepth;
  }
  for (const name of ASSET_NAMES) {
    const template = gltf.scene.getObjectByName(name);
    if (!template) throw new Error(`Missing Blender asset: ${name}`);
    template.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = !object.material.transparent;
      object.receiveShadow = true;
      // All imported surfaces share a consistent layout for static batching.
      for (const attribute of Object.keys(object.geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(attribute)) object.geometry.deleteAttribute(attribute);
      }
      if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
      if (!object.geometry.attributes.uv) object.geometry.setAttribute('uv', new T.BufferAttribute(new Float32Array(object.geometry.attributes.position.count * 2), 2));
      object.material.shadowSide = object.material.side;
      if (!styled.has(object.material)) {
        if (palette[object.material.name]) object.material.color.set(palette[object.material.name]);
        styled.add(object.material);
      }
      if ((object.material.name.startsWith('Leaf') || object.material.name.startsWith('Flowers')) && !preparedMaterials.has(object.material)) {
        preparedMaterials.add(object.material);
        object.material.onBeforeCompile = windShader;
        object.material.customProgramCacheKey = () => 'lantern-leaf-wind-v2';
      }
      prepareMesh(object);
    });
    templates.set(name, template);
  }
  return {
    templates,
    instances,
    prepareMesh,
    animate(time) { wind.value = time; },
    place(name, parent, x = 0, y = 0, z = 0, scale = 1, rotation = 0) {
      const template = templates.get(name);
      if (!template) throw new Error(`Unknown Blender asset: ${name}`);
      const group = new T.Group();
      group.name = `Blender · ${name}`;
      group.userData.asset = name;
      group.position.set(x, y, z);
      group.rotation.y = rotation;
      if (Array.isArray(scale)) group.scale.set(...scale);
      else group.scale.setScalar(scale);
      group.add(template.clone(true));
      parent.add(group);
      instances.push(group);
      return group;
    },
  };
}

export async function loadOrganicAssets() {
  const response = await fetch(ASSET_URL);
  if (!response.ok) throw new Error(`Could not load city models (${response.status})`);
  return parseOrganicAssets(await response.arrayBuffer());
}
