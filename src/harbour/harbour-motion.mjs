import * as T from 'three';

export function createHarbourMotion(boats,{ferryWake,waterLevel,ripples:preparedRipples}) {
  const ferry=boats.find(b=>b.design==='star');
  const ripples=preparedRipples??[ferryWake].flatMap((wake,wakeIndex)=>
    wake.children.filter(child=>child.geometry?.type==='RingGeometry').map((ring,index)=>{
      ring.material=ring.material.clone();
      return {ring,scale:ring.scale.clone(),opacity:ring.material.opacity,phase:index/3+wakeIndex*.17};
    }));
  const animate=time=>{
    for(const ripple of ripples){
      const progress=T.MathUtils.euclideanModulo(time*.42+ripple.phase,1);
      // Expand within the existing wake footprint and disappear before recycling.
      ripple.ring.scale.copy(ripple.scale).multiplyScalar(.70+.30*progress);
      ripple.ring.material.opacity=ripple.opacity*Math.pow(Math.sin(Math.PI*progress),1.2);
    }
    // A double-ended Star Ferry reverses without turning its hull around.
    const travel=4*Math.sin(time*.10),direction=Math.cos(time*.10)>=0?1:-1;
    ferry.g.position.set(ferry.x+Math.sin(ferry.angle)*travel,
      waterLevel+.08+Math.sin(time*.7)*.018,ferry.z+Math.cos(ferry.angle)*travel);
    ferry.g.rotation.set(Math.sin(time*.41)*.008,ferry.angle,Math.sin(time*.53)*.012);
    ferryWake.position.set(ferry.g.position.x,waterLevel+.016,ferry.g.position.z);
    ferryWake.rotation.y=ferry.angle+(direction<0?Math.PI:0);
    for(const boat of boats)boat.g.updateMatrixWorld(true);
    ferryWake.updateMatrixWorld(true);
  };
  animate.state={ripples,ferryWake,waterLevel};
  return animate;
}
