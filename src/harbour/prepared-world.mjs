import * as T from 'three';
import {coastalRoad} from './coastal-road.mjs';
import {peakTramRoute,bindPeakTramMotion} from './peak-tram.mjs';
import {bindObservationWheelMotion} from './wheel-motion.mjs';
import {createHarbourMotion} from './harbour-motion.mjs';
import {createCanopyInstances} from './canopy-instances.mjs';
import {prepareVehicleGlazing,prepareFerryGlazing} from './legacy-glazing.mjs';

// Load the complete world, then bind the original continuous animation maths.
// This is a live scene, not a rendered picture or sampled animation playback.
export function restorePreparedWorld({scene,world:data,exactMaterials,transforms}){
  const root=new T.ObjectLoader().parse(scene),objects=new Map(),materials=new Map();
  root.traverse(object=>{
    objects.set(object.uuid,object);
    for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.set(material.uuid,material);
    const pose=transforms[object.uuid];
    if(pose){object.position.fromArray(pose.position);object.rotation.fromArray(pose.rotation);object.scale.fromArray(pose.scale);object.updateMatrix();}
  });
  // Palette entries that have no visible mesh still receive time-of-day updates.
  for(const entry of scene.materials)if(!materials.has(entry.uuid))materials.set(entry.uuid,new T.MaterialLoader().parse(entry));
  for(const [id,colours] of Object.entries(exactMaterials)){
    const material=materials.get(id);if(!material)continue;
    for(const [key,value] of Object.entries(colours))material[key].fromArray(value);
  }
  for(const material of materials.values()){
    if(['Bus reflective illuminated glass','Taxi reflective tinted glass'].includes(material.name))prepareVehicleGlazing(material);
    if(material.name==='Star Ferry warm passenger glazing')prepareFerryGlazing(material);
  }
  const object=id=>{const value=objects.get(id);if(!value)throw new Error(`Missing prepared scene object ${id}`);return value;};
  const records=list=>list.map(({node,...record})=>({...record,group:object(node)}));
  const buildings=records(data.buildings);
  const cars=data.cars.map(({node,...car})=>({...car,g:object(node)}));
  const boats=data.boats.map(({node,...boat})=>({...boat,g:object(node)}));
  const trees=data.trees.map(object);
  for(const binding of data.nightBindings){
    object(binding.node).userData.setNight=amount=>{
      const t=T.MathUtils.clamp(amount,0,1);
      for(const {id,property,from,to,material} of binding.values)(material?materials.get(id):object(id))[property]=T.MathUtils.lerp(from,to,t);
    };
  }
  const route=peakTramRoute(()=>{throw new Error('Prepared route needs no terrain reconstruction');},data.tram.heights);
  const peakTram={route,moving:object(data.tram.moving),cars:data.tram.cars.map(({node,cabins,joint,...car})=>({...car,g:object(node),joint:object(joint),cabins:cabins.map(({node,offset})=>({body:object(node),offset}))}))};
  Object.assign(peakTram,bindPeakTramMotion({...peakTram,wheelContact:data.tram.wheelContact,cabinScale:new T.Vector3(...data.tram.cabinScale)}));
  const observationWheel={...data.wheel,group:object(data.wheel.node),cabins:data.wheel.cabins.map(object)};
  const wheelMotion=bindObservationWheelMotion(observationWheel);
  observationWheel.animate=time=>wheelMotion(time,observationWheel.speed);
  const animateShips=createHarbourMotion(boats,{waterLevel:data.ocean.level,
    ferryWake:object(data.ships.ferryWake),
    ripples:data.ships.ripples.map(({node,scale,...ripple})=>({...ripple,ring:object(node),scale:new T.Vector3(...scale)})),
  });
  root.getObjectByName('Instanced tree canopies')?.removeFromParent();
  const animateCanopies=createCanopyInstances(root,trees);
  const curve=coastalRoad(data.road.parameters),landRise=data.land.rise;
  const road={...data.road,length:curve.getLength(),segments:curve.segments,closestPoint:curve.closestPoint,
    sample(u,lane=0){const point=curve.getPointAt(u),tangent=curve.getTangentAt(u);point.y+=landRise;
      const side=new T.Vector3(-tangent.z,0,tangent.x);
      return {point:point.addScaledVector(side,lane),tangent,heading:Math.atan2(-tangent.z,tangent.x)};
    },
  };
  root.userData.streetLamps=data.streetLamps.map(point=>new T.Vector3(...point));
  root.userData.windowSpillSources=data.windowSpillSources.map(({position,colour,buildingName})=>({position:new T.Vector3(...position),colour:new T.Color().fromArray(colour),buildingName}));
  root.userData.animateShips=animateShips;
  const palette=Object.fromEntries(Object.entries(data.materials).map(([key,id])=>[key,materials.get(id)]));
  const world={root,materials:palette,buildings,cars,boats,trees,observationWheel,peakTram,road,
    framingPoints:data.framingPoints.map(point=>new T.Vector3(...point)),
    ocean:{...data.ocean,lower:object(data.ocean.lower),upper:object(data.ocean.upper),sides:object(data.ocean.sides)},
    land:{...data.land,bodyBounds:new T.Box3(new T.Vector3(...data.land.bodyBounds.min),new T.Vector3(...data.land.bodyBounds.max))},
    worldSize:data.worldSize,worldWidth:data.worldWidth,worldDepth:data.worldDepth,worldCenter:data.worldCenter,worldBounds:data.worldBounds,
    windows:[],places:[],clouds:[],piers:[],interiorLights:[],statistics:data.statistics,
    cyberpunk:{materials:{cyan:palette.teal,magenta:palette.pink,violet:palette.violet,acid:palette.sage},setGlow(){}},
  };
  let lastTime=0;
  world.animate=time=>{
    lastTime=time;peakTram.animate(time);
    for(const car of cars){
      const u=T.MathUtils.euclideanModulo(car.phase+time/road.length*.56*car.dir,1);
      const {point,heading}=road.sample(u,car.dir*-road.laneOffset);car.progress=u;
      const inset=(car.length/2+.08)/road.length;car.g.visible=u>inset&&u<1-inset;
      car.g.position.copy(point);car.g.position.y=.246+landRise;car.g.rotation.y=heading+(car.dir<0?Math.PI:0);
    }
    animateShips(time);observationWheel.animate(time);
    trees.forEach((tree,index)=>tree.rotation.z=Math.sin(time*.6+index)*.018);
    animateCanopies();root.updateMatrixWorld(true);
  };
  Object.defineProperty(world,'time',{get:()=>lastTime});world.animate(0);
  return world;
}
