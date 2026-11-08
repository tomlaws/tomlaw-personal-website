import { startWebGL } from './runtime.js';
import { createWorkerRenderHost } from './render-host.mjs';

let host, failed = false;
const fail = error => {
  if (failed) return; failed = true;
  postMessage({type:'error', message:error.message ?? String(error)});
};
addEventListener('message', async ({data}) => {
  if (data.type === 'init') {
    if (host) return;
    host = createWorkerRenderHost(data.canvas, data.state, message => postMessage(message));
    try { await startWebGL({host, onFailure:fail}); } catch (error) { fail(error); }
  } else host?.receive(data);
});
