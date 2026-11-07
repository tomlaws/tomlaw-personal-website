import * as T from 'three';

// Subdivide the original triangles at modelled floor joints. The silhouette,
// surface positions and other attributes stay unchanged; only lighting can vary.
export function splitGlazingAtFloors(mesh,cuts){
  const source=mesh.geometry,attributes=Object.entries(source.attributes);
  const position=source.attributes.position,point=new T.Vector3();
  const heights=Array.from({length:position.count},(_,i)=>point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).y);
  const min=Math.min(...heights),max=Math.max(...heights);
  const boundaries=[min,...cuts.filter(y=>y>min+.01&&y<max-.01),max];
  const output=Object.fromEntries(attributes.map(([name])=>[name,[]])),bands=[];
  function vertex(index){return {y:heights[index],values:Object.fromEntries(attributes.map(([name,attribute])=>[name,Array.from({length:attribute.itemSize},(_,j)=>attribute.getComponent(index,j))]))};}
  function clip(polygon,height,above){
    const result=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      const insideA=above?a.y>=height-1e-8:a.y<=height+1e-8;
      const insideB=above?b.y>=height-1e-8:b.y<=height+1e-8;
      if(insideA)result.push(a);
      if(insideA!==insideB){
        const t=T.MathUtils.clamp((height-a.y)/(b.y-a.y),0,1);
        result.push({y:height,values:Object.fromEntries(attributes.map(([name])=>[name,a.values[name].map((v,j)=>T.MathUtils.lerp(v,b.values[name][j],t))]))});
      }
    }
    return result;
  }
  const count=source.index?.count??position.count;
  for(let band=0;band<boundaries.length-1;band++){
    const lo=boundaries[band],hi=boundaries[band+1];
    for(let triangle=0;triangle<count;triangle+=3){
      let polygon=Array.from({length:3},(_,i)=>vertex(source.index?source.index.getX(triangle+i):triangle+i));
      polygon=clip(clip(polygon,lo,true),hi,false);
      for(let i=1;i<polygon.length-1;i++)for(const v of [polygon[0],polygon[i],polygon[i+1]]){
        for(const [name]of attributes)output[name].push(...v.values[name]);
        bands.push({lo,hi,index:band});
      }
    }
  }
  const geometry=new T.BufferGeometry();
  for(const [name,attribute]of attributes)geometry.setAttribute(name,new T.Float32BufferAttribute(output[name],attribute.itemSize));
  return {geometry,bands};
}
