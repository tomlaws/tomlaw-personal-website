import assert from 'node:assert/strict';
import {cloudSunFactor} from '../src/harbour/cloud-sunlight.mjs';

assert.equal(cloudSunFactor(0),1);
assert.equal(cloudSunFactor(2),1);
assert.equal(cloudSunFactor(8),.89);
assert.equal(cloudSunFactor(10),.89);
assert.equal(cloudSunFactor(18),1,'Return fully to the original sunlight');
assert.equal(cloudSunFactor(28),1,'Leave a clear spell between clouds');
for(const t of [-1,NaN,Infinity])assert.equal(cloudSunFactor(t),1);
let previous=1,low=1;
for(let frame=0;frame<30*3600;frame++){
  const t=frame/30,value=cloudSunFactor(t);
  assert.ok(value>=.88&&value<=1,'The sunlight never dims more than 12% or brightens beyond the original');
  assert.ok(Math.abs(value-previous)<.0015,'No jumps or flicker, including cycle boundaries');
  assert.equal(cloudSunFactor(t,1),1,'Night lighting is unchanged');
  assert.equal(cloudSunFactor(t,0,false),1,'Reduced motion keeps steady original sunlight');
  previous=value;low=Math.min(low,value);
}
assert.ok(low<.90);
assert.ok(cloudSunFactor(8,.5)>cloudSunFactor(8,0),'Fade the cloud effect toward dusk');
assert.notEqual(cloudSunFactor(8),cloudSunFactor(44),'Successive clouds have different timing/depth');
console.log('Cloud sunlight: slow continuous 7–12% envelopes, full recovery, clear spells, irregular cycles, steady night and reduced motion passed.');
