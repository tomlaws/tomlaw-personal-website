import assert from 'node:assert/strict';
import { Color, MeshStandardMaterial } from 'three';
import { bindNightFinish, applyNightFinish, nightStyleMix, nightLightProfile } from '../src/nightStyle.js';
import { sampleAtmosphere,KEYFRAMES } from '../src/cityMath.js';

const paving=new MeshStandardMaterial({color:'#ffffff',roughness:.86});
const day=paving.color.clone();
bindNightFinish(paving,'Paving stone');
applyNightFinish(paving,1);
assert(paving.color.b>paving.color.r*2,'Night paving must read as indigo, not neutral white');
assert(paving.roughness<.86&&paving.roughness>.6,'Retain stone texture rather than mirror paving');
applyNightFinish(paving,.08);
assert(paving.color.equals(day));assert.equal(paving.roughness,.86,'Daylight must restore the authored finish');
// Repeated simulation changes must not accumulate colour drift.
for(let i=0;i<100;i++){applyNightFinish(paving,1);applyNightFinish(paving,.08);}
assert(paving.color.equals(day));
for(const key of ['Window glass','Traffic red','Pedestrian green','Leaf','Taxi paint','Honey interior','Wood']){
  const m=new MeshStandardMaterial({color:'#b68b59'}),before=m.color.clone();
  bindNightFinish(m,key);applyNightFinish(m,1);assert(m.color.equals(before),`${key} must preserve its own palette`);
}
const lens=new MeshStandardMaterial({color:'#13d9ff',emissive:'#13d9ff',emissiveIntensity:6.5});
lens.userData.baseEmission=6.5;bindNightFinish(lens,'Night cyan');
applyNightFinish(lens,.08);assert.equal(lens.emissiveIntensity,0);
applyNightFinish(lens,1);assert.equal(lens.emissiveIntensity,6.5);
const cyan=new Color('#13d9ff');
assert(Math.max(...['r','g','b'].map(k=>Math.abs(lens.color[k]-cyan[k])))<1e-12);
for(const {hour} of KEYFRAMES){
  const a=nightStyleMix(sampleAtmosphere(hour-1e-7).night),b=nightStyleMix(sampleAtmosphere(hour+1e-7).night);
  assert(Math.abs(a-b)<1e-5,'Art direction must remain continuous at time keyframes');
}
for(const name of ['Galleria ground ceiling','Galleria upper west retail ambient','Galleria library ceiling','Galleria dining ceiling']){
  const p=nightLightProfile({name,color:'#ffffff'});assert(p.gain<.6);assert(p.night.r>p.night.b,'Keep interiors amber against the cool city');
}
assert(nightLightProfile({name:'Night cinema crown wash',color:'#fc369f'}).gain<1,'A fitted neon channel should not flood the whole cinema facade');
console.log('✓ Night palette restores exact daytime finishes, preserves room/traffic colors, and transitions without drift or cuts');
