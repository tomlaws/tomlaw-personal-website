import * as T from 'three';

// A true planar reflection for the harbour.
//
// The water is the one surface on this map that is supposed to be a mirror and never was: the
// island has no reflection in the sea around it, which is the single most recognisable thing about
// a harbour. This draws it properly rather than faking it. The scene is rendered from a camera
// mirrored through the water plane and clipped to whatever stands above it, and the water samples
// that image at the screen position the mirrored scene was drawn to — so the towers land in the
// water exactly where a mirror would put them, and they move with the view.
//
// Why it is not fake geometry: the cheap way to reflect something in a flat plane is to draw a
// second copy of it upside down. That is geometrically correct for an orthographic camera, and it
// was tempting — but it only works if the water is see-through for several units, and this ocean is
// deliberately shallow (the lower layer is opaque from a metre down, which is what gives the sea
// its colour and shows the island's foundations). A render target costs one pass and needs nothing
// from the water.
//
// Captured with each presented animation/camera frame. Its
// frustum covers the water plate independently of the main camera's zoom/crop.
export function createWaterReflection(renderer, scene, camera, {
  level, waterColor = '#5fb6d6', strength = .9, opacity = .52, average = .52, resolution = 1024, size = 24, center = [0, 0], sky = null,
}) {
  const target = new T.WebGLRenderTarget(resolution, resolution, { type: T.HalfFloatType });
  const virtualCamera = new T.OrthographicCamera();
  const projection = new T.Matrix4();
  // Everything below the water is dropped from the reflection. Without this the island's own
  // submerged foundation mirrors back up over the waterline and the reflection reads as a second
  // island rather than as one seen in a mirror.
  const clipPlane = new T.Plane(new T.Vector3(0, 1, 0), -level);

  const material = new T.ShaderMaterial({
    uniforms: {
      tReflection: { value: target.texture },
      uProjection: { value: projection },
      uWater: { value: new T.Color(waterColor) },
      uStrength: { value: strength },
      uOpacity: { value: opacity },
      uAverage: { value: average },
      uChroma: { value: .6 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform mat4 uProjection;
      varying vec4 vScreen;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        vScreen = uProjection * world;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D tReflection;
      uniform vec3 uWater;
      uniform float uStrength, uOpacity, uAverage, uChroma;
      varying vec4 vScreen;
      void main() {
        // Sampled where the mirrored render put it, so the towers land in the water exactly where a
        // mirror would put them.
        vec2 uv = vScreen.xy / vScreen.w * .5 + .5;
        // Never stretch a clamped border texel across out-of-range water.
        if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
        vec3 reflected = texture2D(tReflection, uv).rgb;
        // The reflection is used as light, shade and tint on the water rather than as a picture laid
        // over it: the sea keeps its own colour and gains only how much brighter or darker the thing
        // behind it is, and how much warmer or cooler. Laying the picture over the water whole — the
        // obvious way — lifts the whole harbour towards the pale of the sky and the deep teal goes
        // out of the sea, which is most of what it looked like the first time it was tried.
        // The tint matters as much as the shade: this district is pale buildings against a pale sky,
        // so brightness alone barely separates a mirrored tower from the sky behind it, while the
        // cream of the tower warming the water does.
        // uAverage is the reflection's own average brightness, which is the sky; taking it off leaves
        // only the shape.
        float lum = dot(reflected, vec3(.299, .587, .114));
        vec3 chroma = reflected - vec3(lum);
        gl_FragColor = vec4(uWater * (1. + (lum - uAverage) * uStrength) + chroma * uStrength * uChroma, uOpacity);
      }`,
  });

  const mesh = new T.Mesh(new T.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center[0], level + .006, center[1]);
  // Drawn before the ocean layers and the surf line, which then read over the top of it: the
  // reflection is the water's body, not something sitting on it.
  mesh.renderOrder = 4;
  mesh.name = 'Harbour reflection';
  scene.add(mesh);

  const position = new T.Vector3(), forward = new T.Vector3(), up = new T.Vector3(), gaze = new T.Vector3();
  const captureCorners=[];
  for(const x of [-1,1])for(const z of [-1,1])captureCorners.push(new T.Vector3(center[0]+x*size/2,level+.006,center[1]+z*size/2));
  const captureBounds=new T.Box3(),capturePoint=new T.Vector3(),captureSize=new T.Vector3();
  // Keep the sky and its compiled program alive between reflection captures.
  // Recreating and disposing it at 5 Hz caused repeated GPU shader compilation.
  const dome=sky?sky():null;
  function updateSky(){
    if(!dome||!sky)return;
    const next=sky();
    for(const [name,uniform]of Object.entries(next.material.uniforms)){
      const current=dome.material.uniforms[name];
      if(current.value?.copy)current.value.copy(uniform.value);else current.value=uniform.value;
    }
    next.geometry.dispose();next.material.dispose();
  }

  function update() {
    camera.updateMatrixWorld();
    position.setFromMatrixPosition(camera.matrixWorld);
    if (position.y <= level) return;
    // Mirroring through a horizontal plane is small arithmetic: the eye goes to the same x and z
    // below the water, and the view direction and the up vector each have their y negated. The
    // Capture the entire projected water surface. Copying the main projection
    // crops the reflected image during zoom, and out-of-range UVs then repeat
    // its last column/row as long horizontal streaks.
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    forward.y *= -1; up.y *= -1;
    virtualCamera.position.set(position.x, 2 * level - position.y, position.z);
    virtualCamera.up.copy(up);
    gaze.copy(virtualCamera.position).add(forward);
    virtualCamera.lookAt(gaze);
    virtualCamera.near = camera.near;
    virtualCamera.far = camera.far;
    virtualCamera.updateMatrixWorld();
    virtualCamera.matrixWorldInverse.copy(virtualCamera.matrixWorld).invert();
    captureBounds.makeEmpty();
    for(const corner of captureCorners)captureBounds.expandByPoint(capturePoint.copy(corner).applyMatrix4(virtualCamera.matrixWorldInverse));
    captureBounds.getSize(captureSize);
    const padX=Math.max(.01,captureSize.x*.025),padY=Math.max(.01,captureSize.y*.025);
    virtualCamera.left=captureBounds.min.x-padX;virtualCamera.right=captureBounds.max.x+padX;
    virtualCamera.bottom=captureBounds.min.y-padY;virtualCamera.top=captureBounds.max.y+padY;
    virtualCamera.zoom=1;
    // Also refresh the inverse projection used by transmissive glass.
    virtualCamera.updateProjectionMatrix();
    projection.multiplyMatrices(virtualCamera.projectionMatrix, virtualCamera.matrixWorldInverse);

    // The visible sky is a screen-space panorama, which means nothing to a mirrored camera, so a
    // real dome stands in for it. Custom shader materials are not touched by clipping planes, so
    // the sky comes through whole while the island below the waterline is cut away.
    const background = scene.background;
    const planes = renderer.clippingPlanes;
    const previousTarget = renderer.getRenderTarget();
    scene.background = null;
    if (dome) scene.add(dome);
    mesh.visible = false;
    renderer.clippingPlanes = [clipPlane];
    renderer.setRenderTarget(target);
    renderer.render(scene, virtualCamera);
    renderer.setRenderTarget(previousTarget);
    renderer.clippingPlanes = planes;
    mesh.visible = true;
    if (dome) scene.remove(dome);
    scene.background = background;
  }

  function dispose() {
    if(dome){scene.remove(dome);dome.geometry.dispose();dome.material.dispose();}
    target.dispose(); mesh.geometry.dispose(); material.dispose(); scene.remove(mesh);
  }

  const dayWater = new T.Color(waterColor), nightWater = new T.Color('#397b9b');
  return { mesh, update, updateSky, dispose,
    setNight(t) {
      material.uniforms.uWater.value.copy(dayWater).lerp(nightWater, t);
      material.uniforms.uAverage.value=T.MathUtils.lerp(average,.12,t);
      material.uniforms.uChroma.value=T.MathUtils.lerp(.6,.28,t);
    } };
}
