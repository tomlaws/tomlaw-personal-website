import * as T from 'three';

export function bindObservationWheelMotion({group,cabins,radius,gondolas}) {
  const matrix=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3(1,1,1);
  function animate(time,speed) {
    const angle=time*speed;group.rotation.z=angle;rotation.setFromAxisAngle(new T.Vector3(0,0,1),-angle);
    for(let i=0;i<gondolas;i++) {
      const a=i/gondolas*Math.PI*2;position.set(Math.cos(a)*radius,Math.sin(a)*radius,0);
      matrix.compose(position,rotation,scale);cabins.forEach(mesh=>mesh.setMatrixAt(i,matrix));
    }
    cabins.forEach(mesh=>mesh.instanceMatrix.needsUpdate=true);
  }
  return animate;
}
