import * as T from 'three';
import {splitGlazingAtFloors} from './glazing-floors.mjs';

const interiorPalettes={
  'Two IFC':['#78adf2','#a3c9f5','#f2f3ef'],
  'One Island East':['#ffe3a1','#ffefc3','#83b6f2'],
  'Bank of China Tower':['#f2f3ef'],
  'Cheung Kong Center':['#82b3ef','#ecf3ff','#ffe9af'],
  'HSBC Main Building':['#ffe3a1','#f2f3ef','#8cbdf3'],
  'Jardine House':['#ffe3a1','#fff0c9','#86b5ef'],
  'The Peak Tower':['#e2edff'],
  'Hong Kong Convention and Exhibition Centre':['#ffe4a3'],
};
const defaultPalette=['#ffe3a1','#82b3ef','#f2f3ef'];

// Store light on the original glazing surfaces before static batching. Splitting
// at floor joints introduces no new window shapes, grids or extra surfaces.
export function prepareGlazingLight(mesh,{opaqueBand=false,floorCuts=[],buildingName=''}={}){
  mesh.geometry=mesh.geometry.clone();
  const bounds=new T.Box3().setFromObject(mesh),height=bounds.max.y-bounds.min.y;
  const size=bounds.getSize(new T.Vector3());
  let hash=2166136261;
  for(const character of mesh.name)hash=Math.imul(hash^character.charCodeAt(0),16777619);
  const seed=(hash>>>0)/4294967296;
  const continuous=height>1.5||Math.max(size.x,size.z)>1.8;
  const peak=mesh.material.name.startsWith('Peak Tower');
  const excluded=opaqueBand||/roof|crown|skylight|mechanical/i.test(mesh.name)||(!peak&&/sweep|peak_band/i.test(mesh.name));
  const boc=buildingName==='Bank of China Tower';
  // GLTFLoader sanitizes the Blender names to underscores. Recognize both
  // forms so these portholes never receive the rectangular window mask.
  const roundWindow=buildingName==='Jardine House'&&/recessed[_ ]+circular[_ ]+glass/i.test(mesh.name);
  const strength=excluded||(boc&&continuous)?0:1.10;
  // Equal emitting-channel strength keeps the shared bloom response consistent
  // across colours and glazing opacity, without changing daytime glass.
  const opacity=mesh.material.transparent?Math.max(mesh.material.opacity,.25):1;
  const colours=(interiorPalettes[buildingName]??defaultPalette).map(value=>{
    const colour=new T.Color(value);
    return colour.multiplyScalar(1/Math.max(colour.r,colour.g,colour.b));
  });
  const floorColours=new Map();
  let bands=null;
  if(continuous&&height>1.5&&!excluded&&!boc&&floorCuts.some(y=>y>bounds.min.y+.01&&y<bounds.max.y-.01)){
    const split=splitGlazingAtFloors(mesh,floorCuts);mesh.geometry.dispose();mesh.geometry=split.geometry;bands=split.bands;
  }
  const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal;
  let circularPane;
  if(roundWindow){
    geometry.computeBoundingBox();
    const paneSize=geometry.boundingBox.getSize(new T.Vector3()).toArray();
    // The disc's thinnest axis is its depth. Project on its own plane rather
    // than changing UV axes with the curved edge normals or world heading.
    const axes=[0,1,2].sort((a,b)=>paneSize[b]-paneSize[a]).slice(0,2);
    axes.sort((a,b)=>Math.abs(mesh.matrixWorld.elements[b*4+1])-Math.abs(mesh.matrixWorld.elements[a*4+1]));
    circularPane={up:axes[0],across:axes[1],size:paneSize,min:geometry.boundingBox.min.toArray(),flip:mesh.matrixWorld.elements[axes[0]*4+1]<0};
  }
  const point=new T.Vector3(),face=new T.Vector3(),normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const emission=[],lightUV=[];
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
    face.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
    const band=bands?.[i];
    const floor=band?.index??0;
    if(!floorColours.has(floor)){
      const noise=Math.sin((floor+1)*17.713+seed*91.37)*43758.5453;
      floorColours.set(floor,colours[Math.floor((noise-Math.floor(noise))*colours.length)]);
    }
    const colour=floorColours.get(floor);
    let up=T.MathUtils.clamp((point.y-(band?.lo??bounds.min.y))/Math.max(band?band.hi-band.lo:height,.01),0,1);
    const axis=Math.abs(face.x)>Math.abs(face.z)?'z':'x';
    let across=T.MathUtils.clamp((point[axis]-bounds.min[axis])/Math.max(size[axis],.01),0,1);
    if(circularPane){
      const p=circularPane;
      across=(position.getComponent(i,p.across)-p.min[p.across])/p.size[p.across];
      up=(position.getComponent(i,p.up)-p.min[p.up])/p.size[p.up];
      if(p.flip)up=1-up;
    }
    lightUV.push(across,up);
    // Ceiling lighting stays brighter at the top, with enough lower-pane light
    // for the atmospheric glow to surround the whole window.
    const amount=strength/opacity*(.50+.70*up)*(Math.abs(face.y)<.5?1:0);
    emission.push(colour.r*amount,colour.g*amount,colour.b*amount);
  }
  geometry.setAttribute('harbourEmission',new T.Float32BufferAttribute(emission,3));
  // Separate coordinates for diffusion, retaining the model's reflection UVs.
  geometry.setAttribute('harbourLightUV',new T.Float32BufferAttribute(lightUV,2));
  geometry.setAttribute('harbourRoundWindow',new T.Float32BufferAttribute(new Float32Array(position.count).fill(roundWindow?1:0),1));
}
