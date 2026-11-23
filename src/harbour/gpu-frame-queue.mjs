import {createGpuFrameTimer} from './gpu-frame-timer.mjs';

// WebKit's worker/GPU-process round trip can outlast a refresh even when
// rendering is cheap. Allow two bounded submissions instead of serialising
// that round trip with every frame. Never wait synchronously or drop fences.
export function createGpuFrameQueue(gl, capacity = 2, now = () => performance.now()) {
  const slots = Array.from({length:capacity}, () => ({timer:createGpuFrameTimer(gl), busy:false}));
  const pending = [];
  let disposed = false;
  return {
    get pending() { return pending.length; },
    begin(data) {
      const slot = slots.find(slot => !slot.busy);
      if (disposed || !slot) throw new Error('GPU frame queue is full or disposed');
      slot.busy = true;
      slot.timer.begin();
      return {slot, ...data, lastBusyAt:data.started};
    },
    submit(frame, data) {
      Object.assign(frame, data);
      frame.slot.timer.end();
      frame.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!frame.fence) throw new Error('GPU frame fence creation failed');
      pending.push(frame);
      gl.flush();
    },
    poll() {
      const completed = [];
      while (pending.length) {
        const frame = pending[0], status = gl.clientWaitSync(frame.fence, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED) { frame.lastBusyAt = now(); break; }
        if (status === gl.WAIT_FAILED) throw new Error('GPU frame fence failed');
        pending.shift();
        gl.deleteSync(frame.fence);
        frame.slot.busy = false;
        completed.push({...frame, completed:now(), gpuMs:frame.slot.timer.read()});
      }
      return completed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const frame of pending) gl.deleteSync(frame.fence);
      pending.length = 0;
      for (const slot of slots) slot.timer.dispose();
    },
  };
}
