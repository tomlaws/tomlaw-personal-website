import assert from 'node:assert/strict';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, OrthographicCamera, Scene, Vector3, WebGLRenderTarget } from 'three';
import { staticShadingMeshes, staticShadingGeometry, createStaticShadingCache } from '../src/harbour/static-shading-cache.mjs';
import { cullInvisibleLocalLighting } from '../src/harbour/local-light-visibility.mjs';

const scene=new Scene(),root=new Group();scene.add(root);
const material=new MeshStandardMaterial(),geometry=new BoxGeometry(2,3,4);
const fixed=new Mesh(geometry,material);fixed.position.set(3,2,1);fixed.scale.x=-1;root.add(fixed);
const car=new Group(),ferry=new Group(),tram=new Group(),wheel=new Group(),tree=new Group(),wake=new Group();
for(const group of [car,ferry,tram,wheel,tree,wake]){group.add(new Mesh(geometry,material));root.add(group);}
root.userData.animateShips={state:{ferryWake:wake}};
const glass=new Mesh(geometry,new MeshStandardMaterial({transparent:true,opacity:.5}));root.add(glass);
const foliage=new InstancedMesh(geometry,material,1);root.add(foliage);
const hidden=new Group();hidden.visible=false;hidden.add(new Mesh(geometry,material));root.add(hidden);
const helper=new Mesh(geometry,new MeshStandardMaterial({visible:false}));root.add(helper);
scene.updateMatrixWorld(true);
const meshes=staticShadingMeshes({root,cars:[{g:car}],boats:[{g:ferry}],trees:[tree],peakTram:{moving:tram},observationWheel:{group:wheel}});
assert.deepEqual([...meshes],[fixed],'Every animated hierarchy and transparent/instanced surface stays live');
const proxyGeometry=staticShadingGeometry(meshes);
assert.equal(proxyGeometry.index.count,geometry.index.count);
assert.deepEqual([...proxyGeometry.index.array.slice(0,3)],[geometry.index.getX(0),geometry.index.getX(2),geometry.index.getX(1)],'Preserve native front-face orientation under mirrored transforms');
for(let i=0;i<geometry.attributes.position.count;i++){
  const original=new Vector3().fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(fixed.matrixWorld);
  const merged=new Vector3().fromBufferAttribute(proxyGeometry.attributes.position,i);
  assert.ok(original.distanceTo(merged)<1e-6,'Keep the actual geometry and depth instead of painting a flat picture');
}
proxyGeometry.dispose();

let time=0,allowCapture=true,allowRefresh=true,target=null,draws=[];
const camera=new OrthographicCamera(-10,10,8,-8,.1,100);camera.position.set(0,8,10);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const destination=new WebGLRenderTarget(100,200,{samples:2});
const renderer={autoClear:false,setRenderTarget(value){target=value;},render(value,view){
  const names=[];value.traverseVisible(o=>{if(o.isMesh)names.push(o);});
  draws.push({target,names,view});
}};
const cache=createStaticShadingCache(scene,camera,meshes,{now:()=>time,canCapture:()=>allowCapture,canRefresh:()=>allowRefresh});
function render(){draws=[];return cache.render(renderer,destination);}
assert.equal(render(),true);assert.equal(draws.length,2);
assert.deepEqual(draws[0].names,[fixed],'Capture the original PBR shading without animated occluders');
assert.ok(!draws[1].names.includes(fixed));assert.ok(draws[1].names.includes(car.children[0]));assert.ok(draws[1].names.includes(glass));
const proxy=draws[1].names.find(o=>o.name==='Cached static city shading');
assert.ok(proxy);assert.equal(proxy.geometry.index.count,geometry.index.count);
assert.equal(proxy.material.depthWrite,true);assert.equal(proxy.material.transparent,false);
assert.ok(proxy.material.fragmentShader.includes('shaded.rgb/max(shaded.a,'),'Do not apply silhouette coverage twice');
assert.ok(proxy.material.fragmentShader.includes('<clipping_planes_fragment>'),'Reflection proxy respects the real water clipping plane');
assert.equal(proxy.visible,false);assert.equal(fixed.visible,true);assert.equal(renderer.autoClear,false);assert.equal(target,destination);
assert.equal(fixed.material,material,'Original PBR material and hooks are not replaced');
time=33;render();assert.equal(draws.length,1);assert.equal(cache.refreshed,false);
allowRefresh=false;time=120;render();assert.equal(draws.length,1,'Stagger lighting capture away from a reflection frame');
time=205;render();assert.equal(draws.length,2,'Bound the maximum age of moving headlight illumination');
allowRefresh=true;time=206;camera.position.x++;render();assert.equal(draws.length,2,'View changes invalidate before rendering the next frame');
time++;cache.invalidate();render();assert.equal(draws.length,2,'Day/night changes invalidate immediately');
time++;destination.setSize(200,300);render();assert.equal(draws.length,2);assert.equal(draws[0].target.width,200);
allowCapture=false;time++;assert.equal(render(),false);assert.equal(draws.length,0,'Let a full scene render populate a changed shadow map');
allowCapture=true;time++;render();assert.equal(draws.length,2);
const normalRender=renderer.render;renderer.render=()=>{throw Error('Fixture render failed');};
cache.invalidate();assert.throws(render,/Fixture render failed/);
assert.equal(fixed.visible,true);assert.equal(proxy.visible,false);assert.equal(glass.visible,true);assert.equal(renderer.autoClear,false);assert.equal(target,destination);
renderer.render=normalRender;cache.dispose();cache.dispose();assert.equal(proxy.parent,null);assert.equal(render(),false);
destination.dispose();

let originalCalls=0;material.onBeforeCompile=shader=>{originalCalls++;shader.uniforms.originalUniform={value:7};};material.customProgramCacheKey=()=> 'original-lighting-hook';
assert.ok(cullInvisibleLocalLighting(scene)>0);
const shader={uniforms:{},fragmentShader:'#include <lights_fragment_begin>'};material.onBeforeCompile(shader,renderer);
assert.equal(originalCalls,1);assert.equal(shader.uniforms.originalUniform.value,7);
assert.equal((shader.fragmentShader.match(/if \( directLight.visible \)/g)??[]).length,2,'Skip only zero-contribution point/spot BRDF work');
assert.ok(shader.fragmentShader.includes('getPointLightInfo')&&shader.fragmentShader.includes('getSpotLightInfo')&&shader.fragmentShader.includes('getDirectionalLightInfo'));
assert.ok(shader.fragmentShader.includes('getPointShadow')&&shader.fragmentShader.includes('getShadow'),'Keep original shadow evaluation and Three BRDF');
assert.match(material.customProgramCacheKey(),/^original-lighting-hook\|/);
geometry.dispose();material.dispose();glass.material.dispose();
helper.material.dispose();
console.log('Static shading: original geometry/depth/MSAA, live animation exclusions, bounded lighting updates, view/lighting invalidation, clipping, hook preservation and failure cleanup passed.');
