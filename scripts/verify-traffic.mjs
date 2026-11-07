import assert from 'node:assert/strict';
import { TRAFFIC, STOP_DISTANCE, CROSSING_DISTANCE, signalPhase, createRoadTraffic, advanceRoadTraffic } from '../src/trafficSignals.js';
import { ROAD_LENGTH, routePoint } from '../src/cityMath.js';

const mod=(v,n)=>((v%n)+n)%n;
const x=routePoint(STOP_DISTANCE)[0];
assert(Math.abs(x-TRAFFIC.vehicleNose-TRAFFIC.stopLineX-TRAFFIC.stopMargin)<1e-8);
assert.deepEqual([0,16,19,32,34].map(t=>signalPhase(t).aspect),['green','amber','red','red-amber','green']);
assert(signalPhase(21).pedestrianGreen&&!signalPhase(21).pedestrianRed);
assert(signalPhase(27).pedestrianGreen&&!signalPhase(27.5).pedestrianGreen);
assert(signalPhase(30).pedestrianRed);
for(let t=0;t<TRAFFIC.cycle;t+=.01){
  const p=signalPhase(t);assert(!(p.green&&p.red));
  if(p.pedestrianClearance)assert(p.red&&!p.amber&&!p.green);
}

function simulate(hz,seconds=600){
  const state=createRoadTraffic();let stops=0,restarts=0;
  for(let i=0;i<seconds*hz;i++){
    const before=state.cars.map(c=>({...c}));
    const phase=advanceRoadTraffic(state,1/hz);
    state.cars.forEach((c,j)=>{
      const old=before[j];
      assert(c.distance>=old.distance&&c.distance-old.distance<=TRAFFIC.cruiseSpeed/hz+1e-8,'No reversing or teleporting');
      assert(c.speed>=0&&c.speed<=TRAFFIC.cruiseSpeed,'Bounded vehicle speed');
      assert(c.speed-old.speed<=TRAFFIC.acceleration/hz+1e-8,'Smooth restart');
      assert(old.speed-c.speed<=TRAFFIC.braking/hz+1e-8,'Smooth braking');
      if(old.speed>.01&&c.speed<=.01)stops++;
      if(old.speed<.01&&c.speed>=.01)restarts++;
      const crossingOffset=mod(c.distance-CROSSING_DISTANCE+ROAD_LENGTH/2,ROAD_LENGTH)-ROAD_LENGTH/2;
      if(phase.pedestrianClearance)assert(Math.abs(crossingOffset)>TRAFFIC.vehicleNose+TRAFFIC.crossingHalfWidth,'Keep entire vehicle clear during pedestrian phase');
      if(old.speed===0&&phase.aspect==='red-amber')assert.equal(c.speed,0,'Wait through red–amber');
    });
    for(let j=0;j<2;j++)assert(mod(state.cars[1-j].distance-state.cars[j].distance,ROAD_LENGTH)>=TRAFFIC.vehicleLength+TRAFFIC.minimumGap-1e-6,'Safe following distance');
  }
  assert(stops>=8&&restarts>=8,'Actually stop and restart repeatedly');return state;
}
const normal=simulate(60);
for(const hz of [30,120]){
  const other=simulate(hz);
  for(let i=0;i<2;i++)assert(Math.abs(other.cars[i].distance-normal.cars[i].distance)<.06,'Stable motion across frame rates');
}
// An approaching vehicle too close to stop at amber must clear before green pedestrians.
for(const gap of [.1,1,2,3,4,6]){
  const state=createRoadTraffic();state.time=TRAFFIC.amberAt-1/120;
  state.cars[0].distance=STOP_DISTANCE-gap;state.cars[1].distance=STOP_DISTANCE-gap-ROAD_LENGTH/2;
  for(let i=0;i<15*120;i++){
    const phase=advanceRoadTraffic(state,1/120),car=state.cars[0];
    if(phase.pedestrianClearance){
      const d=car.distance-CROSSING_DISTANCE;
      assert(Math.abs(d)>TRAFFIC.vehicleNose+TRAFFIC.crossingHalfWidth,'Amber clearance protects the crossing');
    }
  }
}
const paused=createRoadTraffic(),copy=structuredClone(paused);
advanceRoadTraffic(paused,0);assert.deepEqual(paused,copy);
advanceRoadTraffic(paused,30);assert(Math.abs(paused.time-copy.time-.08)<1e-8,'Clamp background-tab resume');
console.log('✓ Traffic: phased lamps, smooth stops/restarts, amber clearance, safe headways, pause, and 30/60/120 Hz consistency');
