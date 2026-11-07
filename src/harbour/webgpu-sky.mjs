import * as T from 'three/webgpu';
import { Fn, uniform, positionLocal, vec4, vec3, mix, smoothstep, sin, atan, pow, exp, dot, max, texture, uv } from 'three/tsl';
import environmentAsset from './environment-asset.json' with {type:'json'};
import { readEnvironmentResponse } from './environment-data.mjs';

export const DAY_SKY = {
  zenith: '#3f8ed4', horizon: '#f2ead9', ground: '#8fb2c4', sunColor: '#fff8e2',
  sunDirection: [-6, 14, 9], cloudColor: '#ffffff', cloudCover: .5, cloudScale: 6.3,
};
export const NIGHT_SKY = {
  zenith: '#0d1a33', horizon: '#4b5b7c', ground: '#101520', sunColor: '#ffd9a8',
  sunDirection: [-6, 3.5, 9], cloudColor: '#28324a', cloudCover: .45, cloudScale: 5.1,
};

export function createNodeSky(options) {
  const values = {
    zenith: uniform(new T.Color(options.zenith)), horizon: uniform(new T.Color(options.horizon)),
    ground: uniform(new T.Color(options.ground)), sun: uniform(new T.Color(options.sunColor)),
    direction: uniform(new T.Vector3(...options.sunDirection).normalize()),
    cloud: uniform(new T.Color(options.cloudColor)), cover: uniform(options.cloudCover), scale: uniform(options.cloudScale),
  };
  const material = new T.NodeMaterial();
  material.setValues({ side: T.BackSide, depthWrite: false, fog: false, toneMapped: false });
  material.fragmentNode = Fn(() => {
    const d = positionLocal.normalize();
    const colour = mix(values.horizon, values.zenith, smoothstep(0, .62, d.y)).toVar();
    colour.assign(mix(colour, values.ground, smoothstep(0, .34, d.y.negate())));
    const field = sin(d.y.mul(values.scale).add(d.x.mul(1.7))).mul(.5)
      .add(sin(d.z.mul(4.1).sub(d.y.mul(2.6))).mul(.5));
    colour.assign(mix(colour, values.cloud, smoothstep(.25, .95, field).mul(values.cover).mul(smoothstep(.02, .34, d.y))));
    const azimuth = atan(d.x, d.z);
    const skyline = pow(sin(azimuth.mul(7)).mul(.5).add(.5), 8);
    const horizonBand = exp(pow(d.y.sub(.035).div(.18), 2).negate());
    colour.mulAssign(skyline.mul(horizonBand).mul(.11).oneMinus());
    const sun = max(dot(d, values.direction), 0);
    colour.addAssign(values.sun.mul(pow(sun, 900).mul(4).add(pow(sun, 24).mul(.1))));
    return vec4(colour, 1);
  })();
  const mesh = new T.Mesh(new T.SphereGeometry(60, 32, 24), material);
  function set(options) {
    for (const key of ['zenith', 'horizon', 'ground']) values[key].value.set(options[key]);
    values.sun.value.set(options.sunColor); values.cloud.value.set(options.cloudColor);
    values.direction.value.set(...options.sunDirection).normalize();
    values.cover.value = options.cloudCover; values.scale.value = options.cloudScale;
  }
  return { mesh, set, dispose() { mesh.geometry.dispose(); material.dispose(); } };
}

export function mixedSky(amount) {
  const output = {};
  for (const key of Object.keys(DAY_SKY)) {
    if (typeof DAY_SKY[key] === 'string') output[key] = new T.Color(DAY_SKY[key]).lerp(new T.Color(NIGHT_SKY[key]), amount);
    else if (Array.isArray(DAY_SKY[key])) output[key] = DAY_SKY[key].map((value, index) => T.MathUtils.lerp(value, NIGHT_SKY[key][index], amount));
    else output[key] = T.MathUtils.lerp(DAY_SKY[key], NIGHT_SKY[key], amount);
  }
  return output;
}

export async function createNodeEnvironment(renderer,{procedural=false}={}) {
  if(!procedural){
    try {
      const response=await fetch(`${import.meta.env.BASE_URL}lighting/${environmentAsset.file}`);
      const entries=await readEnvironmentResponse(response);
      const textures=entries.map(entry=>{
        const texture=new T.DataTexture(entry.data,entry.width,entry.height,T.RGBAFormat,T.HalfFloatType);
        Object.assign(texture,{mapping:entry.mapping,minFilter:entry.minFilter,magFilter:entry.magFilter,
          colorSpace:entry.colorSpace,flipY:entry.flipY,generateMipmaps:false,needsUpdate:true});
        return texture;
      });
      return createEnvironmentBlend(renderer,textures,()=>textures.forEach(texture=>texture.dispose()));
    } catch(error) {console.warn('Prepared harbour lighting unavailable; generating the original textures.',error);}
  }
  const generator = new T.PMREMGenerator(renderer), skies = [DAY_SKY, NIGHT_SKY], targets = [];
  for (const options of skies) {
    const sky = createNodeSky(options);
    const target = await generator.fromSceneAsync(new T.Scene().add(sky.mesh), 0);
    targets.push(target); sky.dispose();
  }
  generator.dispose();
  return createEnvironmentBlend(renderer,targets.map(target=>target.texture),()=>targets.forEach(target=>target.dispose()),targets);
}

function createEnvironmentBlend(renderer,textures,disposeSources,sourceTargets=[]) {
  const target = new T.RenderTarget(textures[0].image.width,textures[0].image.height, { type: T.HalfFloatType, depthBuffer: false });
  target.texture.mapping = textures[0].mapping;
  const amount = uniform(0), material = new T.NodeMaterial();
  material.setValues({ depthTest: false, depthWrite: false, toneMapped: false });
  material.fragmentNode = mix(texture(textures[0], uv()), texture(textures[1], uv()), amount);
  const quad = new T.QuadMesh(material);
  function update(value) {
    amount.value = value;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target); quad.render(renderer); renderer.setRenderTarget(previous);
  }
  update(0);
  return { texture: target.texture, sourceTargets, update, dispose() { disposeSources();target.dispose();material.dispose(); } };
}
