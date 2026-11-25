import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene, OrthographicCamera, Vector3} from 'three';
import {readSceneData} from '../src/harbour/scene-codec.mjs';
import {restorePreparedWorld} from '../src/harbour/prepared-world.mjs';
import {createMobileGlazing} from '../src/harbour/mobile-glazing.mjs';
import {createReflectionSchedule} from '../src/harbour/frame-pacing.mjs';
import {createWaterReflection} from '../src/harbour/water-reflection.mjs';
import {createNodeWaterReflection} from '../src/harbour/webgpu-reflection.mjs';
import {ClippingGroup} from 'three/webgpu';
import {createCoastalLighting} from '../src/harbour/coastal-lighting.mjs';
import {createHarbourTime} from '../src/harbour/harbour-time.mjs';

const asset=JSON.parse(await readFile('src/harbour/world-asset.json'));
const data=await readSceneData(new Response(await readFile('public/world/'+asset.file)));
const world=restorePreparedWorld(data),ferry=world.boats.find(boat=>boat.design==='star');
assert.ok(ferry,'Use the actual animated Star Ferry');
const litScene=new Scene();litScene.add(world.root);
const timeLighting=createHarbourTime(litScene,world,createCoastalLighting(litScene,world));
timeLighting.set(0);
const nightOnly=[...timeLighting.lamps,...timeLighting.trackLights,...timeLighting.wheelUplights,
  timeLighting.wheelCabinFill,...timeLighting.tramInteriors];
assert.ok(nightOnly.length>15);
for(const light of nightOnly){assert.equal(light.intensity,0);assert.equal(light.visible,false,'Zero-output night lights are absent from daylight shaders');}
timeLighting.set(1);
for(const light of nightOnly){assert.ok(light.intensity>0);assert.equal(light.visible,true,'Every original night light returns');}
timeLighting.set(0);
const materials=new Map(),geometry=new Map();
const appearance=material=>JSON.stringify({color:material.color?.toArray(),emissive:material.emissive?.toArray(),
  metalness:material.metalness,roughness:material.roughness,clearcoat:material.clearcoat,
  clearcoatRoughness:material.clearcoatRoughness,envMapIntensity:material.envMapIntensity,
  opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
world.root.traverse(object=>{
  if(!object.isMesh)return;
  geometry.set(object,object.geometry);
  for(const material of Array.isArray(object.material)?object.material:[object.material])
    materials.set(material,{transmission:material.transmission,appearance:appearance(material),hook:material.onBeforeCompile,key:material.customProgramCacheKey});
});
const glazing=createMobileGlazing(world.root);
const refractive=[...materials].filter(([material])=>material.transmission>0);
assert.ok(refractive.length>0);
assert.equal(glazing.setWidth(430),refractive.length,'Phone glass omits the extra refraction capture');
assert.equal(glazing.setWidth(430),0,'Unchanged viewport does not recompile glass');
for(const [material,saved] of materials){
  assert.equal(material.transmission,saved.transmission>0?0:saved.transmission);
  assert.equal(appearance(material),saved.appearance,'Tint, sky reflection, clearcoat and interior light stay intact');
  assert.equal(material.onBeforeCompile,saved.hook);assert.equal(material.customProgramCacheKey,saved.key);
}
for(const [mesh,original]of geometry)assert.equal(mesh.geometry,original,'Every geometry object is retained');
timeLighting.set(1);
for(const [material]of refractive)assert.equal(material.transmission,0,'Live night lighting cannot restore the expensive phone capture');
timeLighting.set(0);
assert.equal(glazing.setWidth(1440),refractive.length,'Desktop restores original refraction');
for(const [material,saved]of materials)assert.equal(material.transmission,saved.transmission);
glazing.setWidth(430);

for(const fps of [3,6,10,24,30,60]){
  const schedule=createReflectionSchedule();let previous=-2,captures=0;
  for(let frame=0;frame<fps*8;frame++){
    if(schedule(430,frame===0,frame*1000/fps,true)){
      assert.ok(frame-previous>=2,'Slow rendering never triggers routine captures on adjacent frames');
      previous=frame;captures++;
    }
  }
  assert.ok(captures>0&&captures<=Math.ceil(fps*8/2));
  if(fps>=24)assert.ok(captures>=50&&captures<=65,'Moving reflections retain approximately 8 Hz on phones');
}
const invalidated=createReflectionSchedule();
assert.equal(invalidated(430,true,0),true);
assert.equal(invalidated(430,true,1),true,'Camera and lighting changes update immediately');
assert.equal(invalidated(430,false,500,false),false,'Reduced motion does not cause routine redraws');
assert.equal(invalidated(430,true,501,false),true,'Reduced motion still updates changed lighting');

for(const backend of ['webgl','webgpu']){
  const scene=new Scene(),camera=new OrthographicCamera(-18,18,14,-14,.1,100);
  camera.position.set(-18,17,18);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  let target=null;const captures=[];
  const renderer={getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},
    render(rendered,view){
      rendered.updateMatrixWorld(true);
      const position=ferry.g.getWorldPosition(new Vector3());
      captures.push({position:position.toArray(),projected:position.clone().project(view).toArray()});
      assert.notEqual(view,camera,'Capture uses the actual mirrored camera');
      assert.equal(target.width,512);
    }};
  let mirror;
  if(backend==='webgpu'){
    const clip=new ClippingGroup();clip.add(world.root);scene.add(clip);
    mirror=createNodeWaterReflection(renderer,scene,camera,world,clip,{resolution:512});
  }else{
    scene.add(world.root);
    mirror=createWaterReflection(renderer,scene,camera,{level:world.ocean.level,size:world.worldSize,center:world.worldCenter,resolution:512});
  }
  const schedule=createReflectionSchedule();
  for(let frame=0;frame<240;frame++){
    world.animate(frame/30);
    if(schedule(430,frame===0,frame*1000/30,true))mirror.update();
  }
  assert.ok(captures.length>=50,'The live ferry is repeatedly rendered into the water reflection');
  const first=captures[0],last=captures.at(-1);
  assert.ok(new Vector3().fromArray(first.position).distanceTo(new Vector3().fromArray(last.position))>1,'The actual ferry moves during the capture sequence');
  assert.notDeepEqual(first.projected,last.projected,'Its reflected position follows its movement');
  assert.equal(target,null,'Reflection restores the main render target');
  mirror.dispose();world.root.removeFromParent();
}
console.log('Live reflections: reflective mobile glass retains original finishes/hooks; desktop refraction restores; frame limits prevent feedback; actual ferry motion is captured in both backends.');
