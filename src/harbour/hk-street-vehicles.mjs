import {prepareVehicleGlazing} from './legacy-glazing.mjs';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// +X is forward, +Z is the driver's right: passenger doors belong on -Z.
export function createHongKongVehicle(kind){
  const bus=kind==='bus',bodyLength=bus?2:1,width=bus?.425:.37;
  const root=new T.Group();root.name=bus?'Hong Kong Enviro500 double-decker':'Hong Kong Toyota Comfort taxi';
  root.userData.kind=kind;root.userData.partBounds={};
  const paint=new T.MeshStandardMaterial({color:bus?'#e6cb91':'#dc6963',roughness:.55,metalness:.08});
  const silver=new T.MeshStandardMaterial({color:'#e5e8df',roughness:.45,metalness:.18});
  const dark=new T.MeshStandardMaterial({color:'#40505a',roughness:.72});
  const glass=new T.MeshPhysicalMaterial({color:'#5d849a',roughness:.055,metalness:.32,clearcoat:1,clearcoatRoughness:.025,
    ior:1.52,specularIntensity:1,envMapIntensity:1.8,emissive:'#ffe4b3',emissiveIntensity:0});
  glass.name=bus?'Bus reflective illuminated glass':'Taxi reflective tinted glass';
  prepareVehicleGlazing(glass);
  const lamp=new T.MeshStandardMaterial({color:'#fff0d4',emissive:'#ffdfa0',emissiveIntensity:.3});
  const red=new T.MeshStandardMaterial({color:'#ab252c',emissive:'#d83530',emissiveIntensity:.12});
  const amber=new T.MeshStandardMaterial({color:'#edb154',emissive:'#ffb63b',emissiveIntensity:.35});
  const parts=new Map();
  function add(name,geometry,material){
    geometry.computeBoundingBox();
    // Keep face-mounted glass, badges and lamps outside the softened body skin.
    const bounds=geometry.boundingBox,centre=(bounds.min.x+bounds.max.x)/2;
    if(Math.abs(centre)>=bodyLength/2-.006&&bounds.max.x-bounds.min.x<.06){
      geometry.translate(Math.sign(centre)*.014,0,0);geometry.computeBoundingBox();
    }
    root.userData.partBounds[name]=geometry.boundingBox.clone();
    if(material===glass){
      const b=geometry.boundingBox,p=geometry.attributes.position,uv=[];
      const axis=b.max.x-b.min.x>b.max.z-b.min.z?'x':'z';
      for(let i=0;i<p.count;i++){
        const across=axis==='x'?p.getX(i):p.getZ(i);
        uv.push((across-b.min[axis])/Math.max(b.max[axis]-b.min[axis],.001),(p.getY(i)-b.min.y)/Math.max(b.max.y-b.min.y,.001));
      }
      geometry.setAttribute('vehicleLightUV',new T.Float32BufferAttribute(uv,2));
      const gain=bus&&name==='Lower panoramic windscreen'?.25:bus&&/passenger door/.test(name)?.65:1;
      geometry.setAttribute('vehicleLightGain',new T.Float32BufferAttribute(new Float32Array(p.count).fill(gain),1));
    }
    if(!parts.has(material))parts.set(material,[]);
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    if(flat!==geometry)geometry.dispose();parts.get(material).push(flat);
  }
  function box(name,w,h,d,x,y,z,material,r=.006){
    if(material===glass&&(w<.025||d<.025)){
      const front=w<.025,pw=front?d:w,thickness=front?w:d,corner=Math.min(.025,h*.18,pw*.12);
      const s=new T.Shape(),a=pw/2,b=h/2,c=corner;
      s.moveTo(-a+c,-b);s.lineTo(a-c,-b);s.quadraticCurveTo(a,-b,a,-b+c);
      s.lineTo(a,b-c);s.quadraticCurveTo(a,b,a-c,b);s.lineTo(-a+c,b);s.quadraticCurveTo(-a,b,-a,b-c);
      s.lineTo(-a,-b+c);s.quadraticCurveTo(-a,-b,-a+c,-b);
      const g=new T.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:false,curveSegments:4});g.translate(0,0,-thickness/2);
      if(front)g.rotateY(Math.PI/2);g.translate(x,y,z);add(name,g,material);
    }else add(name,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/4,h/4,d/4)).translate(x,y,z),material);
  }
  function quad(name,points,material){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();add(name,g,material);
  }
  function profile(name,shape,depth,material){
    const bevel=name==='Silver sloping cabin'?.008:.012;
    const g=new T.ExtrudeGeometry(shape,{depth:depth-2*bevel,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3});
    g.translate(0,0,-depth/2+bevel);add(name,g,material);
  }
  const glyphs={
    '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
    '4':['101','101','111','001','001'],'A':['010','101','111','101','101'],
    'B':['110','101','110','101','110'],'C':['111','100','100','100','111'],
    'E':['111','100','110','100','111'],'I':['111','010','010','010','111'],
    'K':['101','101','110','101','101'],'L':['100','100','100','100','111'],
    'M':['10001','11011','10101','10101','10101'],'N':['1001','1101','1011','1001','1001'],
    'R':['110','101','110','101','101'],'T':['111','010','010','010','010'],
    'X':['101','101','010','101','101'],' ':['0','0','0','0','0']};
  function lettering(name,text,w,h,centre,normal,material){
    const chars=[...text].map(c=>glyphs[c]??glyphs[' ']);
    const columns=chars.reduce((sum,c)=>sum+c[0].length+1,0)-1,cell=w/columns;
    const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...normal));
    let offset=0;
    for(const char of chars){
      for(let row=0;row<5;row++)for(let col=0;col<char[row].length;col++)if(char[row][col]==='1'){
        const g=new T.PlaneGeometry(cell*.82,h/5*.82);
        g.translate(-w/2+(offset+col+.5)*cell,h/2-(row+.5)*h/5,0);
        g.applyQuaternion(rotation);g.translate(...centre);add(name,g,material);
      }
      offset+=char[0].length+1;
    }
  }
  const axles=bus?[-.75,-.48,.65]:[-.31,.31],radius=bus?.090:.075;
  // Open wheel arches let the tyres read independently of the body.
  const shell=new T.Shape();shell.moveTo(-bodyLength/2,radius);
  for(const x of axles){shell.lineTo(x-radius-.026,radius);shell.absarc(x,radius,radius+.026,Math.PI,0,true);}
  shell.lineTo(bodyLength/2,radius);shell.lineTo(bodyLength/2,bus?.69:.182);
  if(bus){shell.quadraticCurveTo(1,.75,.945,.75);shell.lineTo(-.96,.75);shell.quadraticCurveTo(-1,.75,-1,.71);}
  else{shell.lineTo(.43,.198);shell.lineTo(-.42,.198);shell.lineTo(-.5,.18);}
  shell.lineTo(-bodyLength/2,radius);shell.closePath();profile('Wheel-arched body',shell,width,paint);
  if(bus){
    for(const side of [-1,1]){
      const z=side*(width/2+.002);
      box('Upper side window band',1.88,.153,.005,-.015,.638,z,glass);
      box('Lower side window band',1.86,.177,.005,-.025,.371,z,glass);
      for(let i=0;i<7;i++){
        const x=-.84+i*.275;
        box('Upper window pillar',.014,.157,.009,x,.638,z+side*.002,paint);
        box('Lower window pillar',.014,.180,.009,x,.371,z+side*.002,paint);
      }
      box('Gold inter-deck waist',1.98,.060,.009,0,.511,z,paint);
      box('Lower red livery stripe',1.96,.014,.009,0,.233,z,red);
      lettering('Side KMB lettering','KMB',.19,.038,[-.48,.510,z+side*.007],[0,0,side],red);
      box('Rear engine grille',.24,.073,.006,-.85,.276,z,dark);
      for(let i=0;i<3;i++)box('Engine grille slat',.225,.006,.008,-.85,.25+i*.024,z+side*.004,paint);
    }
    box('Upper panoramic windscreen',.008,.154,.368,1.003,.636,0,glass,.002);
    box('Lower panoramic windscreen',.008,.208,.371,1.003,.360,0,glass,.002);
    box('Destination display housing',.011,.066,.377,1.005,.524,0,dark);
    lettering('Front amber destination','104 CENTRAL',.330,.032,[1.012,.524,0],[1,0,0],amber);
    lettering('Front KMB lettering','KMB',.095,.027,[1.008,.226,0],[1,0,0],red);
    for(const side of [-1,1]){
      box('Front windscreen wiper',.012,.006,.14,1.012,.282,side*.091,dark);
      box('Mirror support arm',.11,.009,.015,.93,.481,side*.253,dark);
      box('Bus wing mirror',.034,.069,.022,.973,.455,side*.279,dark);
      box('Front lamp surround',.015,.054,.090,1.009,.182,side*.147,dark);
      for(let i=0;i<3;i++)box('Round front lamp',.018,.017,.017,1.019,.183,side*(.12+i*.025),i===2?amber:lamp,.008);
      box('Rear vertical tail cluster',.012,.081,.028,-1.004,.215,side*.173,red);
    }
    for(const [name,x,w]of [['Front passenger door',.846,.220],['Centre passenger door',-.035,.248]]){
      box(name+' frame',w,.347,.010,x,.283,-.220,dark);
      box(name+' glass',w-.022,.320,.012,x,.290,-.227,glass);
      box(name+' centre seam',.009,.332,.014,x,.285,-.234,dark);
      box(name+' threshold',w,.012,.020,x,.115,-.230,silver);
      for(const dx of [-.035,.035])box(name+' grab handle',.005,.048,.006,x+dx,.294,-.236,silver);
    }
    box('Roof air conditioning pod',.62,.022,.29,-.40,.759,0,paint,.009);
    for(let i=0;i<4;i++)box('Roof ventilation slot',.055,.002,.21,-.61+i*.13,.771,0,dark);
    box('Rear window',.008,.14,.355,-1.003,.635,0,glass);
    box('Rear route display',.008,.043,.14,-1.010,.497,.08,dark);
    lettering('Rear amber route','104',.10,.027,[-1.016,.497,.08],[-1,0,0],amber);
    box('Rear engine access panel',.010,.185,.34,-1.003,.29,0,paint);
    for(let i=0;i<4;i++)box('Rear radiator slat',.014,.008,.23,-1.010,.24+i*.03,0,dark);
  }else{
    const cabin=new T.Shape();cabin.moveTo(-.365,.198);cabin.lineTo(-.227,.328);cabin.lineTo(.114,.328);cabin.lineTo(.268,.198);cabin.closePath();
    profile('Silver sloping cabin',cabin,.342,silver);
    for(const side of [-1,1]){
      const z=side*.173;
      const windows=[['Rear door window',[[-.337,.205],[-.080,.205],[-.080,.314],[-.220,.314]]],['Front door window',[[-.059,.205],[.244,.205],[.107,.314],[-.059,.314]]]];
      for(const [name,points]of windows){const vertices=points.map(([x,y])=>[x,y,z]);quad(name,side>0?vertices:vertices.reverse(),glass);}
      box('Door dividing seam',.004,.091,.003,-.068,.150,side*.188,dark);
      for(const x of [-.263,-.010])box('Chrome door handle',.047,.009,.006,x,.179,side*.190,silver);
      box('Rubber side moulding',.95,.008,.006,0,.122,side*.188,dark);
      lettering('Taxi door lettering','TAXI',.13,.022,[-.202,.143,side*.192],[0,0,side],silver);
      // Traditional 的士 lettering above TAXI, drawn as small silver strokes.
      const strokes=[[[0,0],[.40,0],[.40,.70],[0,.70],[0,0]],[[.12,.70],[.20,.91]],[[0,.35],[.40,.35]],
        [[.52,.56],[.67,.90]],[[.60,.77],[.94,.77],[.91,.04],[.75,0]],[[.63,.48],[.78,.35]],
        [[1.08,.63],[1.95,.63]],[[1.51,.93],[1.51,.04]],[[1.19,.04],[1.83,.04]]];
      for(const stroke of strokes)for(let i=1;i<stroke.length;i++){
        const [a,b]=[stroke[i-1],stroke[i]],dx=(b[0]-a[0])*.037,dy=(b[1]-a[1])*.025;
        const g=new T.PlaneGeometry(Math.hypot(dx,dy),.0015);
        g.rotateZ(Math.atan2(dy,dx));g.translate(((a[0]+b[0])/2-.975)*.037,((a[1]+b[1])/2-.465)*.025,0);
        if(side<0)g.rotateY(Math.PI);g.translate(-.202,.178,side*.192);add('Taxi Chinese door lettering',g,silver);
      }
      box('Taxi mirror stalk',.030,.006,.030,.179,.210,side*.191,silver);
      box('Taxi wing mirror',.041,.022,.024,.180,.219,side*.211,dark,.008);
      box('Rectangular front headlight',.018,.036,.075,.507,.169,side*.127,lamp);
      box('Front indicator',.020,.032,.023,.508,.167,side*.173,amber);
      box('Rear tail lamp',.016,.048,.060,-.507,.165,side*.151,red);
    }
    quad('Sloped front windscreen',[[.277,.205,-.162],[.277,.205,.162],[.145,.316,.162],[.145,.316,-.162]].reverse(),glass);
    quad('Sloped rear windscreen',[[-.374,.205,.160],[-.374,.205,-.160],[-.256,.316,-.160],[-.256,.316,.160]].reverse(),glass);
    box('Silver roof panel',.344,.014,.342,-.057,.327,0,silver,.006);
    box('Taxi roof sign',.042,.034,.130,-.030,.361,0,lamp,.006);
    for(const side of [-1,1])lettering('Roof TAXI lettering','TAXI',.108,.025,[-.030+side*.022,.361,0],[side,0,0],red);
    for(const end of [-1,1]){
      box('Black rubber bumper',.029,.032,.361,end*.504,.110,0,dark,.004);
      box('Chrome bumper trim',.032,.006,.352,end*.506,.129,0,silver);
    }
    box('Chrome front grille surround',.016,.038,.148,.508,.169,0,silver);
    box('Front radiator grille',.019,.026,.130,.518,.169,0,dark);
    for(let i=0;i<3;i++)box('Radiator grille bar',.021,.003,.126,.519,.161+i*.008,0,silver);
  }
  for(const [i,x]of axles.entries())for(const side of [-1,1]){
    const z=side*(width/2+.007);
    add(`Tyre ${i} ${side}`,new T.CylinderGeometry(radius,radius,.025,20).rotateX(Math.PI/2).translate(x,radius,z),dark);
    add(`Wheel hub ${i} ${side}`,new T.CylinderGeometry(radius*.60,radius*.60,.028,16).rotateX(Math.PI/2).translate(x,radius,z+side*.006),silver);
    add('Simple wheel centre',new T.CircleGeometry(radius*.20,12).rotateY(side<0?Math.PI:0).translate(x,radius,z+side*.021),dark);
  }
  for(const end of [-1,1])box('Registration plate',.010,.025,bus?.112:.102,end*(bodyLength/2+.023),bus?.115:.100,0,end>0?silver:amber);
  for(const [material,geometries]of parts){
    const mesh=new T.Mesh(mergeGeometries(geometries,false),material);mesh.name='Vehicle finish batch';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
  const scale=bus?1:.82;root.scale.set(scale,scale*(bus?1.04:1.08),scale);
  root.userData.axles=axles;root.userData.passengerDoorSide=bus?'-Z':null;
  root.userData.headlightPosition=[bodyLength/2+.025,bus?.182:.169,0];
  root.userData.headlightTarget=[bodyLength/2+1.25,.035,0];
  root.userData.setNight=amount=>{glass.emissiveIntensity=amount*(bus?1.15:.10);lamp.emissiveIntensity=.3+amount*1.25;amber.emissiveIntensity=.35+amount*.85;red.emissiveIntensity=.12+amount*.45;};
  const envelope=new T.Box3().setFromObject(root);
  return {group:root,length:2*Math.max(Math.abs(envelope.min.x),Math.abs(envelope.max.x))};
}
