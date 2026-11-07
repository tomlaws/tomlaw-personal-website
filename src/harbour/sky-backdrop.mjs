import * as T from 'three';

// A directional sky panorama at infinity. Camera yaw and pitch change which
// part is visible; translation and orthographic map zoom create no parallax.
export function createSkyBackdrop(renderer) {
  const target=new T.WebGLRenderTarget(1024,1024,{type:T.HalfFloatType,depthBuffer:false,stencilBuffer:false});
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,2);camera.position.z=1;
  const uniforms={uAspect:{value:1},uNight:{value:0},uViewRotation:{value:new T.Matrix3()},uTanHalfFov:{value:Math.tan(T.MathUtils.degToRad(40))},uDay:{value:new T.Color('#bedfe9')},uNightSky:{value:new T.Color('#0b1225')},uCloud:{value:new T.Color('#f4f8fc')},uMoon:{value:new T.Color('#d7e6ff')},uSun:{value:new T.Color('#ffdd9b')}};
  const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:`
    varying vec2 vUv;
    void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}
  `,fragmentShader:`
    varying vec2 vUv;
    uniform float uAspect,uNight,uTanHalfFov;
    uniform mat3 uViewRotation;
    uniform vec3 uDay,uNightSky,uCloud,uMoon,uSun;
    float ellipse(vec2 p,vec2 center,vec2 radius){return length((p-center)/radius)-1.0;}
    vec2 angularOffset(vec2 direction,vec2 anchor){
      float longitude=mod(direction.x-anchor.x+3.14159265,6.2831853)-3.14159265;
      return vec2(longitude*cos(anchor.y),direction.y-anchor.y);
    }
    float cloud(vec2 direction,vec2 anchor,float size){
      vec2 q=angularOffset(direction,anchor)/(size*1.55);
      float d=ellipse(q,vec2(0.0,-.015),vec2(.084,.027));
      d=min(d,ellipse(q,vec2(-.037,.006),vec2(.033,.030)));
      d=min(d,ellipse(q,vec2(.001,.026),vec2(.040,.040)));
      d=min(d,ellipse(q,vec2(.047,.003),vec2(.030,.028)));
      return 1.0-smoothstep(-.12,.20,d);
    }
    float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
    void main(){
      vec2 ndc=vUv*2.0-1.0;
      vec3 ray=normalize(uViewRotation*vec3(ndc.x*uAspect*uTanHalfFov,ndc.y*uTanHalfFov,-1.0));
      vec2 direction=vec2(atan(ray.x,-ray.z),asin(clamp(ray.y,-1.0,1.0)));
      vec3 sky=mix(uDay,uNightSky,uNight);
      // Distant city light scattered through humid air along the horizon.
      float harbourHaze=exp(-pow((ray.y+.10)/.48,2.0))*uNight;
      sky+=vec3(.014,.021,.031)*harbourHaze;
      float dusk=sin(uNight*3.14159265);
      sky=mix(sky,vec3(.42,.24,.30),dusk*.32);
      sky*=mix(1.08,.90,smoothstep(-.8,.4,ray.y));
      vec2 moon=vec2(-.38,-.093);
      vec3 moonDirection=vec3(sin(moon.x)*cos(moon.y),sin(moon.y),-cos(moon.x)*cos(moon.y));
      float distanceToMoon=acos(clamp(dot(ray,moonDirection),-1.0,1.0));
      vec3 orbColor=mix(uSun,uMoon,uNight);
      float halo=exp(-distanceToMoon*distanceToMoon/.006);
      sky+=orbColor*halo*mix(.025,.045,uNight);
      float disc=1.0-smoothstep(.030,.0315,distanceToMoon);
      vec2 lunar=angularOffset(direction,moon);
      float craters=0.0;
      craters+=1.0-smoothstep(.004,.007,length(lunar-vec2(-.008,.009)));
      craters+=1.0-smoothstep(.002,.005,length(lunar-vec2(.012,-.010)));
      sky=mix(sky,orbColor*(1.0-craters*.10*uNight),disc);
      float clouds=cloud(direction,vec2(-1.21,-.117),1.10);
      clouds=max(clouds,cloud(direction,vec2(-.227,-.307),.85));
      clouds=max(clouds,cloud(direction,vec2(-1.479,-.52),.70));
      clouds=max(clouds,cloud(direction,vec2(1.0,-.18),1.0));
      clouds=max(clouds,cloud(direction,vec2(2.2,-.35),.85));
      clouds=max(clouds,cloud(direction,vec2(-2.8,-.24),1.15));
      vec3 cloudColor=mix(uCloud,vec3(.18,.28,.43),uNight);
      sky=mix(sky,cloudColor,clouds*mix(.64,.12,uNight));
      vec2 starGrid=vec2((direction.x+3.14159265)*24.0,(direction.y+1.570796)*32.0);
      vec2 cell=floor(starGrid);
      float seed=cell.x+cell.y*157.0;
      vec2 dotPosition=vec2(.2+.6*hash(seed+2.0),.2+.6*hash(seed+9.0));
      float stars=(1.0-smoothstep(.025,.055,length(fract(starGrid)-dotPosition)))*step(.975,hash(seed));
      sky+=uMoon*stars*uNight*.20;
      gl_FragColor=vec4(sky,1.0);
    }
  `});
  scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
  function render(){const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(previous);}
  function resize(width,height){const scale=Math.min(1,1536/Math.max(width,height));target.setSize(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));uniforms.uAspect.value=width/height;render();}
  function setNight(night){uniforms.uNight.value=Number(night);render();}
  const previousOrientation=new T.Quaternion(0,0,0,0),rotationMatrix=new T.Matrix4();
  function setView(viewCamera){
    if(1-Math.abs(previousOrientation.dot(viewCamera.quaternion))<1e-8)return;
    previousOrientation.copy(viewCamera.quaternion);
    rotationMatrix.makeRotationFromQuaternion(viewCamera.quaternion);
    uniforms.uViewRotation.value.setFromMatrix4(rotationMatrix);render();
  }
  return {texture:target.texture,resize,setNight,setView};
}

// The map is orthographic, so its sky uses a fixed perspective angular view.
// This is equivalent to a skybox camera sharing only the map camera's rotation.
export function skyViewDirection(camera,x,y,aspect=1){
  const scale=Math.tan(T.MathUtils.degToRad(40));
  return new T.Vector3(x*aspect*scale,y*scale,-1).normalize().applyQuaternion(camera.quaternion);
}
