import * as T from 'three';

export const TRAM_TRACK_LIGHTS=[
  {u:.10,side:-1,gain:1},
  {u:.36,side:-1,gain:.55},{u:.36,side:1,gain:.55},
  {u:.64,side:-1,gain:.55},{u:.64,side:1,gain:.55},
  {u:.90,side:1,gain:1},
];

// Sparse lights share their output across both shoulders of the passing loop.
// Keep fixtures, actual washes and haze aligned in the prepared world too.
export function tramTrackLightPose(route,{u,side}){
  const tangent=route.tangent(u),across=new T.Vector3(-tangent.z,0,tangent.x).normalize();
  const position=route.point(u,0,side*(.405+route.passingOffset(u)));position.y+=.055;
  return {position,across,tangent};
}

export function createTramTrackMist(route){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/(size-1)*2-1,v=y/(size-1)*2-1;
    const density=Math.pow(Math.max(0,1-u*u-v*v),2.4);
    const i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(density*255);
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
  const group=new T.Group();group.name='Peak Tram local light scattering';
  for(const [height,gain] of [[.16,1],[.45,.42]]){
    const material=new T.MeshBasicMaterial({name:'Peak Tram soft track mist',color:'#ffe3b5',map:texture,
      transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
    material.userData.trackMistGain=gain;
    for(const lamp of TRAM_TRACK_LIGHTS){
      const {position:source,across,tangent}=tramTrackLightPose(route,lamp);
      const centre=source.clone().addScaledVector(across,lamp.side*.30);
      const position=[],uv=[],indices=[],rows=14;
      for(let y=0;y<=rows;y++)for(let x=0;x<=rows;x++){
        const a=x/rows,b=y/rows;
        const p=centre.clone().addScaledVector(across,(a*2-1)*2.3).addScaledVector(tangent,(b*2-1)*2.4);
        p.y=route.terrainHeight(p.x,p.z)+height;
        position.push(...p.toArray());uv.push(a,b);
        if(x<rows&&y<rows){const i=y*(rows+1)+x;indices.push(i,i+1,i+rows+1,i+1,i+rows+2,i+rows+1);}
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
      geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
      const haze=new T.Mesh(geometry,material);haze.name='Peak Tram local mountainside mist';group.add(haze);
    }
  }
  return group;
}
