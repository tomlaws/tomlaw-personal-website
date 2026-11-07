import * as T from 'three';
import { CITY_LAYOUT as site } from './layout.mjs';

// A pale sky and a soft high sun carry the daytime look; dusk keeps the same
// pastel surfaces but hands the scene over to the signs and windows.
// Moving light sources follow the simulation's transforms, including its pause.
export function createCityLighting(scene, world) {
  const sky = new T.HemisphereLight('#e4eefb', '#f6eee2', .64);
  const sun = new T.DirectionalLight('#fff7ea', .32);
  sun.position.set(site.center[0] - 3.5, 8, site.center[1] - 5);
  sun.target.position.set(site.center[0], 0, site.center[1]); scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const extent = world.worldSize * .73;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: .1, far: 36 });
  sun.shadow.normalBias = .009;
  sun.shadow.bias = -.00008;
  sun.shadow.radius = 2.2;
  // Two opposed rims light the sides the sun never reaches. The camera looks in
  // from the south-east while the sun sits north-west, so almost every wall facing
  // us is a shaded one: these two are what decide whether it reads white or grey.
  // They are near-white now, with just a trace of rose and sky left in them.
  const rim = new T.DirectionalLight('#f4e6ee', 1.15);
  rim.position.set(8, 4, 3);
  const counter = new T.DirectionalLight('#e8f0f9', 1.05);
  counter.position.set(-7, 3.2, 5.5);
  scene.add(sky, sun, rim, counter);
  const lamps = [];
  // Ground pools used to collapse into hard dots. Two things caused it: the lamps
  // hang close to the paving, and physical inverse-square decay meant a point 1.5
  // units out received under half the light of the centre. Falling back to a
  // near-linear decay, widening the penumbra and extending the cutoff spreads each
  // lamp across the pavement. Dividing by the lamp height re-balances the centre,
  // so the pool widens rather than simply getting brighter. Beams that should stay
  // tight (headlights) pass decay 2 and keep the physical falloff.
  function spot(name, from, to, color, intensity, distance, angle, shadow = false, decay = .6) {
    if (decay < 2) {
      intensity /= Math.pow(Math.max(.40, from[1] - to[1]), 1.4);
      distance *= 1.3;
    }
    const light = new T.SpotLight(color, intensity, distance, angle, .85, decay);
    light.name = name;
    light.position.set(...from); light.target.position.set(...to);
    light.castShadow = shadow;
    light.shadow.mapSize.set(shadow && name.includes('headlight') ? 512 : 1024, shadow && name.includes('headlight') ? 512 : 1024);
    light.shadow.camera.near = .06;
    light.shadow.bias = -.00008;
    light.shadow.normalBias = .005;
    light.shadow.radius = 2.6;
    light.userData.baseIntensity = intensity;
    scene.add(light, light.target); lamps.push(light);
    return light;
  }
  const at = (anchor, x, y, z) => [anchor[0] + x, y, anchor[1] + z];
  const dinerLight = spot('Diner awning downlight', at(site.diner, 0, 1.36, 1.42), at(site.diner, 0, 0, 1.98), '#ff429f', 6.0, 4.2, .92, true);
  const bookLight = spot('Bookshop pavement light', at(site.books, 0, 1.98, 1.10), at(site.books, 0, 0, 2.30), '#43ddeb', 5.4, 4.2, .76);
  const recordLight = spot('Record bar neon spill', at(site.apartments, -.56, 1.36, 1.03), at(site.apartments, -.29, .1, 1.95), '#ee459f', 4.0, 2.8, .94);
  const cafeLamp = spot('Swaying cafe pendant', at(site.cafe, .04, 1.58, .24), at(site.cafe, .04, 0, .37), '#ffc16d', 3.1, 3.4, 1.05, true);
  spot('Crossing streetlight', at(site.lamps.crossing, 0, 1.51, 0), [.55, 0, 5.55], '#9ebbdc', 3.8, 4.0, .95);
  spot('Market streetlight', at(site.lamps.market, 0, 1.51, 0), [site.market[0], 0, .80], '#5ed3e5', 3.5, 3.7, .94);
  const mallLight = spot('Galleria entrance downlight', at(site.mall, 0, 2.53, 1.94), at(site.mall, 0, 0, 3.00), '#46e2f1', 6.0, 5.0, .76, true);
  spot('Galleria atrium pendant', at(site.mall, 0, 3.31, .25), at(site.mall, 0, .08, -.15), '#ffdab0', 5.4, 4.6, .90);
  spot('Galleria promenade light', at(site.lamps.mall, 0, 1.51, 0), at(site.lamps.mall, 0, 0, -.7), '#9ab9e4', 3.0, 3.3, .95);
  spot('Cafe promenade light', at(site.lamps.cafe, 0, 1.51, 0), at(site.lamps.cafe, 0, 0, -.7), '#9ab9e4', 3.0, 3.3, .95);
  const studioLight = spot('Orchid sign spill', at(site.studio, 0, 2.88, 1.42), at(site.studio, 0, 0, 2.55), '#df5acc', 4.5, 4.8, .82);
  const arcadeLight = spot('Arcade neon spill', at(site.arcade, 0, 1.52, 1.36), at(site.arcade, 0, 0, 2.30), '#4ae0f2', 4.4, 3.6, .78);
  const violetWash = spot('Record bar violet wash', at(site.apartments, -.10, 2.34, 1.30), at(site.apartments, -.10, 0, 2.45), '#9b6cff', 4.2, 3.8, .84);
  const acidWash = spot('Market acid wash', at(site.market, 0, 1.66, .35), at(site.market, 0, 0, .35), '#8cf05e', 3.2, 3.2, .88);
  const neonLights = [{ light: dinerLight, ink: 'magenta', base: 4 }, { light: recordLight, ink: 'magenta', base: 4 }, { light: studioLight, ink: 'magenta', base: 4 }, { light: bookLight, ink: 'cyan', base: 3.5 }, { light: mallLight, ink: 'cyan', base: 3.5 }, { light: arcadeLight, ink: 'cyan', base: 3.5 }, { light: violetWash, ink: 'violet', base: 3.1 }, { light: acidWash, ink: 'acid', base: 2.8 }];
  let nightMultiplier = 1;
  spot('Galleria animated screen spill', at(site.mall, 1.4, 3.68, 1.94), at(site.mall, 1.4, 0, 3.42), '#e96fbd', 5.5, 5.2, .71);
  spot('Relay entrance light', at(site.towers[0], 0, 1.16, 1.62), at(site.towers[0], 0, 0, 2.30), '#67dce9', 3.5, 3.4, .95);
  spot('Exchange entrance light', at(site.towers[1], 0, 1.16, 1.62), at(site.towers[1], 0, 0, 2.30), '#d87bb9', 3.5, 3.4, .95);
  const headlamps = world.cars.map((car, i) => {
    const light = spot(`Moving headlight ${i + 1}`, [0, .28, 0], [1, .08, 0], '#ffe5b2', 2.1, 3.5, .46, i === 0, 2);
    return { car, light };
  });
  const fountainLight = new T.PointLight('#29cee8', .70, 1.5, 2);
  fountainLight.name = 'Fountain underwater light'; fountainLight.position.set(site.water[0], .22, site.water[1]); scene.add(fountainLight);
  const from = new T.Vector3(), to = new T.Vector3();
  function update(time) {
    for (const { light, ink, base } of neonLights) light.intensity = light.userData.baseIntensity * nightMultiplier * world.cyberpunk.materials[ink].emissiveIntensity / base;
    for (const { car, light } of headlamps) {
      light.visible = car.g.visible;
      from.set(.455, .28, 0).applyMatrix4(car.g.matrixWorld);
      to.set(2.5, .045, 0).applyMatrix4(car.g.matrixWorld);
      light.position.copy(from); light.target.position.copy(to);
    }
    cafeLamp.position.x = site.cafe[0] + .04 + Math.sin(time * 1.1) * .045;
    cafeLamp.position.z = site.cafe[1] + .24 + Math.cos(time * .83) * .028;
    cafeLamp.target.position.x = site.cafe[0] + .04 + Math.sin(time * 1.1) * .085;
  }
  function setDay(day) {
    sky.color.set(day ? '#e6f0fb' : '#3f5590');
    sky.groundColor.set(day ? '#eee2d4' : '#3d1b47');
    sky.intensity = day ? .64 : .30;
    sun.color.set(day ? '#fff7ea' : '#819ac9');
    sun.intensity = day ? .32 : .52;
    rim.color.set(day ? '#f4e6ee' : '#c063d8');
    rim.intensity = day ? 1.15 : .62;
    counter.color.set(day ? '#e8f0f9' : '#38c9e6');
    counter.intensity = day ? 1.05 : .34;
    nightMultiplier = day ? .34 : 1.12;
    lamps.forEach(light => light.intensity = light.userData.baseIntensity * nightMultiplier);
    world.interiorLights.forEach(light => light.intensity = light.userData.baseIntensity * (day ? .30 : 1));
    update(world.time); // A lighting change also works while the simulation is paused.
  }
  update(0);
  return { sky, sun, rim, counter, lamps, headlamps, update, setDay };
}
