import * as T from 'three';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildOriginalWorld} from './build-world.mjs';
import {worldSourceHash} from './world-inputs.mjs';
import {indexStaticBatches} from '../src/harbour/webgpu-geometry.mjs';
import {encodeSceneData} from '../src/harbour/scene-codec.mjs';
import {indexGeometryExactly} from '../src/harbour/exact-geometry.mjs';

const world=await buildOriginalWorld();indexStaticBatches(world.root);
// The ferry keeps hidden per-part modelling helpers alongside the rendered
// finish batches. They are not animated or shown by the portfolio.
world.boats.filter(boat=>boat.design==='star').forEach(({g})=>{
  for(const child of [...g.children])if(child.isMesh&&!child.visible)child.removeFromParent();
});
const indexed=new Map();
world.root.traverse(object=>{
  const geometry=object.geometry;
  if(!geometry||geometry.index||geometry.attributes.position.usage===T.DynamicDrawUsage)return;
  if(!indexed.has(geometry))indexed.set(geometry,indexGeometryExactly(geometry));
  object.geometry=indexed.get(geometry);
});
const geometries=new Set(),materials=new Set();let objectIndex=0;
world.root.traverse(object=>{
  object.uuid=`harbour-object-${objectIndex++}`;
  if(object.isLight&&object.shadow?.camera)object.shadow.camera.uuid=`${object.uuid}-shadow-camera`;
  if(object.geometry&&!geometries.has(object.geometry)){geometries.add(object.geometry);object.geometry.uuid=`harbour-geometry-${geometries.size}`;}
  for(const material of Array.isArray(object.material)?object.material:[object.material])if(material&&!materials.has(material)){
    materials.add(material);material.uuid=`harbour-material-${materials.size}`;
  }
});
for(const material of Object.values(world.materials))if(!materials.has(material)){materials.add(material);material.uuid=`harbour-material-${materials.size}`;}
const transforms={},exactMaterials={};
world.root.traverse(object=>{transforms[object.uuid]={position:object.position.toArray(),rotation:object.rotation.toArray(),scale:object.scale.toArray()};});
for(const material of materials){
  const colours={};for(const [key,value] of Object.entries(material))if(value?.isColor)colours[key]=value.toArray();
  exactMaterials[material.uuid]=colours;
}
function captureNight(object){
  const targets=[];
  object.traverse(part=>{
    if(part.isLight)targets.push({target:part,property:'intensity',material:false});
    for(const material of Array.isArray(part.material)?part.material:[part.material])if(material&&!targets.some(entry=>entry.target===material))targets.push({target:material,property:'emissiveIntensity',material:true});
  });
  object.userData.setNight(0);const start=targets.map(({target,property})=>target[property]);
  object.userData.setNight(1);
  const values=targets.flatMap(({target,property,material},index)=>start[index]!==target[property]?[{id:target.uuid,property,material,from:start[index],to:target[property]}]:[]);
  object.userData.setNight(0);return {node:object.uuid,values};
}
const node=object=>object.uuid;
const ships=world.root.userData.animateShips.state;
const metadata={
  materials:Object.fromEntries(Object.entries(world.materials).map(([key,material])=>[key,material.uuid])),
  buildings:world.buildings.map(({group,...building})=>({...building,node:node(group)})),
  cars:world.cars.map(({g,...car})=>({...car,node:node(g)})),
  boats:world.boats.map(({g,...boat})=>({...boat,node:node(g)})),
  nightBindings:[...world.cars.map(car=>car.g),...world.boats.map(boat=>boat.g)].filter(object=>object.userData.setNight).map(captureNight),
  trees:world.trees.map(node),
  tram:{moving:node(world.peakTram.moving),wheelContact:world.peakTram.wheelContact,cabinScale:[1.3,1.06,.88],
    heights:{low:world.peakTram.route.grade(0),high:world.peakTram.route.grade(1)},
    cars:world.peakTram.cars.map(({g,cabins,joint,...car})=>({...car,node:node(g),joint:node(joint),cabins:cabins.map(({body,offset})=>({node:node(body),offset}))})),
  },
  wheel:{node:node(world.observationWheel.group),cabins:world.observationWheel.cabins.map(node),radius:world.observationWheel.radius,gondolas:world.observationWheel.gondolas,speed:world.observationWheel.speed},
  ships:{ferryWake:node(ships.ferryWake),ripples:ships.ripples.map(({ring,scale,...ripple})=>({...ripple,node:node(ring),scale:scale.toArray()}))},
  ocean:{...world.ocean,lower:node(world.ocean.lower),upper:node(world.ocean.upper),sides:node(world.ocean.sides)},
  land:{...world.land,bodyBounds:{min:world.land.bodyBounds.min.toArray(),max:world.land.bodyBounds.max.toArray()}},
  road:{parameters:{x:-5.65,startZ:world.worldBounds.minZ,turnZ:4,endX:world.worldBounds.maxX,radius:1.2,y:.235},width:world.road.width,laneOffset:world.road.laneOffset,closed:false,crossings:[]},
  framingPoints:world.framingPoints.map(point=>point.toArray()),
  streetLamps:world.root.userData.streetLamps.map(point=>point.toArray()),
  windowSpillSources:world.root.userData.windowSpillSources.map(({position,colour,buildingName})=>({position:position.toArray(),colour:colour.toArray(),buildingName})),
  worldSize:world.worldSize,worldWidth:world.worldWidth,worldDepth:world.worldDepth,worldCenter:world.worldCenter,worldBounds:world.worldBounds,statistics:world.statistics,
};
// BufferGeometryLoader must load existing vertex data rather than reconstructing
// parameterised primitives (including addons such as RoundedBoxGeometry).
const replacements=new Map();
for(const geometry of geometries){const flat=new T.BufferGeometry().copy(geometry);flat.uuid=geometry.uuid;delete flat.parameters;replacements.set(geometry,flat);}
world.root.traverse(object=>{if(object.geometry)object.geometry=replacements.get(object.geometry);});
const scene=world.root.toJSON();
const known=new Set(scene.materials.map(material=>material.uuid));
for(const material of materials)if(!known.has(material.uuid))scene.materials.push(material.toJSON());
const sourceHash=await worldSourceHash();
const raw=encodeSceneData({scene,world:metadata,exactMaterials,transforms});
const sha256=createHash('sha256').update(new Uint8Array(raw)).digest('hex');
const file=`harbour-world-${sha256.slice(0,12)}.bin.gz`,compressed=gzipSync(new Uint8Array(raw),{level:9});
const old=await readFile('src/harbour/world-asset.json','utf8').then(JSON.parse).catch(()=>null);
await mkdir('public/world',{recursive:true});await writeFile(`public/world/${file}`,compressed);
await writeFile('src/harbour/world-asset.json',JSON.stringify({version:1,file,sourceHash,sha256},null,2)+'\n');
if(old&&old.file!==file&&/^harbour-world-[a-f0-9]{12}\.bin\.gz$/.test(old.file))await unlink(`public/world/${old.file}`).catch(()=>{});
console.log(JSON.stringify({file,bytes:compressed.length,rawBytes:raw.byteLength,objects:objectIndex,geometries:geometries.size}));
