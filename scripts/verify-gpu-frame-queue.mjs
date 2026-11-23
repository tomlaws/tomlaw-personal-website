import assert from 'node:assert/strict';
import {createGpuFrameQueue} from '../src/harbour/gpu-frame-queue.mjs';
import {backgroundFrameDue,nextBackgroundFrame} from '../src/harbour/frame-pacing.mjs';

assert.equal(backgroundFrameDue(33,1000/30),true,'Rounded Safari timestamps retain the next refresh');
assert.equal(backgroundFrameDue(31,1000/30),false,'The timestamp tolerance preserves the frame cap');
for(const hz of [60,120]){
  let deadline=-Infinity,frames=0;
  for(let tick=0;tick<hz*5;tick++){
    const now=Math.round(tick*1000/hz);
    if(backgroundFrameDue(now,deadline)){frames++;deadline=nextBackgroundFrame(deadline,now,now+6,30,.85);}
  }
  assert.ok(frames>=149&&frames<=151,'Rounded 60/120 Hz clocks sustain the 30 FPS average');
}

function simulatedGpu() {
  let time=0, created=0, deleted=0, flushes=0;
  const live=new Set();
  const gl={TIMEOUT_EXPIRED:1,CONDITION_SATISFIED:2,WAIT_FAILED:3,SYNC_GPU_COMMANDS_COMPLETE:4,
    getExtension:()=>null,
    fenceSync(){const fence={ready:time+50,id:++created};live.add(fence);return fence;},
    clientWaitSync(fence,flags,timeout){assert.equal(flags,0);assert.equal(timeout,0);return time<fence.ready?1:2;},
    deleteSync(fence){assert.ok(live.delete(fence),'Each fence is deleted exactly once');deleted++;},
    flush(){flushes++;},
  };
  return {gl,now:()=>time,setTime:value=>{time=value;},live,counts:()=>({created,deleted,flushes})};
}

// Reproduce a 50 ms worker/GPU completion round trip at 60 Hz. Frames can
// overlap that latency without building an unbounded submission backlog.
for(const capacity of [1,2]){
  const gpu=simulatedGpu(),queue=createGpuFrameQueue(gpu.gl,capacity,gpu.now);
  let submitted=0,finished=0,deadline=-Infinity,maxPending=0;
  for(let i=0;i<180;i++){
    const now=i*1000/60;gpu.setTime(now);
    for(const frame of queue.poll()){
      finished++;
      assert.equal(frame.cpuMs,6);
      assert.equal(frame.stats.triangles,143584);
      assert.ok(frame.completed-frame.started>=50);
    }
    if(queue.pending>=capacity||!backgroundFrameDue(now,deadline))continue;
    const frame=queue.begin({started:now,timestamp:now});
    queue.submit(frame,{cpuMs:6,stats:{triangles:143584}});
    submitted++;maxPending=Math.max(maxPending,queue.pending);
    deadline=nextBackgroundFrame(deadline,now,now+6,30,.85);
  }
  assert.ok(maxPending<=capacity);
  if(capacity===2){assert.ok(submitted>=89&&submitted<=91);assert.ok(finished>=87,'Completed frames sustain the target cadence');}
  else assert.ok(submitted<75,'Serial completion checks reproduce the throughput bottleneck');
  queue.dispose();queue.dispose();
  assert.equal(gpu.live.size,0);
  assert.deepEqual(gpu.counts(),{created:submitted,deleted:submitted,flushes:submitted});
  assert.throws(()=>queue.begin({started:0}),/disposed/);
}
const gpu=simulatedGpu(),queue=createGpuFrameQueue(gpu.gl,2,gpu.now);
queue.submit(queue.begin({started:0,id:'first'}));
gpu.setTime(1);queue.submit(queue.begin({started:1,id:'second'}));
assert.throws(()=>queue.begin({started:2}),/full/);
gpu.setTime(50);assert.deepEqual(queue.poll().map(frame=>frame.id),['first']);
assert.equal(queue.pending,1);
gpu.setTime(51);assert.deepEqual(queue.poll().map(frame=>frame.id),['second']);
queue.dispose();

// GPU elapsed queries must belong to a slot, not be overwritten by a later
// submission while the earlier frame is still awaiting its fence reply.
const timed=simulatedGpu();
let activeQuery,queryId=0,disposedQueries=0;
Object.assign(timed.gl,{
  QUERY_RESULT_AVAILABLE:10,QUERY_RESULT:11,
  getExtension:()=>({TIME_ELAPSED_EXT:12,GPU_DISJOINT_EXT:13}),
  createQuery:()=>({id:++queryId}),
  beginQuery(type,query){assert.equal(activeQuery,undefined);activeQuery=query;},
  endQuery(){assert.ok(activeQuery);activeQuery=undefined;},
  getParameter:()=>false,
  getQueryParameter:(query,key)=>key===10?true:query.id*5e6,
  deleteQuery(){disposedQueries++;},
});
const timedQueue=createGpuFrameQueue(timed.gl,2,timed.now);
timedQueue.submit(timedQueue.begin({started:0}));
timedQueue.submit(timedQueue.begin({started:0}));
timed.setTime(50);
assert.deepEqual(timedQueue.poll().map(frame=>frame.gpuMs),[5,10]);
timedQueue.dispose();assert.equal(disposedQueries,2);

const failed=simulatedGpu(),failedQueue=createGpuFrameQueue(failed.gl,2,failed.now);
failedQueue.submit(failedQueue.begin({started:0}));
failed.gl.clientWaitSync=()=>failed.gl.WAIT_FAILED;
assert.throws(()=>failedQueue.poll(),/fence failed/);
failedQueue.dispose();assert.equal(failed.live.size,0,'Failure cleanup releases pending fences before fallback');
console.log('GPU frame queue: bounded overlap, completed-frame cadence, frame timing ownership, non-blocking polls and complete fence cleanup passed.');
