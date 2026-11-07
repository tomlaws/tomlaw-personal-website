// Identical WebGL shader hooks for procedurally built and prepared scenes.
export function prepareVehicleGlazing(material){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec2 vehicleLightUV;attribute float vehicleLightGain;varying vec2 vVehicleLightUV;varying float vVehicleLightGain;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvVehicleLightUV=vehicleLightUV;vVehicleLightGain=vehicleLightGain;');
    shader.fragmentShader='varying vec2 vVehicleLightUV;varying float vVehicleLightGain;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb*=mix(vec3(.50,.65,.76),vec3(1.),vVehicleLightUV.y);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      vec2 edge=min(vVehicleLightUV,1.-vVehicleLightUV);
      float softness=smoothstep(0.,.13,edge.x)*smoothstep(0.,.16,edge.y);
      totalEmissiveRadiance*=vVehicleLightGain*softness*(.40+.60*smoothstep(0.,1.,vVehicleLightUV.y));`);
  };
  material.customProgramCacheKey=()=> 'hk-vehicle-diffused-glass-v1';
}

export function prepareFerryGlazing(material){
  material.onBeforeCompile=shader=>{
      shader.vertexShader='varying float vFerryHeight;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFerryHeight=position.y;');
      shader.fragmentShader='varying float vFerryHeight;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float ceilingLight=vFerryHeight<.70?smoothstep(.49,.65,vFerryHeight):smoothstep(.81,1.01,vFerryHeight);
        totalEmissiveRadiance*=.18+.82*ceilingLight;`);
    };
  material.customProgramCacheKey=()=> 'star-ferry-warm-windows-v1';
}
