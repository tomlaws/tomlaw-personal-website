import {startWorkerRenderer} from './harbour/worker-controller.mjs';
import {startMainHarbour} from './harbour-main.mjs';
import {connectHarbourActivity} from './harbour-activity.mjs';
import {startLoadingTimeout} from './loading-timeout.mjs';
import {harbourTime} from './hong-kong-time.mjs';

export function harbourRenderAttempts({backend='webgl',worker=true,webgpu=false,mainOnly=false}={}) {
  const backends=backend==='webgpu'&&webgpu?['webgpu','webgl']:['webgl'];
  return backends.flatMap(backend=>[...(worker&&!mainOnly?[{backend,thread:'worker'}]:[]),{backend,thread:'main'}]);
}

// Every attempt owns a fresh canvas in this document. Backend/thread recovery
// never changes page structure or introduces a second document.
export function startInlineHarbour({surface,hero,search,onReady,onRecovering=()=>{},onError,
  drivers={worker:startWorkerRenderer,main:startMainHarbour}}) {
  const params=new URLSearchParams(search);
  const attempts=harbourRenderAttempts({backend:params.get('renderer')??'webgl',webgpu:Boolean(globalThis.navigator?.gpu),
    worker:typeof Worker!=='undefined'&&typeof HTMLCanvasElement!=='undefined'&&'transferControlToOffscreen' in HTMLCanvasElement.prototype,
    mainOnly:import.meta.env?.DEV&&params.get('qaThread')==='main'});
  let disposed=false,terminal=false,index=0,generation=0,current,abort,controls,stopTimeout=()=>{};
  const activity=connectHarbourActivity({hero,onError(){terminal=true;generation++;stopAttempt();onError();},
    setActive:value=>controls?.setActive(value),setScrolling:value=>controls?.setScrolling(value)});
  function stopAttempt(){stopTimeout();abort?.abort();current?.dispose();current=undefined;controls=undefined;}
  function fail(error,token){
    if(disposed||terminal||token!==generation)return;
    stopAttempt();
    if(index===attempts.length){terminal=true;activity.fail();return;}
    onRecovering(error);launch();
  }
  function launch(){
    if(disposed||terminal)return;
    const token=++generation,attempt=attempts[index++];
    abort=new AbortController();
    const signal=abort.signal,canvas=document.createElement('canvas');
    canvas.className='city-canvas';canvas.setAttribute('aria-hidden','true');surface.replaceChildren(canvas);
    const alive=()=>!disposed&&!terminal&&token===generation;
    const ready=()=>{if(!alive())return;stopTimeout();activity.ready();onReady();};
    const connect=value=>{
      if(!alive())return ()=>{};
      controls=value;
      const update=()=>{if(!document.hidden&&alive())value.setTime(harbourTime().night);};
      const timer=setInterval(update,30_000);document.addEventListener('visibilitychange',update);
      update();activity.sync();
      if(attempt.thread==='worker')ready();
      return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);if(controls===value)controls=undefined;};
    };
    stopTimeout=startLoadingTimeout(()=>fail(new Error('City renderer startup timed out'),token),{timeoutMs:90_000});
    Promise.resolve().then(()=>{
      if(!alive())return;
      return drivers[attempt.thread]({backend:attempt.backend,canvas,search,signal,connect,onReady:ready,
        viewport:()=>({width:canvas.clientWidth,height:canvas.clientHeight,dpr:devicePixelRatio}),
        onFailure:error=>fail(error,token)});
    }).then(renderer=>{if(!renderer)return;if(!alive())renderer.dispose();else current=renderer;})
      .catch(error=>fail(error,token));
  }
  // React StrictMode may clean up before this microtask; its canvas remains reusable.
  Promise.resolve().then(()=>{if(!disposed)launch();});
  return {dispose(){if(disposed)return;disposed=true;generation++;stopAttempt();activity.dispose();surface.replaceChildren();}};
}
