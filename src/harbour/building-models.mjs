import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The buildings modelled in Blender, and where each one belongs in the district. Everything
// else on the map is still assembled in code; these are the ones where assembling blobs was
// not good enough — a tower with four folded prism faces and a stepped crown has no honest
// code equivalent.
//
// Models live in `public/models/` and are served from the site root, so the path is absolute.
export const BUILDING_MODELS = {
  // Hong Kong Island: the southern waterfront, west to east.
  'Two IFC': import.meta.env.BASE_URL + 'hk-models/two-ifc.glb',
  'Jardine House': import.meta.env.BASE_URL + 'hk-models/jardine-house.glb',
  'HSBC Main Building': import.meta.env.BASE_URL + 'hk-models/hsbc-main.glb',
  'Cheung Kong Center': import.meta.env.BASE_URL + 'hk-models/cheung-kong-center.glb',
  'Bank of China Tower': import.meta.env.BASE_URL + 'hk-models/boc-tower.glb',
  'Lippo Centre': import.meta.env.BASE_URL + 'hk-models/lippo-centre.glb',
  // Wan Chai North, Causeway Bay, North Point and Quarry Bay, east of HKCEC.
  'Sun Hung Kai Centre': import.meta.env.BASE_URL + 'hk-models/sun-hung-kai-centre.glb',
  'Central Plaza': import.meta.env.BASE_URL + 'hk-models/central-plaza.glb',
  'Great Eagle Centre': import.meta.env.BASE_URL + 'hk-models/great-eagle-centre.glb',
  'Sing Ho Finance Building': import.meta.env.BASE_URL + 'hk-models/sing-ho-finance.glb',
  'Suns Group Centre': import.meta.env.BASE_URL + 'hk-models/suns-group-centre.glb',
  'World Trade Centre': import.meta.env.BASE_URL + 'hk-models/world-trade-centre.glb',
  'Hong Kong Central Library': import.meta.env.BASE_URL + 'hk-models/central-library.glb',
  'Provident Centre': import.meta.env.BASE_URL + 'hk-models/provident-centre.glb',
  'One Island East': import.meta.env.BASE_URL + 'hk-models/one-island-east.glb',
  'One Island East rooftop farm': import.meta.env.BASE_URL + 'hk-models/one-island-east-garden.glb',
  // The western coast carries the ordinary fabric — six models, no plots since they were removed as
  // too colourful for the row, and they are still listed so that a future plot can name them.
  'Tong Lau, Canton Road': import.meta.env.BASE_URL + 'hk-models/tong-lau.glb',
  'Tong Lau, Temple Street': import.meta.env.BASE_URL + 'hk-models/tong-lau-b.glb',
  'Office Slab, Des Voeux Road': import.meta.env.BASE_URL + 'hk-models/office-slab.glb',
  'Office Slab, Queens Road': import.meta.env.BASE_URL + 'hk-models/office-slab-b.glb',
  'Walk-up, Portland Street': import.meta.env.BASE_URL + 'hk-models/hk-walkup.glb',
  'Walk-up, Bonham Strand': import.meta.env.BASE_URL + 'hk-models/hk-walkup-b.glb',
  // The Peak Tower is built by src/peak-tower.mjs, alongside the procedural HKCEC.
};

// Built by scripts/blender/hk_buildings.py but not currently placed, because a single coastal row
// has no plot for them: Chungking Mansions, iSQUARE and the Coliseum. Their builders are still in
// the library and `hk.build(key)` regenerates them in seconds.

// One file may be listed against several slots: each is fetched into a scene of its own, which
// it has to be, because an Object3D has a single parent and sharing one would only move it.
//
// Loading is deliberately dumb: the scenes are handed to the world untouched. The remapping
// onto the palette's materials happens inside the world, because the palette only exists
// there — and that remap is the reason modelled buildings are affordable at all. The map
// batches by material object and has one spare batch out of thirty-six, so a model that
// arrived carrying its own materials would spend the entire budget on its first building.
export const UNUSED_BUILDING_MODELS = new Set([
  'Lippo Centre', 'Tong Lau, Canton Road', 'Tong Lau, Temple Street',
  'Office Slab, Des Voeux Road', 'Office Slab, Queens Road',
  'Walk-up, Portland Street', 'Walk-up, Bonham Strand',
  'Provident Centre', 'One Island East', 'One Island East rooftop farm', 'World Trade Centre', 'Hong Kong Central Library',
]);
export const ACTIVE_BUILDING_MODELS = Object.keys(BUILDING_MODELS).filter(name => !UNUSED_BUILDING_MODELS.has(name));

export async function loadBuildingModels() {
  const loader = new GLTFLoader();
  const models = {};
  await Promise.all(ACTIVE_BUILDING_MODELS.map(async name => {
    const url=BUILDING_MODELS[name];
    const gltf = await loader.loadAsync(url);
    gltf.scene.name = name;
    models[name] = gltf.scene;
  }));
  return models;
}
