import "./map.css";
import { harbourTime } from '../hong-kong-time.mjs';
import { setHarbourBackdrop } from './backdrop.mjs';

setHarbourBackdrop(harbourTime().night);
function showError(error) {
  console.error("Harbour initialization failed", error);
  const loading = document.getElementById("loading");
  loading.hidden = false;
  loading.className = "error";
  loading.querySelector("p").textContent =
    "The harbour could not load. Please reload or try a browser with WebGL enabled.";
  if (parent !== window)
    parent.postMessage({ type: "harbour:error" }, location.origin);
}

// The measured full-resolution WebGL path has the lower cold-start cost for
// this scene. Native WebGPU remains available by explicit renderer selection.
const requested = new URLSearchParams(location.search).get('renderer')??'webgl';
function freshCanvas() {
  const previous = document.getElementById('world');
  const canvas = previous.cloneNode(false); previous.replaceWith(canvas);
  return canvas;
}
let fallbackStarted = false;
let currentRenderer;
import.meta.hot?.dispose(() => currentRenderer?.dispose());
async function startLegacy(reason) {
  if (fallbackStarted) return;
  fallbackStarted = true;
  if (reason) console.warn('WebGPU initialization failed; using the preserved WebGL renderer.', reason);
  // A canvas cannot change context type after WebGPU has claimed it.
  const canvas = freshCanvas();
  document.documentElement.dataset.renderer = 'webgl'; canvas.dataset.renderer = 'webgl';
  document.documentElement.dataset.renderThread = 'main';
  console.info('[harbour-renderer] webgl');
  await import('./runtime.js');
}

let mainStarted = false;
async function startNativeOnMain(reason) {
  if (mainStarted) return; mainStarted = true;
  if (reason) { console.warn('Render worker unavailable; trying main-thread WebGPU.', reason); freshCanvas(); }
  const { startWebGPU } = await import('./runtime-webgpu.js');
  try { currentRenderer = await startWebGPU({onFailure:error=>startLegacy(error).catch(showError)}); }
  catch (error) { if (error.name !== 'AbortError') await startLegacy(error); }
}

try {
  if (requested === 'webgl' || !navigator.gpu) {
    await startLegacy();
  } else {
    const mainFixture = import.meta.env.DEV && new URLSearchParams(location.search).get('qaThread') === 'main';
    if (!mainFixture && typeof Worker !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype) {
      const { startWorkerRenderer } = await import('./worker-controller.mjs');
      try { currentRenderer = await startWorkerRenderer({onFailure:error=>startNativeOnMain(error).catch(showError)}); }
      catch (error) { await startNativeOnMain(error); }
    } else await startNativeOnMain();
  }
} catch (error) { showError(error); }
