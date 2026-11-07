import * as T from 'three';
import {PEAK_DETAILS} from './peak-detail-meshes.mjs';
import {PEAK_BOWL} from './peak-bowl-mesh.mjs';

// Farrells' crescent-shaped tower, with the glazed atrium introduced in the
// 2006 renovation. Dimensions are simplified to suit the miniature summit.
export function createPeakTower(){
  const root=new T.Group();root.name='Peak Tower crescent and glazed atrium';
  const materials=new Map();
  function add(name,geometry,key){
    if(!materials.has(key))materials.set(key,Object.assign(new T.MeshStandardMaterial(),{name:key}));
    const mesh=new T.Mesh(geometry,materials.get(key));mesh.name=name;root.add(mesh);return mesh;
  }
  function box(name,w,h,d,x,y,z,key='stone'){
    return add(name,new T.BoxGeometry(w,h,d).translate(x,y,z),key);
  }
  function bar(name,a,b,r=.012,key='metal'){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
    const geometry=new T.CylinderGeometry(r,r,delta.length(),6);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    geometry.translate(...start.add(end).multiplyScalar(.5).toArray());return add(name,geometry,key);
  }
  const halfWidth=1.68;
  const lower=x=>1.31+1.11*Math.pow(Math.abs(x)/halfWidth,2.35);
  const upper=x=>1.58+1.10*Math.pow(Math.abs(x)/halfWidth,2.10);
  // One Blender-authored closed bowl completes both solid upswept ends. The
  // lower crescent curve is retained; both end caps sit level with the deck.
  const bowl=new T.BufferGeometry();
  bowl.setAttribute('position',new T.Float32BufferAttribute(PEAK_BOWL.position,3));
  bowl.setAttribute('normal',new T.Float32BufferAttribute(PEAK_BOWL.normal,3));
  add(PEAK_BOWL.name,bowl,PEAK_BOWL.key);

  box('Peak grounded podium',2.58,.38,1.88,0,.19,0);
  box('Peak recessed concourse floor',2.30,.035,1.63,0,.405,0,'room');
  // Four granite piers connect the podium directly to the crescent underside.
  for(const x of [-.82,.82])for(const z of [-.52,.52]){
    const top=lower(x)+.035;
    box('Peak granite structural pier',.29,top-.36,.29,x,(top+.36)/2,z);
  }

  // Enclosed atrium between the piers: separate recessed panes and real floors.
  for(const side of [-1,1])for(let bay=0;bay<6;bay++){
    const x=-.55+bay*.22,left=x-.1055,right=x+.1055,z=side*.69;
    const pane=new T.BufferGeometry();
    pane.setAttribute('position',new T.Float32BufferAttribute([left,.40,z,right,.40,z,left,lower(left)-.005,z,right,lower(right)-.005,z],3));
    pane.setIndex(side===1?[0,1,2,1,3,2]:[0,2,1,1,2,3]);pane.computeVertexNormals();
    add('Peak atrium clear glass',pane,'glass');
    const top=lower(x-.11)-.005;
    box('Peak atrium mullion',.012,top-.39,.018,x-.11,(top+.39)/2,side*.70,'metal');
  }
  for(const x of [-.68,.68]){const top=lower(x)-.005;box('Peak atrium side glass',.012,top-.40,1.34,x,(top+.40)/2,0,'glass');}
  for(const y of [.72,1.04])for(const side of [-1,1])box('Peak atrium horizontal transom',1.35,.018,.018,0,y,side*.705,'metal');
  for(const x of [-.50,.50])box('Peak atrium mezzanine landing',.29,.035,1.20,x,.82,0,'room');
  for(const side of [-1,1]){
    const z=side*.22;
    bar('Peak atrium escalator stringer',[-.47,.43,z],[.48,.82,z],.025,'peakLouvre');
    bar('Peak atrium escalator rail',[-.47,.57,z],[.48,.96,z],.010,'metal');
  }
  for(let step=0;step<8;step++)box('Peak atrium escalator tread',.13,.025,.40,-.45+step*.13,.44+step*.055,0,'metal');

  // Current entrance frontage and a sheltered, offset doorway.
  for(let bay=0;bay<5;bay++){
    const x=-1.06+bay*.30;
    box('Peak podium shop glazing',.275,.26,.016,x,.225,.949,'crystal');
    box('Peak podium shop mullion',.018,.29,.026,x-.145,.225,.960,'white');
  }
  box('Peak main entrance glass',.59,.32,.018,.86,.20,.958,'glass');
  box('Peak entrance door mullion',.018,.32,.024,.86,.20,.975,'metal');
  for(const x of [.58,1.15])box('Peak entrance jamb',.032,.36,.035,x,.20,.977,'white');
  box('Peak entrance canopy',1.02,.055,.30,.67,.435,1.025,'white');
  box('Peak front entrance threshold',1.03,.025,.15,.67,.025,1.045,'stone');

  // A flat, usable central Sky Terrace framed by the raised crescent ends.
  box('Peak Sky Terrace deck',2.34,.055,1.62,0,2.515,0,'stone');
  for(const side of [-1,1]){
    box('Peak roof terrace glass rail',2.30,.17,.012,0,2.63,side*.805,'glass');
    box('Peak roof terrace glass end',.012,.17,1.60,side*1.165,2.63,0,'glass');
  }
  // One continuous concealed LED strip beneath the terrace handrail. A single
  // closed ring avoids overlapping corner pieces and camera-dependent glints.
  const terraceLight=new T.Shape();
  terraceLight.moveTo(-1.187,-.827);terraceLight.lineTo(1.187,-.827);
  terraceLight.lineTo(1.187,.827);terraceLight.lineTo(-1.187,.827);terraceLight.closePath();
  const opening=new T.Path();opening.moveTo(-1.162,-.802);opening.lineTo(-1.162,.802);
  opening.lineTo(1.162,.802);opening.lineTo(1.162,-.802);opening.closePath();terraceLight.holes.push(opening);
  const lightGeometry=new T.ExtrudeGeometry(terraceLight,{depth:.007,steps:1,bevelEnabled:false});
  lightGeometry.rotateX(-Math.PI/2);lightGeometry.translate(0,2.709,0);
  add('Peak Sky Terrace concealed edge lighting',lightGeometry,'bocFrame');
  // Fewer, broader louvres and railing members authored in Blender. The panels
  // follow the existing crescent rather than drawing a fine grid over it.
  for(const part of PEAK_DETAILS){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(part.position,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(part.normal,3));
    add(part.name,geometry,part.key);
  }
  root.userData.landmark='The Peak Tower';root.userData.front='+z';
  root.userData.reference='https://farrells.com/project/peak-tower/';
  root.userData.footprint=[[-1.29,-.94],[1.29,-.94],[1.29,1.10],[-1.29,1.10]];
  root.userData.crescent={halfWidth,lowerCentre:lower(0),lowerTip:lower(halfWidth),upperCentre:upper(0),upperTip:PEAK_BOWL.endTop};
  return root;
}

// Architectural night lighting on the existing skin: a cool curved underside
// and warm light behind the upper louvres, rather than an entrance hotspot.
export function preparePeakLighting(mesh){
  mesh.geometry=mesh.geometry.clone();
  const geometry=mesh.geometry,normal=geometry.attributes.normal,emission=[];
  const face=new T.Vector3(),matrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const shell=mesh.material.name==='Peak Tower aluminium crescent';
  const backing=mesh.name==='Peak recessed louvre backing';
  const colour=new T.Color(shell?'#d9e9ff':'#ffe6b1');
  for(let i=0;i<normal.count;i++){
    face.fromBufferAttribute(normal,i).applyMatrix3(matrix).normalize();
    const amount=shell?(face.y>0?0:.46+.40*Math.max(0,-face.y)):backing&&Math.abs(face.y)<.5?1.5:0;
    emission.push(colour.r*amount,colour.g*amount,colour.b*amount);
  }
  geometry.setAttribute('harbourEmission',new T.Float32BufferAttribute(emission,3));
}
