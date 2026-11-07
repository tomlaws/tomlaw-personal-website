import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The night route builds the same coastal world, then dresses its existing
// buildings and lights. No road, shoreline or building model is duplicated.
export function createCyberpunkCoast(scene, world, lighting) {
  const root = new T.Group(); root.name = 'Cyberpunk night dressing'; world.root.add(root);
  const panels = [], inks = [], lights = [], windows = [];
  const colors = ['#63e9ff', '#ff7acb', '#bea0ff', '#ffce89'];
  const cabinet = new T.MeshStandardMaterial({ color: '#272740', roughness: .45, metalness: .3 });
  function box(w, h, d, material, parent, x, y, z) { const mesh = new T.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(.035, w / 5, h / 5, d / 5)), material); mesh.position.set(x, y, z); mesh.castShadow = false; mesh.receiveShadow = false; parent.add(mesh); return mesh; }
  // The panel is the sign: a cabinet, a lightbox and the spill it throws, with no lettering
  // modelled on it. A mounted sign still glows and still lights the pavement — it just says
  // nothing.
  world.root.updateMatrixWorld(true);
  // The night budget is eight pavement lights, so with more buildings than that the spill is
  // spread across every second or fourth block rather than every other one: the night wants a
  // few pools of colour on the street, not one floodlight per building.
  const lightBudget = 8, lightStride = Math.max(2, Math.ceil(world.buildings.length / lightBudget));
  for (const [i, building] of world.buildings.entries()) {
    const ink = new T.MeshStandardMaterial({ color: colors[i % 4], emissive: colors[i % 4], emissiveIntensity: 4.2, roughness: .28 });
    inks.push(ink);
    const position = building.group.getWorldPosition(new T.Vector3());
    const g = new T.Group(); g.name = `Mounted night sign · ${building.name}`; g.position.copy(position); root.add(g);
    if (building.use === 'convention centre') {
      // The entrance lightbox follows the HKCEC's exceptional camera-facing pose.
      g.quaternion.copy(building.group.getWorldQuaternion(new T.Quaternion()));
      g.scale.copy(building.group.getWorldScale(new T.Vector3()));
      box(.76, .075, .025, ink, g, 0, .61, 1.29);
    } else if (building.use === 'observatory') {
      box(.89, .31, .10, ink, g, 0, 1.06, 1.02);
    } else {
      const width = building.width * (building.use === 'cinema' ? .84 : .68);
      const y = building.use === 'cinema' ? 1.29 : .94;
      const front = building.use === 'cinema' ? .53 : building.use === 'school' ? .42 : .24;
      box(width, .37, .09, ink, g, 0, y, building.depth / 2 + front);
    }
    panels.push(g);
    // Broad, mounted lightboxes add the night silhouette without restoring
    // the thin route outlines, overhead cables or loose facade strips.
    if (['shophouse', 'tenements', 'guesthouse', 'shopping centre', 'hotel'].includes(building.use)) {
      // A tall lightbox beside the shopfront sign, stacked where the letter column stood.
      const y = Math.min(building.height - 1, 2.3), x = building.width / 2 - .18, z = building.depth / 2 + .20;
      box(.31, 1.28, .14, ink, g, x, y, z);
    }
    if (lights.length < lightBudget && (i % lightStride === 0 || building.use === 'hotel')) {
      const light = new T.SpotLight(colors[i % 4], 5.2, 4.5, .9, .9, 1);
      light.name = `Neon pavement spill · ${building.name}`;
      light.position.set(position.x, position.y + 1.30, position.z + building.depth / 2 + .21);
      light.target.position.set(position.x, world.land.top + .035, position.z + building.depth / 2 + .82);
      if (building.use === 'convention centre') {
        light.position.copy(building.group.localToWorld(new T.Vector3(0, 1.30, 1.30)));
        light.target.position.copy(building.group.localToWorld(new T.Vector3(0, .01, 1.85)));
      }
      scene.add(light, light.target); lights.push({ light, ink });
    }
  }
  for (const [i, room] of world.windows.entries()) {
    const glass = room.children.find(o => o.isMesh && o.material.transparent);
    if (!glass) continue;
    glass.geometry.computeBoundingBox(); const size = glass.geometry.boundingBox.getSize(new T.Vector3());
    const color = i % 7 === 0 ? '#e88acb' : i % 5 === 0 ? '#94d8f2' : '#ffcc8d';
    const material = new T.MeshBasicMaterial({ color, transparent: true, opacity: i % 4 === 0 ? .06 : .22, depthWrite: false, side: T.DoubleSide });
    material.color.multiplyScalar(2.4);
    const pane = new T.Mesh(new T.PlaneGeometry(size.x * .96, size.y * .96), material);
    pane.position.copy(glass.position); pane.position.z -= .012; pane.name = 'Interior night glow'; room.add(pane); windows.push(pane);
  }
  // The surface stays transparent; the full-depth cutaway sides stay opaque.
  const previousWater = { lower: world.materials.sea.color.clone(), emissive: world.materials.sea.emissive.clone(), upper: world.ocean.upper.material.color.clone(), sides: world.ocean.sides.material.color.clone(), sideEmissive: world.ocean.sides.material.emissive.clone() };
  const pavingMaterials = [world.materials.ground, world.materials.coastalPaving, world.materials.coastalQuay];
  const previousSurfaces = { roadRoughness: world.materials.road.roughness, roadMetalness: world.materials.road.metalness, pavingRoughness: pavingMaterials.map(m => m.roughness) };
  // A directional light reflects across the whole flat sea/road at its mirror
  // angle. Keep this sky fill blue; magenta belongs to localized neon spill.
  const fill = new T.DirectionalLight('#829bd5', .35); fill.name = 'Cool night sky fill'; fill.position.set(-8, 5, 3); scene.add(fill);
  // The wheel is lit at night, and it is lit red: that is the colour the city lights it, and it is
  // the one warm thing on that stretch of the waterfront. The hoop rides on the wheel's own turning
  // assembly rather than being drawn over a still one, so whenever the clock is running — the video
  // export rather than the page, which is a still frame — the light goes round with it.
  const wheelGlow = new T.MeshStandardMaterial({ color: '#ff9a7a', emissive: '#ff4a2f', emissiveIntensity: 4.4, roughness: .32 });
  // On the rim's own radius, in the rim's own plane, and a little fatter than the rim is: at night
  // the structure is what is lit, and the gondolas hang in front of the light rather than inside it.
  const wheelRing = new T.Mesh(new T.TorusGeometry(world.observationWheel.radius, .06, 6, 64), wheelGlow);
  wheelRing.name = 'Observation wheel night rim'; wheelRing.castShadow = false; wheelRing.receiveShadow = false;
  world.observationWheel.group.add(wheelRing);
  let active = false;
  function setNight(night) {
    active = night; root.visible = night; windows.forEach(pane => pane.visible = night); fill.visible = night;
    wheelRing.visible = night;
    if (night) {
      lighting.sky.color.set('#607fb0'); lighting.sky.groundColor.set('#302842'); lighting.sky.intensity = .38;
      lighting.sun.color.set('#94aef2'); lighting.sun.intensity = .75;
      lighting.rim.color.set('#63d4ef'); lighting.rim.intensity = .75;
      lighting.headlamps.forEach(({ light }) => light.intensity = 1.5);
      world.materials.sea.color.set('#245783'); world.materials.sea.emissive.set('#152d51');
      world.ocean.sides.material.color.set('#245783'); world.ocean.sides.material.emissive.set('#152d51');
      world.ocean.upper.material.color.set('#88b9e2');
      world.materials.road.roughness = .26; world.materials.road.metalness = .12; pavingMaterials.forEach(m => m.roughness = .46);
    } else {
      lighting.rim.color.set('#c8e7f3'); lighting.sky.color.set('#e4f1f4'); lighting.sky.groundColor.set('#cdbb97');
      lighting.headlamps.forEach(({ light }) => light.intensity = .35);
      world.materials.sea.color.copy(previousWater.lower); world.materials.sea.emissive.copy(previousWater.emissive); world.ocean.upper.material.color.copy(previousWater.upper);
      world.ocean.sides.material.color.copy(previousWater.sides); world.ocean.sides.material.emissive.copy(previousWater.sideEmissive);
      world.materials.road.roughness = previousSurfaces.roadRoughness; world.materials.road.metalness = previousSurfaces.roadMetalness; pavingMaterials.forEach((m, i) => m.roughness = previousSurfaces.pavingRoughness[i]);
    }
    lights.forEach(({ light }) => light.visible = night);
    animate(world.time);
  }
  function animate(time) {
    inks.forEach((ink, i) => ink.emissiveIntensity = 4.2 * (1 + Math.sin(time * .32 + i * .9) * .045));
    lights.forEach(({ light, ink }) => light.intensity = 5.2 * ink.emissiveIntensity / 4.2);
  }
  setNight(true);
  return { root, panels, inks, lights, windows, setNight, animate, get active() { return active; } };
}
