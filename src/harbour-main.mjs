import {createBrowserRenderHost} from './harbour/render-host.mjs';

// Main-thread recovery is loaded only if its worker cannot run. It uses a
// fresh canvas in the same page and the same viewport/lighting callbacks.
export async function startMainHarbour({backend,signal,onFailure,...options}) {
  const host=createBrowserRenderHost({...options,signal});
  const module=backend==='webgpu'?await import('./harbour/runtime-webgpu.js'):await import('./harbour/runtime.js');
  if(signal.aborted)throw new DOMException('Renderer disposed','AbortError');
  return backend==='webgpu'?module.startWebGPU({host,onFailure}):module.startWebGL({host,onFailure});
}
