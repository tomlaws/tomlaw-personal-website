import { BufferGeometry, Float32BufferAttribute, FrontSide, HalfFloatType, LessEqualDepth, Matrix4, Mesh, NearestFilter, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';

// Exclude every animated hierarchy, including the ferry wake and instanced
// foliage. Transparent glazing and water always retain their live materials.
export function staticShadingMeshes(world) {
  const dynamic = new Set([
    ...world.cars.map(car => car.g), ...world.boats.map(boat => boat.g), ...world.trees,
    world.peakTram.moving, world.observationWheel.group,
    world.root.userData.animateShips?.state?.ferryWake,
  ]);
  const meshes = new Set();
  world.root.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || Array.isArray(object.material)) return;
    const material = object.material;
    if (!material || !material.visible || material.transparent || !material.depthWrite || !material.depthTest || material.alphaTest || material.polygonOffset
      || material.side !== FrontSide || material.depthFunc !== LessEqualDepth || !material.colorWrite) return;
    for (let parent = object; parent; parent = parent.parent) if (!parent.visible || dynamic.has(parent)) return;
    meshes.add(object);
  });
  return meshes;
}

// Only position and indices are needed to reproduce native MSAA coverage and
// per-sample depth. Shading comes from the cached image, not a new light model.
export function staticShadingGeometry(meshes) {
  const positions = [], indices = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry, position = geometry.getAttribute('position');
    const offset = positions.length / 3, matrix = mesh.matrixWorld.elements;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      positions.push(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],
        matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13], matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]);
    }
    const count = geometry.index?.count ?? position.count;
    const start = geometry.drawRange.start, end = Math.min(count, start + geometry.drawRange.count);
    const reflected = mesh.matrixWorld.determinant() < 0;
    const vertex = index => offset + (geometry.index ? geometry.index.getX(index) : index);
    for (let i = start; i + 2 < end; i += 3) indices.push(vertex(i), vertex(i + (reflected ? 2 : 1)), vertex(i + (reflected ? 1 : 2)));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}

function withVisibility(values, run) {
  const saved = values.map(([object, visible]) => { const old = object.visible; object.visible = visible; return [object, old]; });
  try { return run(); } finally { for (const [object, visible] of saved) object.visible = visible; }
}

export function createStaticShadingCache(scene, camera, meshes, {
  enabled = () => true, canCapture = () => true, canRefresh = () => true,
  now = () => performance.now(), interval = 100,
} = {}) {
  scene.updateMatrixWorld(true);
  const target = new WebGLRenderTarget(1, 1, {type:HalfFloatType, samples:2, resolveDepthBuffer:false,
    minFilter:NearestFilter, magFilter:NearestFilter});
  const material = new ShaderMaterial({
    uniforms:{tShading:{value:target.texture},uSize:{value:new Vector2(1, 1)}},
    vertexShader:`#include <clipping_planes_pars_vertex>
      void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader:`uniform sampler2D tShading; uniform vec2 uSize;
      #include <clipping_planes_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        vec4 shaded=texture2D(tShading,gl_FragCoord.xy/uSize);
        // The proxy geometry supplies the actual MSAA silhouette. Remove the
        // cached image's coverage so those edge samples are not multiplied twice.
        gl_FragColor=vec4(shaded.rgb/max(shaded.a,0.000001),1.);
      }`,
    toneMapped:false, clipping:true,
  });
  const proxy = new Mesh(staticShadingGeometry(meshes), material);
  proxy.name = 'Cached static city shading'; proxy.visible = false;
  scene.add(proxy);
  const view = new Matrix4(), projection = new Matrix4();
  let valid = false, refreshed = -Infinity, disposed = false;
  const cache = {
    enabled:true, refreshed:false,
    invalidate() { valid = false; },
    render(renderer, destination) {
      cache.refreshed = false;
      if (disposed || !cache.enabled || !enabled() || !meshes.size) return false;
      if (target.width !== destination.width || target.height !== destination.height || target.samples !== destination.samples) {
        if (target.samples !== destination.samples) { target.samples = destination.samples; target.dispose(); }
        target.setSize(destination.width, destination.height);
        material.uniforms.uSize.value.set(target.width, target.height); valid = false;
      }
      if (!canCapture()) { valid = false; return false; }
      camera.updateMatrixWorld();
      const time = now(), elapsed = time - refreshed;
      const changed = !view.equals(camera.matrixWorld) || !projection.equals(camera.projectionMatrix);
      const refresh = !valid || changed || (elapsed >= interval && (canRefresh() || elapsed >= interval * 2));
      const autoClear = renderer.autoClear, background = scene.background;
      try {
        renderer.autoClear = true;
        if (refresh) {
          const live = [];
          scene.traverse(object => { if (object.isMesh && !meshes.has(object)) live.push([object, false]); });
          scene.background = null; renderer.setRenderTarget(target);
          withVisibility(live, () => renderer.render(scene, camera));
          valid = true; refreshed = time; view.copy(camera.matrixWorld); projection.copy(camera.projectionMatrix); cache.refreshed = true;
        }
        scene.background = background; renderer.setRenderTarget(destination);
        withVisibility([...meshes].map(object => [object, false]).concat([[proxy, true]]), () => renderer.render(scene, camera));
      } finally { renderer.autoClear = autoClear; scene.background = background; renderer.setRenderTarget(destination); }
      return true;
    },
    dispose() { if (disposed) return; disposed = true; scene.remove(proxy); proxy.geometry.dispose(); material.dispose(); target.dispose(); },
  };
  return cache;
}
