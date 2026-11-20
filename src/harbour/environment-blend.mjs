import * as T from 'three';

// Blend prefiltered radiance, keeping every roughness level continuous at dusk.
// Only redraw on slider input; there is no extra per-frame reflection capture.
export function createEnvironmentBlend(renderer,day,night){
  const target=new T.WebGLRenderTarget(day.image.width,day.image.height,{type:T.HalfFloatType,depthBuffer:false});
  target.texture.mapping=day.mapping;
  const uniforms={day:{value:day},night:{value:night},amount:{value:0}};
  const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D day,night;uniform float amount;varying vec2 vUv;void main(){gl_FragColor=mix(texture2D(day,vUv),texture2D(night,vUv),amount);}'});
  const scene=new T.Scene();scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
  const camera=new T.Camera();
  function update(amount){uniforms.amount.value=amount;const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(previous);}
  update(0);return {texture:target.texture,update};
}
