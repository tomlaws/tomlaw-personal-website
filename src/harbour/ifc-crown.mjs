import {Color,Float32BufferAttribute,MathUtils,Vector3} from 'three';

// A restrained floodlit crown, brightest at the concealed roof-level uplights.
// Vertex emission shares the normal day/night and bloom path on both renderers.
export function prepareIFCCrownLight(mesh){
  mesh.geometry=mesh.geometry.clone();
  const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal;
  const point=new Vector3(),colour=new Color('#f1f3ff'),emission=[];
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
    const height=MathUtils.clamp((point.y-13.72)/1.17,0,1);
    const amount=(.90-.38*height)*(Math.abs(normal.getY(i))>.8?.64:1);
    emission.push(colour.r*amount,colour.g*amount,colour.b*amount);
  }
  geometry.setAttribute('harbourEmission',new Float32BufferAttribute(emission,3));
}
