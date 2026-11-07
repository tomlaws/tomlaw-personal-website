import * as T from 'three';

export const WHEEL_LIGHT_COLOUR='#e16f65';

// Portable, softly feathered haze. Two crossed translucent planes give a little
// scattering from either side, without a hard cone silhouette or a full-screen pass.
export function createWheelUplightHaze(){
  const width=48,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/(width-1)*2-1,v=y/(height-1);
    const density=Math.pow(Math.max(0,1-u*u),3)*T.MathUtils.smoothstep(v,0,.07)*Math.pow(1-v,1.8);
    const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(density*255);
  }
  const texture=new T.DataTexture(data,width,height,T.RGBAFormat);
  texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
  const material=new T.MeshBasicMaterial({name:'Wheel soft uplight mist',color:'#dc8b81',map:texture,
    transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
  const group=new T.Group();group.name='Wheel fixed upward haze';
  for(const side of [-1,1]){
    const source=new T.Vector3(side*.53,-2.42,.48),target=new T.Vector3(side*1.25,.85,0);
    const axis=target.clone().sub(source).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis);
    for(const angle of [0,Math.PI/2]){
      const position=[],uv=[],indices=[],rows=20,length=4.65;
      for(let row=0;row<=rows;row++){
        const t=row/rows,half=.035+t*1.65;
        for(const edge of [-1,1]){
          const point=new T.Vector3(Math.cos(angle)*half*edge,t*length,Math.sin(angle)*half*edge).applyQuaternion(q).add(source);
          position.push(...point.toArray());uv.push((edge+1)/2,t);
        }
        if(row<rows){const i=row*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
      geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
      const haze=new T.Mesh(geometry,material);haze.name='Wheel upward mist';group.add(haze);
    }
  }
  return group;
}
