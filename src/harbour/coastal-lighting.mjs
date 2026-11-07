import * as T from 'three';

export function createCoastalLighting(scene, world) {
  const sky = new T.HemisphereLight('#e4f1f4', '#cdbb97', 1.05);
  const sun = new T.DirectionalLight('#fff1d2', 2.0); sun.position.set(-6, 14, 9); sun.target.position.set(0, 0, 0); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: .1, far: 45 });
  sun.shadow.normalBias = .003; sun.shadow.bias = -.00004; sun.shadow.radius = 3.5; sun.shadow.blurSamples = 8;
  const rim = new T.DirectionalLight('#c8e7f3', .38); rim.position.set(9, 7, -8);
  scene.add(sky, sun, sun.target, rim);
  const headlamps = world.cars.map(car => { const light = new T.SpotLight('#fff2c3', .35, 2, .45, .8, 2); scene.add(light, light.target); return { car, light }; });
  const from=new T.Vector3(),to=new T.Vector3();
  function update() {
    for (const { car, light } of headlamps) {
      // Keep the renderer's light count constant as traffic enters/leaves the
      // map. Toggling visibility changes every material's shader/pipeline.
      // Zero intensity has the same lighting result without runtime compilation.
      light.intensity=car.g.visible?(light.userData.nightIntensity??.35):0;
      light.position.copy(from.fromArray(car.g.userData.headlightPosition).applyMatrix4(car.g.matrixWorld));
      light.target.position.copy(to.fromArray(car.g.userData.headlightTarget).applyMatrix4(car.g.matrixWorld));
    }
  }
  function setDay(day) { sky.intensity = day ? 1.05 : .45; sun.intensity = day ? 2 : .55; sun.color.set(day ? '#fff1d2' : '#a2b8df'); rim.intensity = day ? .38 : .5; update(); }
  return { sky, sun, rim, headlamps, update, setDay };
}
