import {startWorkerRenderer} from './harbour/worker-controller.mjs';
import {connectHarbourFrame} from './harbour-frame.mjs';
import {harbourTime} from './hong-kong-time.mjs';

// Keep the live GPU surface in the page's own scrolling layer tree. A nested
// iframe needs another backing surface and its own viewport-constrained canvas.
// Rendering, asset parsing and shader setup still happen in the same worker.
export function startInlineHarbour({canvas,hero,search,onReady,onFallback}) {
  const abort = new AbortController();
  let disposed=false,failed=false,controls;
  const channel={postMessage(data){
    if(data.command==='active')controls?.setActive(data.active);
    if(data.command==='scrolling')controls?.setScrolling(data.scrolling);
  }};
  function fallback(error) {
    if(disposed||failed)return;
    failed=true;activity.dispose();abort.abort();onFallback(error);
  }
  const activity=connectHarbourFrame({channel,hero,onReady,onError:()=>fallback(new Error('City startup timed out'))});
  const viewport=()=>({width:canvas.clientWidth,height:canvas.clientHeight,dpr:devicePixelRatio});
  // StrictMode can clean up before the next microtask. Do not transfer its
  // reusable canvas until that initial cleanup has had a chance to run.
  Promise.resolve().then(()=>{if(disposed)return;return startWorkerRenderer({backend:'webgl',canvas,search,viewport,signal:abort.signal,onFailure:fallback,
    connect(value){
      controls=value;
      const update=()=>{if(!document.hidden)controls.setTime(harbourTime().night);};
      const timer=setInterval(update,30_000);
      document.addEventListener('visibilitychange',update);
      update();activity.ready();
      return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);controls=undefined;};
    },
  });}).catch(error=>{if(error.name!=='AbortError')fallback(error);});
  return {sync:activity.sync,fail:activity.fail,dispose(){if(disposed)return;disposed=true;activity.dispose();abort.abort();}};
}
