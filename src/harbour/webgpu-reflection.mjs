import * as T from 'three/webgpu';
import { Fn, uniform, positionWorld, vec4, vec3, color, texture, dot, any, lessThan, greaterThan, If, Discard } from 'three/tsl';
import { createNodeSky, DAY_SKY } from './webgpu-sky.mjs';

// The same complete-water orthographic capture as WebGL, implemented with node
// materials and a scene-graph clipping group instead of GLSL/global clipping.
export function createNodeWaterReflection(renderer, scene, camera, world, clippedWorld) {
  const level = world.ocean.level, size = world.worldSize, center = world.worldCenter;
  // Match the original WebGL mirror's detail in both axes.
  const target = new T.RenderTarget(1024, 1024, { type: T.HalfFloatType });
  const virtualCamera = new T.OrthographicCamera();
  const projection = new T.Matrix4(), projectionNode = uniform(projection);
  const waterColour = uniform(new T.Color('#5fb6d6'));
  const reflectionAverage = uniform(.52), reflectionChroma = uniform(.54);
  const sky = createNodeSky(DAY_SKY);
  // This is an unlit water composite, not a basic material: MeshBasic's
  // automatic scene-environment multiplication would darken the mirror twice.
  const material = new T.NodeMaterial();
  material.setValues({ transparent: true, depthWrite: false, fog: false, toneMapped: false });
  material.fragmentNode = Fn(() => {
    const screen = projectionNode.mul(vec4(positionWorld, 1));
    // TSL render-target coordinates start at the top. Its GLSL backend makes
    // the inverse correction when sampling, so this is portable to both.
    const uv = screen.xy.div(screen.w).mul(.5).add(.5).flipY();
    If(any(lessThan(uv, 0)).or(any(greaterThan(uv, 1))), () => { Discard(); });
    const reflected = texture(target.texture, uv).rgb;
    const lum = dot(reflected, vec3(.299, .587, .114));
    const chroma = reflected.sub(vec3(lum));
    return vec4(waterColour.mul(lum.sub(reflectionAverage).mul(.9).add(1)).add(chroma.mul(reflectionChroma)), .52);
  })();
  const mesh = new T.Mesh(new T.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(center[0], level + .006, center[1]);
  mesh.renderOrder = 4; mesh.name = 'Harbour reflection'; scene.add(mesh);
  const corners = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) corners.push(new T.Vector3(center[0] + x * size / 2, level + .006, center[1] + z * size / 2));
  const position = new T.Vector3(), forward = new T.Vector3(), up = new T.Vector3(), gaze = new T.Vector3();
  const bounds = new T.Box3(), point = new T.Vector3(), extent = new T.Vector3();
  clippedWorld.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), -level)];
  // Keep one clipping-plane slot in both views so the same scene shaders can
  // serve the main camera and reflection. The main-view plane is far below
  // every object; only the mirror moves it up to the waterline.
  const mainClip = 1e6;
  clippedWorld.clippingPlanes[0].constant = mainClip;
  clippedWorld.enabled = true;
  function prepareCamera() {
    camera.updateMatrixWorld(); position.setFromMatrixPosition(camera.matrixWorld);
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion); up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    forward.y *= -1; up.y *= -1;
    virtualCamera.coordinateSystem = renderer.coordinateSystem;
    virtualCamera.position.set(position.x, 2 * level - position.y, position.z); virtualCamera.up.copy(up);
    virtualCamera.lookAt(gaze.copy(virtualCamera.position).add(forward));
    virtualCamera.near = camera.near; virtualCamera.far = camera.far; virtualCamera.updateMatrixWorld();
    bounds.makeEmpty();
    for (const corner of corners) bounds.expandByPoint(point.copy(corner).applyMatrix4(virtualCamera.matrixWorldInverse));
    bounds.getSize(extent);
    const padX = Math.max(.01, extent.x * .025), padY = Math.max(.01, extent.y * .025);
    virtualCamera.left = bounds.min.x - padX; virtualCamera.right = bounds.max.x + padX;
    virtualCamera.bottom = bounds.min.y - padY; virtualCamera.top = bounds.max.y + padY;
    virtualCamera.updateProjectionMatrix();
    projection.multiplyMatrices(virtualCamera.projectionMatrix, virtualCamera.matrixWorldInverse);
  }
  function duringReflection(callback) {
    const previous = renderer.getRenderTarget(), background = scene.background;
    scene.background = null; scene.add(sky.mesh); mesh.visible = false;
    clippedWorld.clippingPlanes[0].constant = -level;
    try { return callback(); } finally {
      renderer.setRenderTarget(previous); scene.background = background; scene.remove(sky.mesh);
      mesh.visible = true; clippedWorld.clippingPlanes[0].constant = mainClip;
    }
  }
  function update() {
    prepareCamera();
    duringReflection(() => { renderer.setRenderTarget(target); renderer.render(scene, virtualCamera); });
  }
  return {
    mesh, update, updateSky: sky.set,
    setNight(t) {
      waterColour.value.set('#5fb6d6').lerp(new T.Color('#397b9b'), t);
      reflectionAverage.value=T.MathUtils.lerp(.52,.12,t);
      reflectionChroma.value=T.MathUtils.lerp(.54,.252,t);
    },
    async compile() {
      prepareCamera();
      await duringReflection(()=>{
        renderer.setRenderTarget(target);
        return renderer.compileAsync(scene,virtualCamera);
      });
    },
    dispose() { target.dispose(); mesh.geometry.dispose(); material.dispose(); sky.dispose(); scene.remove(mesh); },
  };
}
