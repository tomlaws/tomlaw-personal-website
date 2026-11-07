import * as T from 'three';

// Light the actual soffits and terrace fascias, leaving the roof exterior and
// walking surfaces reflective. Uses the existing night uniform and draw batches.
export function prepareHKCECAccent(mesh,kind){
  mesh.geometry=mesh.geometry.clone();
  const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal;
  const normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const face=new T.Vector3(),point=new T.Vector3();
  const colour=new T.Color(kind==='roof'?'#ffe4a3':'#e6f0ff'),emission=[];
  for(let i=0;i<position.count;i++){
    face.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();
    point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
    const amount=kind==='roof'
      ? .58*T.MathUtils.smoothstep(-face.y,.02,.65)*(.45+.55*T.MathUtils.smoothstep(point.z,-1.2,.9))
      : Math.abs(face.y)<.35?.95:0;
    emission.push(colour.r*amount,colour.g*amount,colour.b*amount);
  }
  geometry.setAttribute('harbourEmission',new T.Float32BufferAttribute(emission,3));
}
