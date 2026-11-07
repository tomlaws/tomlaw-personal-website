import * as T from 'three';

// Arc-length parameterization of four straight reaches and four quarter turns.
// No spline interpolation can bow the straight road or overshoot a corner.
export function roundedBlockRoad(minX,maxX,minZ,maxZ,radius,y=0) {
  const r=Math.min(radius,(maxX-minX)/2,(maxZ-minZ)/2),segments=[];
  function line(x0,z0,x1,z1) {
    const length=Math.hypot(x1-x0,z1-z0);
    segments.push({kind:'straight',length,at:t=>new T.Vector3(x0+(x1-x0)*t,y,z0+(z1-z0)*t),tangent:()=>new T.Vector3(x1-x0,0,z1-z0).normalize()});
  }
  function arc(cx,cz,start) {
    segments.push({kind:'turn',length:r*Math.PI/2,at:t=>new T.Vector3(cx+r*Math.cos(start+t*Math.PI/2),y,cz+r*Math.sin(start+t*Math.PI/2)),tangent:t=>new T.Vector3(-Math.sin(start+t*Math.PI/2),0,Math.cos(start+t*Math.PI/2))});
  }
  line(minX+r,minZ,maxX-r,minZ);arc(maxX-r,minZ+r,-Math.PI/2);
  line(maxX,minZ+r,maxX,maxZ-r);arc(maxX-r,maxZ-r,0);
  line(maxX-r,maxZ,minX+r,maxZ);arc(minX+r,maxZ-r,Math.PI/2);
  line(minX,maxZ-r,minX,minZ+r);arc(minX+r,minZ+r,Math.PI);
  let length=0;for(const segment of segments){segment.start=length;length+=segment.length;segment.end=length;}
  function locate(u){const s=((u%1+1)%1)*length;const segment=segments.find(segment=>s<segment.end)||segments[segments.length-1];return {segment,t:(s-segment.start)/segment.length};}
  return {segments,radius:r,getLength:()=>length,getPointAt:u=>{const {segment,t}=locate(u);return segment.at(t);},getTangentAt:u=>{const {segment,t}=locate(u);return segment.tangent(t);}};
}
