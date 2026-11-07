import * as T from 'three';
import {WHEEL_LIGHT_COLOUR} from './wheel-uplights.mjs';
import {TRAM_TRACK_LIGHTS,tramTrackLightPose} from './tram-track-mist.mjs';

export function createHarbourTime(scene,world,lighting){
  const night={value:0},materials=new Set(),softWindows=new Set();
  world.root.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(material.isMeshStandardMaterial&&object.geometry.attributes.harbourEmission)materials.add(material);
    if(object.geometry.attributes.harbourLightUV)softWindows.add(material);
  }});
  for(const material of materials){
    const soften=softWindows.has(material);
    const wheelRange=material.userData.wheelUplightRange;
    material.onBeforeCompile=shader=>{
      shader.uniforms.harbourNight=night;
      shader.vertexShader='attribute vec3 harbourEmission;varying vec3 vHarbourEmission;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vHarbourEmission=harbourEmission;`);
      shader.fragmentShader='uniform float harbourNight;varying vec3 vHarbourEmission;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=vHarbourEmission*harbourNight;`);
      if(soften){
        shader.vertexShader='attribute vec2 harbourLightUV;attribute float harbourRoundWindow;varying vec2 vHarbourLightUV;varying float vHarbourRoundWindow;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('vHarbourEmission=harbourEmission;',
          'vHarbourEmission=harbourEmission;vHarbourLightUV=harbourLightUV;vHarbourRoundWindow=harbourRoundWindow;');
        shader.fragmentShader='varying vec2 vHarbourLightUV;varying float vHarbourRoundWindow;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('totalEmissiveRadiance+=vHarbourEmission*harbourNight;',`
          vec2 paneEdge=min(vHarbourLightUV,1.-vHarbourLightUV);
          float diffusion=smoothstep(0.,.20,paneEdge.x)*smoothstep(0.,.18,paneEdge.y);
          float roundDiffusion=1.-smoothstep(.34,.50,length(vHarbourLightUV-.5));
          diffusion=mix(diffusion,roundDiffusion,step(.5,vHarbourRoundWindow));
          totalEmissiveRadiance+=vHarbourEmission*harbourNight*diffusion;`);
      }
      if(wheelRange){
        shader.uniforms.harbourWheelRange={value:new T.Vector2(...wheelRange)};
        shader.vertexShader='varying float vWheelWorldY;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('vHarbourEmission=harbourEmission;',
          'vHarbourEmission=harbourEmission;vWheelWorldY=(modelMatrix*vec4(transformed,1.)).y;');
        shader.fragmentShader='varying float vWheelWorldY;uniform vec2 harbourWheelRange;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('totalEmissiveRadiance+=vHarbourEmission*harbourNight;',
          'totalEmissiveRadiance+=vHarbourEmission*harbourNight*mix(1.,.65,smoothstep(harbourWheelRange.x,harbourWheelRange.y,vWheelWorldY));');
      }
    };
    material.customProgramCacheKey=()=> 'harbour-original-glazing-light-v5-'+soften+'-'+Boolean(wheelRange);material.needsUpdate=true;
  }
  const lamps=(world.root.userData.streetLamps??[]).map(position=>{
    const light=new T.PointLight('#ffdfb5',0,4.5,2);light.position.copy(position);scene.add(light);return light;
  });
  // The low Jardine House spill burned a bright patch into its base. Keep
  // its circular window emission and the other buildings' existing spill.
  const windowSpill=(world.root.userData.windowSpillSources??[]).filter(source=>source.buildingName!=='Jardine House').map(({position,colour})=>{
    const light=new T.PointLight(colour,0,2.4,2);light.name='Coloured window spill';light.position.copy(position);scene.add(light);return light;
  });
  const peak=world.buildings.find(building=>building.name==='The Peak Tower');
  const peakEntrance=new T.PointLight('#e5eeff',0,4.5,2);
  peakEntrance.name='Peak Tower entrance light';
  // Stand farther off the facade so the inverse-square falloff washes the
  // entrance evenly instead of blowing out the concrete between the columns.
  peakEntrance.position.copy(peak.group.localToWorld(new T.Vector3(0,1.45,peak.depth/2+.95)));
  scene.add(peakEntrance);
  const peakAtrium=[-.48,.48].map(x=>{
    const light=new T.PointLight('#e2edff',0,3.2,1);
    light.name='Peak Tower atrium wash';
    light.position.copy(peak.group.localToWorld(new T.Vector3(x,1.0,0)));
    scene.add(light);return light;
  });
  const wheelCentre=world.observationWheel.group.getWorldPosition(new T.Vector3());
  const wheelUplights=[-1,1].map(side=>{
    const light=new T.SpotLight(WHEEL_LIGHT_COLOUR,0,6.2,.58,1,1.8);
    light.name='Wheel upward floodlight';
    light.position.copy(wheelCentre).add(new T.Vector3(side*.53,-2.42,.48));
    light.target.position.copy(wheelCentre).add(new T.Vector3(side*1.25,.85,0));
    scene.add(light,light.target);return light;
  });
  // The upward cones miss the low cabin sides. A soft, bounded red bounce
  // above the footing catches their shells as they pass, fading with height.
  const wheelCabinFill=new T.PointLight(WHEEL_LIGHT_COLOUR,0,3.0,0);
  wheelCabinFill.name='Wheel soft red cabin fill';
  wheelCabinFill.position.copy(wheelCentre).add(new T.Vector3(0,-2.1,.75));
  scene.add(wheelCabinFill);
  const trackLights=TRAM_TRACK_LIGHTS.map(lamp=>{
    const {position}=tramTrackLightPose(world.peakTram.route,lamp);
    // Use a broad near-field wash with a smooth range cutoff. Inverse-distance
    // attenuation made these low fixtures burn a small bright spot into the hill.
    // Paired loop lights share their output, keeping the whole loop balanced.
    position.y+=world.land.rise+.34;
    const light=new T.PointLight('#ffe0a6',0,4.4,0);
    light.userData.washGain=lamp.gain;light.name='Peak Tram mountainside wash';light.position.copy(world.root.localToWorld(position));
    scene.add(light);return light;
  });
  const wheelMist=new Set(),trackMist=new Set();world.root.traverse(object=>{
    if(object.isMesh&&object.material.name==='Wheel soft uplight mist')wheelMist.add(object.material);
    if(object.isMesh&&object.material.name==='Peak Tram soft track mist')trackMist.add(object.material);
  });
  // A small, shadowless ceiling wash follows each carriage, keeping the light
  // even along the train as the articulated bodies follow different grades.
  const tramInteriors=world.peakTram.cars.flatMap(car=>car.cabins.map(({body})=>{
    let light=body.getObjectByName('Peak Tram interior ceiling wash');
    if(!light){
      light=new T.PointLight('#ffdfa1',0,1.35,1.5);
      light.name='Peak Tram interior ceiling wash';light.position.set(0,.82,0);body.add(light);
    }
    return light;
  }));
  const waterBase=world.materials.sea.emissiveIntensity;
  const waterMaterials=[world.materials.sea,world.ocean.sides.material,world.ocean.upper.material];
  const waterDayColours=waterMaterials.map(material=>material.color.clone());
  const waterNightColours=['#35677c','#35677c','#528fa7'].map(colour=>new T.Color(colour));
  function set(amount){
    const t=T.MathUtils.clamp(amount,0,1),dusk=Math.sin(t*Math.PI);
    const windows=T.MathUtils.smoothstep(t,.30,.85);night.value=windows;
    lighting.sky.intensity=T.MathUtils.lerp(1.05,.23,t);
    lighting.sky.color.set('#e4f1f4').lerp(new T.Color('#647dab'),t);
    lighting.sky.groundColor.set('#cdbb97').lerp(new T.Color('#31384c'),t);
    lighting.sun.intensity=T.MathUtils.lerp(2,.23,t);
    lighting.sun.color.set('#fff1d2').lerp(new T.Color('#a5b9ed'),t).lerp(new T.Color('#ffb887'),dusk*.22);
    lighting.sun.position.set(-6,14-10*t,9);
    lighting.rim.intensity=T.MathUtils.lerp(.38,.30,t);
    lamps.forEach(light=>light.intensity=windows*5);
    windowSpill.forEach(light=>light.intensity=windows*2.8);
    peakEntrance.intensity=windows*2;
    peakAtrium.forEach(light=>light.intensity=windows*1.6);
    wheelUplights.forEach(light=>light.intensity=windows*5);
    wheelCabinFill.intensity=windows*1.5;
    wheelMist.forEach(material=>material.opacity=windows*.075);
    trackLights.forEach(light=>light.intensity=windows*1.75*light.userData.washGain);
    trackMist.forEach(material=>material.opacity=windows*.065*material.userData.trackMistGain);
    tramInteriors.forEach(light=>light.intensity=windows*.55);
    for(const [key,gain] of Object.entries({tramWindow:.26,tramInteriorWood:.20,tramInteriorFloor:.25,
      tramCeilingLight:1.8,tramGuideLight:.7,tramBallast:0,tramRail:0,tramSleeper:0})){
      world.materials[key].emissiveIntensity=windows*gain;
    }
    lighting.headlamps.forEach(({light})=>light.userData.nightIntensity=.10+windows*1.6);
    lighting.update();
    world.cars.forEach(car=>car.g.userData.setNight(t));
    world.boats.forEach(boat=>boat.g.userData.setNight?.(windows));
    world.materials.hkcecGlass.emissiveIntensity=0;
    world.materials.bocFrame.emissiveIntensity=windows*2;
    world.materials.bocMast.emissiveIntensity=windows*2.5;
    world.materials.peakFascia.emissiveIntensity=0;
    world.materials.sea.emissiveIntensity=waterBase*(1-t*.8);
    waterMaterials.forEach((material,index)=>material.color.copy(waterDayColours[index]).lerp(waterNightColours[index],t));
  }
  return {set,windowUniform:night,lamps,wheelUplights,wheelCabinFill,tramInteriors,trackLights};
}
