import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function createHongKongFlag() {
  const flag=new T.Group();flag.name='Hong Kong regional flag';
  const red=new T.MeshStandardMaterial({color:'#de2910',roughness:.85,side:T.DoubleSide});
  const white=new T.MeshStandardMaterial({color:'#ffffff',roughness:.85,side:T.DoubleSide});
  const cloth=new T.Mesh(new T.BoxGeometry(.30,.20,.012),red);flag.add(cloth);
  const petals=[],details=[];
  const petal=new T.Shape();
  petal.moveTo(0,0);
  petal.bezierCurveTo(-.18,.09,-.19,.30,-.04,.37);
  petal.bezierCurveTo(.08,.43,.24,.30,.15,.15);
  petal.bezierCurveTo(.10,.05,.03,.05,0,0);
  for(const side of [-1,1])for(let i=0;i<5;i++) {
    const angle=i*Math.PI*2/5;
    const transform=new T.Matrix4().makeRotationZ(angle).scale(new T.Vector3(.18,.18,1));
    transform.setPosition(0,0,side*.0065);
    petals.push(new T.ShapeGeometry(petal,16).applyMatrix4(transform));
    const star=new T.Shape();
    for(let j=0;j<10;j++){
      const a=Math.PI/2+j*Math.PI/5,r=j%2?.022:.052;
      const x=Math.cos(a)*r-.018,y=Math.sin(a)*r+.255;
      if(j===0)star.moveTo(x,y);else star.lineTo(x,y);
    }
    star.closePath();
    const detailTransform=transform.clone();detailTransform.elements[14]=side*.007;
    details.push(new T.ShapeGeometry(star).applyMatrix4(detailTransform));
    const stamen=new T.Shape();stamen.moveTo(0,.015);
    stamen.quadraticCurveTo(-.075,.11,-.035,.205);stamen.lineTo(-.024,.205);
    stamen.quadraticCurveTo(-.060,.11,.010,.018);stamen.closePath();
    details.push(new T.ShapeGeometry(stamen,12).applyMatrix4(detailTransform));
  }
  flag.add(new T.Mesh(mergeGeometries(petals,false),white),new T.Mesh(mergeGeometries(details,false),red));
  petals.concat(details).forEach(g=>g.dispose());
  flag.userData={region:'Hong Kong',petals:5,aspectRatio:1.5};return flag;
}
