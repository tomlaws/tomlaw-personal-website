import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync,brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Scene,Raycaster,Vector3,OrthographicCamera} from 'three';
import {buildOriginalWorld} from './build-world.mjs';
import {worldSourceHash} from './world-inputs.mjs';
import {indexStaticBatches} from '../src/harbour/webgpu-geometry.mjs';
import {decodeSceneData,readSceneData} from '../src/harbour/scene-codec.mjs';
import {restorePreparedWorld,restorePreparedWorldAsync} from '../src/harbour/prepared-world.mjs';
import {createCoastalLighting} from '../src/harbour/coastal-world.mjs';
import {createHarbourTime} from '../src/harbour/harbour-time.mjs';
import {fitMapCamera} from '../src/harbour/camera-framing.mjs';
import {homeView} from '../src/harbour/camera-home.mjs';
import {portfolioCameraPose,keepMobileMapVisible,fitScrollFrame} from '../src/harbour/portfolio-camera.mjs';

const asset=JSON.parse(await readFile('src/harbour/world-asset.json','utf8'));
assert.equal(asset.sourceHash,await worldSourceHash(),'Prepared scene matches current source and models');
const bytes=await readFile(`public/world/${asset.file}`),raw=gunzipSync(bytes);
const compact=await readFile(`public/world-br/${asset.brotliFile}`);
assert.deepEqual(brotliDecompressSync(compact),raw,'Brotli transport preserves every byte of the prepared world');
assert.ok(compact.length<bytes.length,'Brotli transport reduces the network payload');
assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256);
const data=decodeSceneData(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
assert.equal((await readSceneData(new Response(bytes))).world.worldSize,data.world.worldSize);
const started=performance.now(),prepared=restorePreparedWorld(data);
assert.ok(prepared.buildings.some(b=>b.name==='Central Plaza') && prepared.buildings.some(b=>b.name==='Great Eagle Centre'));
assert.ok(prepared.buildings.some(b=>b.name==='Sing Ho Finance Building'));
assert.ok(prepared.buildings.some(b=>b.name==='Suns Group Centre'));
assert.ok(!prepared.buildings.some(b=>b.name==='One Island East'||b.name==='Provident Centre'));
console.log('Prepared world restore ms:',Math.round(performance.now()-started));
// Mobile stages are sized by width with a 930 px minimum, so short and tall
// phone windows share the same readable map and hero placement.
for(const [width,height] of [[360,930],[390,930],[450,930],[430,930],[650,1070]]){
  const home=homeView([-2,-1.5]),camera=new OrthographicCamera(-10,10,8,-8,.1,80);
  camera.position.copy(home.position);camera.lookAt(home.target);camera.updateMatrixWorld(true);
  fitMapCamera(camera,prepared.framingPoints,width/height,1.12);
  const shift=(camera.top-camera.bottom)*.55/2;camera.top+=shift;camera.bottom+=shift;
  const pose=portfolioCameraPose(home,0,true),originalWidth=camera.right-camera.left,originalHeight=camera.top-camera.bottom;
  keepMobileMapVisible(camera,prepared.framingPoints,height,pose.zoom);
  camera.zoom=pose.zoom;camera.updateProjectionMatrix();
  const projected=prepared.framingPoints.map(point=>point.clone().project(camera));
  const bottom=Math.max(...projected.map(point=>(1-point.y)*height/2));
  assert.ok(bottom<=height-120+1e-8,`${width}x${height}: complete map stays above canvas edge and hero fade`);
  assert.ok(projected.every(point=>Math.abs(point.x)<=1+1e-8),`${width}x${height}: both water-tile sides remain visible`);
  assert.ok(Math.abs((camera.right-camera.left)-originalWidth)<1e-9&&Math.abs((camera.top-camera.bottom)-originalHeight)<1e-9,'Mobile correction preserves the original view scale');
  assert.equal(camera.zoom,pose.zoom,'Mobile correction preserves full map zoom');
}
// Keep the sea's underside, left edge and landmark crowns inside the fixed
// canvas. Only desktop has the deliberately small right-tip crop.
for(const [width,height] of [[1919,1280],[1920,1280],[1280,870.4],[991,840],[760,840],[650,1070],[450,930],[390,930]]){
  const mobile=width<=650,aspect=width/height,sideSpace=mobile?0:.34;
  const home=homeView([-2,-1.5]),camera=new OrthographicCamera(-10,10,8,-8,.1,80);
  camera.position.copy(home.position);camera.lookAt(home.target);camera.updateMatrixWorld(true);
  fitMapCamera(camera,prepared.framingPoints,aspect*(1-sideSpace),1.12);
  const halfHeight=(camera.top-camera.bottom)/2,centerX=(camera.left+camera.right)/2;
  camera.left=centerX-halfHeight*aspect*(1+sideSpace);camera.right=centerX+halfHeight*aspect*(1-sideSpace);
  const shift=halfHeight*(mobile?.55:Math.min(.2,Math.max(0,(aspect-1.1)*.3)));
  camera.top+=shift;camera.bottom+=shift;
  if(mobile)keepMobileMapVisible(camera,prepared.framingPoints,height,portfolioCameraPose(home,0,true).zoom);
  const frame=Object.freeze({left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom});
  const poses=[],zooms=[];
  for(const progress of [0,.05,.15,.3,.5,.75,1,0]){
    const pose=portfolioCameraPose(home,progress,mobile);
    const rise=Math.min(50,(height-(mobile?80:width<=1000?83:105))*.06)*pose.phase;
    camera.position.copy(pose.position);camera.lookAt(home.target);camera.zoom=pose.zoom;
    fitScrollFrame(camera,prepared.framingPoints,frame,width,height,rise,pose.zoomFactor);camera.updateProjectionMatrix();
    const projected=prepared.framingPoints.map(point=>point.clone().project(camera));
    const rightCrop=mobile?0:Math.min(28,width*.025);
    assert.ok(projected.every(point=>point.x>-1&&point.x<=1+2*rightCrop/width+1e-9&&Math.abs(point.y)<1),`${width}x${height} scroll ${progress}: only the intended right tip may leave the fixed canvas`);
    if(mobile){
      assert.ok(projected.every(point=>point.x<1),'Every mobile map corner stays inside the stage');
      assert.ok(Math.abs(Math.min(...projected.map(point=>point.x))+Math.max(...projected.map(point=>point.x)))<1e-9,'The mobile map is centered');
    }else assert.ok(Math.abs(Math.max(...projected.map(point=>point.x))-(1+2*rightCrop/width))<1e-9,'The desktop right-tip crop stays fixed before and throughout scrolling');
    const ys=projected.map(point=>(1-point.y)*height/2),bottom=Math.max(...ys),top=Math.min(...ys);
    assert.ok(bottom<=height-Math.min(12,width*.03,height*.03)-Math.min(rise,height*.3)+1e-7,'Leave room beneath the full water tile for upward parallax');
    assert.ok(camera.zoom<=pose.zoom,'Limit zoom only when needed to fit the complete map');
    if(mobile&&progress===0)assert.ok(bottom<=height-120+1e-7,'Retain the mobile intro framing');
    poses.push((top+bottom)/2);
    zooms.push(camera.zoom);
  }
  assert.ok(poses[6]<poses[0]-20,`${width}x${height}: the map moves upward during scroll`);
  assert.ok(Math.abs(poses[7]-poses[0])<1e-9,'Scrolling back restores the original framing without accumulated drift');
  for(let i=1;i<7;i++)assert.ok(Math.abs(zooms[i]-zooms[0])<1e-12,`${width}x${height}: fitted zoom stays fixed throughout the scroll`);
}
const original=await buildOriginalWorld();indexStaticBatches(original.root);
for(const world of [original,prepared]){
  world.root.updateMatrixWorld(true);
  for(const [x,z] of [[-2.85,7.85],[2.93,7.83],[10.1,9.25]]){
    const ray=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0));
    const hits=ray.intersectObject(world.root.getObjectByName('Coastal static batches'),true);
    assert.ok(hits.length,'Coastal paving remains continuous');
    assert.ok(Math.abs(hits[0].point.y-world.land.top)<1e-5,`Coastal forecourt (${x}, ${z}) is flush with the surrounding paving`);
  }
}
original.boats.filter(boat=>boat.design==='star').forEach(({g})=>{for(const child of [...g.children])if(child.isMesh&&!child.visible)child.removeFromParent();});
const meshes=world=>{const result=[];world.root.traverse(object=>{if(object.isMesh)result.push(object);});return result;};
const actual=meshes(prepared),expected=meshes(original);
assert.equal(actual.length,expected.length);
const near=(a,b,label,epsilon=1e-11)=>{assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<=epsilon,`${label} ${i}: ${a[i]} vs ${b[i]}`);};
for(let index=0;index<actual.length;index++){
  const [a,b]=[actual[index],expected[index]];assert.equal(a.name,b.name);
  const ag=a.geometry.index?a.geometry.toNonIndexed():a.geometry,bg=b.geometry.index?b.geometry.toNonIndexed():b.geometry;
  for(const [key,attribute] of Object.entries(bg.attributes)){
    const av=ag.attributes[key].array,bv=attribute.array;
    assert.equal(av.byteLength,bv.byteLength,`${a.name} ${key} byte length`);
    assert.equal(Buffer.compare(Buffer.from(av.buffer,av.byteOffset,av.byteLength),Buffer.from(bv.buffer,bv.byteOffset,bv.byteLength)),0,`${a.name} ${key}: no vertex precision or geometry loss`);
  }
  if(ag!==a.geometry)ag.dispose();if(bg!==b.geometry)bg.dispose();
}
for(const time of [0,.5,12,31,68]){
  original.animate(time);prepared.animate(time);
  for(let index=0;index<actual.length;index++){
    const [a,b]=[actual[index],expected[index]];
    near(a.matrixWorld.elements,b.matrixWorld.elements,`${a.name} animated world transform`);
    assert.equal(a.visible,b.visible);
    if(a.isInstancedMesh)near(a.instanceMatrix.array,b.instanceMatrix.array,`${a.name} animated instances`,1e-6);
    if(a.name==='Flexible inter-car gangway')near(a.geometry.attributes.position.array,b.geometry.attributes.position.array,'Continuous articulated tram joint',1e-6);
  }
}
for(const night of [0,.5,1]){
  const controllers=[original,prepared].map(world=>{const scene=new Scene();scene.add(world.root);return createHarbourTime(scene,world,createCoastalLighting(scene,world));});
  controllers.forEach(controller=>controller.set(night));
  for(let index=0;index<actual.length;index++){
    const aa=Array.isArray(actual[index].material)?actual[index].material:[actual[index].material];
    const bb=Array.isArray(expected[index].material)?expected[index].material:[expected[index].material];
    for(let material=0;material<aa.length;material++){
      for(const key of ['color','emissive','specularColor','attenuationColor','sheenColor'])if(bb[material][key])near(aa[material][key].toArray(),bb[material][key].toArray(),`${key}: preserved linear colour`);
      for(const key of ['roughness','metalness','opacity','emissiveIntensity','transmission','ior','clearcoat'])if(bb[material][key]!==undefined)assert.ok(Math.abs(aa[material][key]-bb[material][key])<1e-12,`${key}: identical time-of-day behaviour`);
      const shaders=[aa[material],bb[material]].map(finish=>{
        const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <emissivemap_fragment>'};
        finish.onBeforeCompile(shader);return [shader.vertexShader,shader.fragmentShader];
      });
      assert.deepEqual(shaders[0],shaders[1],'Prepared scenes retain the original window, vehicle and ferry WebGL shader hooks');
    }
  }
}
console.log(`Prepared world: ${actual.length} meshes retain every expanded vertex/attribute; five animation phases and day/dusk/night materials match.`);

const sliced = await restorePreparedWorldAsync(data);
prepared.animate(0); sliced.animate(0);
const meshList = root => {const result=[]; root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
const syncMeshes=meshList(prepared.root), slicedMeshes=meshList(sliced.root);
assert.equal(slicedMeshes.length,syncMeshes.length,'Yielded parsing preserves every mesh');
for(let i=0;i<syncMeshes.length;i++) {
  const a=syncMeshes[i],b=slicedMeshes[i];
  assert.equal(a.name,b.name);
  assert.equal(a.material?.uuid,b.material?.uuid);
  for(const key of Object.keys(a.geometry.attributes)) assert.deepEqual(b.geometry.attributes[key].array,a.geometry.attributes[key].array,`${a.name} ${key} is unchanged`);
}

