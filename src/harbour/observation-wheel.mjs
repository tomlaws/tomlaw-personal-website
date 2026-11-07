import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WHEEL_FRAME} from './wheel-frame-meshes.mjs';
import {bindObservationWheelMotion} from './wheel-motion.mjs';
import {createWheelUplightHaze,WHEEL_LIGHT_COLOUR} from './wheel-uplights.mjs';
export {bindObservationWheelMotion} from './wheel-motion.mjs';

export function createObservationWheel({radius,gondolas,white}) {
  const group=new T.Group();group.name='Hong Kong Observation Wheel';
  const red=new T.MeshStandardMaterial({name:'AIA gondola red enamel',color:'#d85861',roughness:.48,metalness:.08});
  const glass=new T.MeshPhysicalMaterial({name:'Observation gondola blue glass',color:'#80b5cc',roughness:.16,metalness:.15,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide,clearcoat:1});
  const interior=white.clone();interior.name='Gondola softly illuminated interior and trim';
  const structural=[];
  const redLight=new T.Color(WHEEL_LIGHT_COLOUR),uplights=new T.Group();uplights.name='Wheel fixed base uplights';
  const housing=white.clone();housing.name='Wheel uplight metal housing';housing.color.set('#61717e');housing.metalness=.38;housing.roughness=.44;
  const lens=white.clone();lens.name='Wheel uplight optical lens';lens.color.set('#e2b7ac');
  for(const part of WHEEL_FRAME){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(part.position,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(part.normal,3));
    geometry.setIndex(part.index);geometry.scale(radius/2.10,radius/2.10,radius/2.10);
    const emission=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<emission.length;i+=3){emission[i]=redLight.r*part.light;emission[i+1]=redLight.g*part.light;emission[i+2]=redLight.b*part.light;}
    geometry.setAttribute('harbourEmission',new T.BufferAttribute(emission,3));
    if(part.stationary){
      const mesh=new T.Mesh(geometry,part.key==='lens'?lens:housing);mesh.name=part.name;uplights.add(mesh);
    }else structural.push(geometry);
  }
  const finish=white.clone();finish.name='Observation Wheel pearl frame with red night lighting';
  const structure=new T.Mesh(mergeGeometries(structural,false),finish);structure.name='Observation Wheel rims and primary spokes';structure.castShadow=true;group.add(structure);structural.forEach(g=>g.dispose());
  uplights.add(createWheelUplightHaze());
  const shells=[],frames=[],panes=[];
  function box(list,w,h,d,x,y,z,r=.01){list.push(new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/4,h/4,d/4)).translate(x,y,z));}
  // The pivot is above the roof: the cabin hangs below its axle and remains level.
  box(frames,.025,.09,.025,0,-.04,0);
  box(shells,.31,.045,.35,0,-.105,0,.025);
  box(shells,.30,.095,.34,0,-.365,0,.035);
  box(frames,.265,.025,.29,0,-.421,0,.012);
  for(const x of [-.137,.137])for(const z of [-.157,.157])box(shells,.018,.225,.018,x,-.235,z,.005);
  for(const z of [-.165,.165]) {
    box(panes,.255,.20,.010,0,-.235,z,.005);
    box(shells,.012,.20,.014,0,-.235,z,.003); // Actual sliding-door mullion.
    box(frames,.018,.038,.012,.045,-.25,z*1.03,.003);
  }
  for(const x of [-.143,.143])box(panes,.010,.20,.285,x,-.235,0,.004);
  for(const z of [-.10,.10]){box(frames,.22,.025,.065,0,-.317,z);box(frames,.22,.065,.015,0,-.285,z*1.13);}
  const cabins=[];
  for(const [name,parts,material]of [['Red gondola bodies',shells,red],['Gondola frames, seats and hangers',frames,interior],['Enclosed gondola glazing',panes,glass]]) {
    const compatible=parts.map(g=>g.index?g.toNonIndexed():g.clone());
    const geometry=mergeGeometries(compatible,false),position=geometry.attributes.position,normal=geometry.attributes.normal;
    const emission=new Float32Array(position.count*3),warm=new T.Color('#ffe2b5');
    const lightUV=new Float32Array(position.count*2);
    // Keep the roof edge unlit: its narrow, moving silhouette shimmers at map
    // scale. Spread the warm light over the seats, floor and broad pane areas.
    // This keeps all sixteen cabins in their original three instance batches.
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),ny=normal.getY(i);
      let gain=0;
      if(material===red){
        if(y>-.325&&y<-.31&&ny>.5)gain=.10;
      }else if(material===interior&&y<-.24&&y>-.35){
        gain=.045+.12*Math.max(ny,0);
      }else if(material===glass){
        gain=.075+.175*T.MathUtils.smoothstep(y,-.335,-.135);
        const along=Math.abs(normal.getX(i))>Math.abs(normal.getZ(i))?z/.285:x/.255;
        lightUV[i*2]=T.MathUtils.clamp(along+.5,0,1);
        lightUV[i*2+1]=T.MathUtils.clamp((y+.335)/.20,0,1);
      }
      emission.set([warm.r*gain,warm.g*gain,warm.b*gain],i*3);
    }
    geometry.setAttribute('harbourEmission',new T.BufferAttribute(emission,3));
    if(material===glass){
      geometry.setAttribute('harbourLightUV',new T.BufferAttribute(lightUV,2));
      geometry.setAttribute('harbourRoundWindow',new T.BufferAttribute(new Float32Array(position.count),1));
    }
    const mesh=new T.InstancedMesh(geometry,material,gondolas);mesh.name=name;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.castShadow=!material.transparent;mesh.receiveShadow=!material.transparent;mesh.frustumCulled=false;
    group.add(mesh);cabins.push(mesh);parts.concat(compatible).forEach(g=>g.dispose());
  }
  const animate=bindObservationWheelMotion({group,cabins,radius,gondolas});
  animate(0,0);return {group,cabins,animate,uplights};
}

