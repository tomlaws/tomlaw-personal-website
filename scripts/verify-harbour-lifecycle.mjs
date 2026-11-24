import assert from 'node:assert/strict';
import { startLoadingTimeout } from '../src/loading-timeout.mjs';
import { connectHarbourActivity } from '../src/harbour-activity.mjs';
import { startWorkerRenderer } from '../src/harbour/worker-controller.mjs';
import { createBrowserRenderHost } from '../src/harbour/render-host.mjs';
import { harbourRenderAttempts, startInlineHarbour } from '../src/inline-harbour.mjs';

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  emit(type, event = {}) { for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event); }
  count() { return [...this.listeners.values()].reduce((sum, list) => sum + list.size, 0); }
}
function fakeClock() {
  let time = 0, nextId = 0;
  const timers = new Map();
  return {
    timers, now: () => time,
    setTimer(fn, delay) { const id = ++nextId; timers.set(id, {fn, at:time + delay}); return id; },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      const end = time + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
        if (!due) break;
        time = due[1].at; timers.delete(due[0]); due[1].fn();
      }
      time = end;
    },
  };
}

// Visible-time deadlines tolerate a background tab and clean up after success.
const clock = fakeClock(), page = Object.assign(new Events(), {hidden:false});
let expired = 0;
const stop = startLoadingTimeout(() => expired++, {timeoutMs:100, document:page,
  now:clock.now, setTimer:clock.setTimer, clearTimer:clock.clearTimer});
clock.advance(40); page.hidden = true; page.emit('visibilitychange');
clock.advance(1_000); assert.equal(expired,0);
page.hidden = false; page.emit('visibilitychange');
clock.advance(59); assert.equal(expired,0);
clock.advance(1); assert.equal(expired,1);
assert.equal(page.count(),0); assert.equal(clock.timers.size,0); stop();
const cancel = startLoadingTimeout(() => expired++, {timeoutMs:100, document:page,
  now:clock.now, setTimer:clock.setTimer, clearTimer:clock.clearTimer});
cancel(); clock.advance(100); assert.equal(expired,1);
assert.equal(page.count(),0);

const saved = new Map();
function install(values) {
  for (const [key,value] of Object.entries(values)) {
    if (!saved.has(key)) saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  }
}
try {
  install({setTimeout:clock.setTimer,clearTimeout:clock.clearTimer,performance:{now:clock.now}});
  const host=Object.assign(new Events(),{innerWidth:390,innerHeight:800,location:{origin:'https://portfolio.example'}});
  const active=[],scrolling=[];
  let bounds={top:80,bottom:930},ready=0,errors=0,observer;
  const hero={getBoundingClientRect:()=>bounds};
  class Observer {
    constructor(callback){this.callback=callback;observer=this;}
    observe(element){assert.equal(element,hero);}
    disconnect(){this.disconnected=true;}
  }
  const options={hero,window:host,document:page,Observer,timeoutMs:100,
    setActive:value=>active.push(value),setScrolling:value=>scrolling.push(value),
    onReady:()=>ready++,onError:()=>errors++};
  const activity=connectHarbourActivity(options);
  assert.equal(active.at(-1),true);
  bounds={top:-1000,bottom:-100};observer.callback([{target:hero,isIntersecting:false}]);
  assert.equal(active.at(-1),false);
  activity.ready();activity.ready();assert.equal(ready,1);
  clock.advance(200);assert.equal(errors,0);
  bounds={top:80,bottom:930};observer.callback([{target:hero,isIntersecting:true}]);
  for(const event of ['touchstart','scroll','touchmove','touchend'])host.emit(event);
  assert.equal(active.at(-1),true,'Touch/momentum scrolling never suspends a visible city');
  assert.equal(scrolling.at(-1),true);
  const edgeCount=scrolling.length;
  clock.advance(100);host.emit('scroll');clock.advance(100);host.emit('scroll');
  assert.equal(scrolling.length,edgeCount,'Repeated scrolling does not flood renderer controls');
  clock.advance(180);assert.equal(scrolling.at(-1),false);
  host.emit('scroll');activity.sync();assert.equal(scrolling.at(-1),true,'Recovery replays activity without a page bridge');
  page.hidden=true;page.emit('visibilitychange');assert.equal(active.at(-1),false);assert.equal(scrolling.at(-1),false);
  page.hidden=false;page.emit('visibilitychange');assert.equal(active.at(-1),true);
  activity.fail();activity.ready();assert.equal(errors,1);assert.equal(ready,1);
  activity.dispose();activity.dispose();assert.equal(host.count(),0);assert.equal(page.count(),0);
  assert.equal(observer.disconnected,true);
  const stalled=connectHarbourActivity({...options,Observer:undefined});
  bounds={top:-1000,bottom:-10};host.emit('scroll');assert.equal(active.at(-1),false);
  bounds={top:80,bottom:930};host.emit('resize');assert.equal(active.at(-1),true);
  clock.advance(100);assert.equal(errors,2);stalled.dispose();
  assert.equal(host.count(),0);assert.equal(page.count(),0);

  const document=Object.assign(new Events(),{hidden:false,documentElement:{dataset:{},style:{setProperty(){}}},
    body:{classList:{toggle(){}}},getElementById:()=>null});
  const events=Object.assign(new Events(),{innerWidth:390,innerHeight:800,location:host.location});
  const preference=Object.assign(new Events(),{matches:false}),workers=[];
  class Worker extends Events{
    constructor(){super();workers.push(this);}
    postMessage(data){(this.messages??=[]).push(data);}
    terminate(){this.terminated=true;}
  }
  class Canvas extends Events{
    dataset={};clientWidth=390;clientHeight=680;
    setAttribute(){}
    transferControlToOffscreen(){return {};}
  }
  document.createElement=tag=>{assert.equal(tag,'canvas','Renderer recovery may only create a canvas');return new Canvas();};
  const surface={history:[],replaceChildren(...nodes){assert.ok(nodes.length<=1);this.canvas=nodes[0];if(nodes[0])this.history.push(nodes[0]);}};
  install({document,Worker,HTMLCanvasElement:Canvas,window:events,location:{origin:host.location.origin,search:''},
    matchMedia:()=>preference,innerWidth:390,innerHeight:844,devicePixelRatio:2,
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
    setInterval:clock.setTimer,clearInterval:clock.clearTimer});
  const flush=()=>new Promise(setImmediate);
  let workerControls;
  const pending=startWorkerRenderer({canvas:new Canvas(),backend:'webgl'});
  const rejected=assert.rejects(pending,/startup timed out/);clock.advance(45_000);await rejected;
  assert.equal(workers.at(-1).terminated,true);
  const diagnostics=[];
  const success=startWorkerRenderer({canvas:new Canvas(),backend:'webgl',onDiagnostic:(label,data)=>diagnostics.push({label,data}),connect:value=>{workerControls=value;return ()=>{};}});
  workers.at(-1).emit('message',{data:{type:'ready',backend:'webgl'}});
  const renderer=await success;workerControls.setScrolling(true);
  assert.deepEqual(workers.at(-1).messages.at(-1),{type:'scrolling',scrolling:true});
  workers.at(-1).emit('message',{data:{type:'diagnostic',label:'render-profile',data:{fps:30}}});
  assert.equal(diagnostics.find(v=>v.label==='render-profile').data.fps,30,'The actual worker report reaches the same-document diagnostic consumer');renderer.dispose();const diagCount=diagnostics.length;
  workers.at(-1).emit('message',{data:{type:'diagnostic',label:'render-profile',data:{fps:10}}});assert.equal(diagnostics.length,diagCount,'Disposed workers cannot pollute a capture');
  assert.equal(events.count(),0);assert.equal(document.count(),0);assert.equal(preference.count(),0);

  assert.deepEqual(harbourRenderAttempts({backend:'webgpu',webgpu:true}),[
    {backend:'webgpu',thread:'worker'},{backend:'webgpu',thread:'main'},
    {backend:'webgl',thread:'worker'},{backend:'webgl',thread:'main'}]);
  assert.deepEqual(harbourRenderAttempts({worker:false}),[{backend:'webgl',thread:'main'}]);
  assert.deepEqual(harbourRenderAttempts({backend:'webgpu',webgpu:false,mainOnly:true}),[{backend:'webgl',thread:'main'}]);
  let inlineReady=0,recoveries=0,inlineErrors=0;
  const mainAttempts=[];
  const drivers={worker:startWorkerRenderer,async main(settings){
    const host=createBrowserRenderHost(settings);let disposed=false;
    const disconnect=settings.connect({setTime(){},setActive(){},setScrolling(){}});
    const off=host.onDispose(()=>{});
    const result={settings,host,dispose(){if(disposed)return;disposed=true;disconnect();off();}};
    mainAttempts.push(result);host.ready(settings.backend);return result;
  }};
  const inlineOptions={surface,hero,search:'?embedded=1',drivers,
    onReady:()=>inlineReady++,onRecovering:()=>recoveries++,onError:()=>inlineErrors++};
  const before=workers.length;
  const cancelled=startInlineHarbour(inlineOptions);cancelled.dispose();await flush();
  assert.equal(workers.length,before,'StrictMode cancels startup before transferring a canvas');
  const unfinished=startInlineHarbour(inlineOptions);await flush();const unfinishedWorker=workers.at(-1);
  unfinished.dispose();await flush();assert.equal(unfinishedWorker.terminated,true);assert.equal(recoveries,0);
  const inline=startInlineHarbour(inlineOptions);await flush();
  const originalCanvas=surface.canvas,directWorker=workers.at(-1);
  assert.equal(directWorker.messages[0].state.height,680);
  directWorker.emit('message',{data:{type:'ready',backend:'webgl'}});await flush();
  assert.equal(inlineReady,1);assert.equal(directWorker.messages.findLast(m=>m.type==='active').active,true);
  const count=directWorker.messages.length;events.innerHeight=600;events.emit('resize');
  assert.equal(directWorker.messages.length,count,'Browser chrome cannot resize an unchanged canvas');
  originalCanvas.clientHeight=700;events.emit('resize');assert.equal(directWorker.messages.at(-1).viewport.height,700);
  events.emit('scroll');assert.equal(directWorker.messages.findLast(m=>m.type==='active').active,true);
  bounds={top:-1000,bottom:-10};events.emit('scroll');assert.equal(directWorker.messages.findLast(m=>m.type==='active').active,false);
  directWorker.emit('error',{message:'Injected worker failure',preventDefault(){}});await flush();
  assert.equal(recoveries,1);assert.equal(inlineReady,2);
  assert.equal(mainAttempts.length,1);assert.notEqual(surface.canvas,originalCanvas,'A transferred canvas is replaced before main-thread recovery');
  assert.equal(mainAttempts[0].settings.canvas,surface.canvas);assert.equal(mainAttempts[0].host.height,680);
  assert.equal(mainAttempts[0].host.topInset,250);
  mainAttempts[0].settings.onFailure(new Error('Injected terminal failure'));await flush();
  assert.equal(inlineErrors,1);assert.equal(mainAttempts[0].settings.signal.aborted,true);
  directWorker.emit('message',{data:{type:'ready',backend:'webgl'}});await flush();assert.equal(inlineReady,2,'A stale worker cannot resurrect a failed attempt');
  inline.dispose();inline.dispose();
  assert.equal(surface.canvas,undefined);assert.equal(events.count(),0);assert.equal(document.count(),0);assert.equal(preference.count(),0);
  assert.equal(clock.timers.size,0);

  // No Worker/OffscreenCanvas support still renders directly in the page.
  install({Worker:undefined});bounds={top:80,bottom:930};
  const directMain=startInlineHarbour(inlineOptions);await flush();
  assert.equal(mainAttempts.length,2);assert.equal(mainAttempts.at(-1).settings.canvas,surface.canvas);
  directMain.dispose();assert.equal(clock.timers.size,0);assert.equal(events.count(),0);assert.equal(document.count(),0);

  install({Worker});
  const beforeDiagnostic=workers.length;
  const diagnosticMain=startInlineHarbour({...inlineOptions,search:'?embedded=1&diagnostics=scroll&thread=main'});await flush();
  assert.equal(workers.length,beforeDiagnostic,'The explicit diagnostic comparison runs on the main thread even when workers exist');
  assert.equal(mainAttempts.at(-1).settings.backend,'webgl');diagnosticMain.dispose();

  install({Worker,navigator:{gpu:{}}});
  const sequence=[],oldFailures=[];
  const sequenced=thread=>async settings=>{
    sequence.push(`${settings.backend}:${thread}`);oldFailures.push(settings.onFailure);
    if(settings.backend==='webgpu')throw new Error('Injected unsupported GPU backend');
    const disconnect=settings.connect({setTime(){},setActive(){},setScrolling(){}});
    return {dispose:disconnect};
  };
  const native=startInlineHarbour({...inlineOptions,search:'?embedded=1&renderer=webgpu',
    drivers:{worker:sequenced('worker'),main:sequenced('main')}});
  await flush();
  assert.deepEqual(sequence,['webgpu:worker','webgpu:main','webgl:worker'],'Every backend/thread recovery stays in the same surface');
  const settledCount=sequence.length;oldFailures[0](new Error('Late GPU failure'));await flush();
  assert.equal(sequence.length,settledCount,'Obsolete backends cannot restart recovery');native.dispose();

  install({Worker:undefined});
  let finishPending,lateDisposed=0;
  const pendingMain=startInlineHarbour({...inlineOptions,drivers:{main:()=>new Promise(resolve=>{finishPending=resolve;})}});
  await flush();pendingMain.dispose();finishPending({dispose(){lateDisposed++;}});await flush();
  assert.equal(lateDisposed,1,'A renderer that finishes after unmount is immediately disposed');
  assert.equal(clock.timers.size,0);assert.equal(events.count(),0);assert.equal(document.count(),0);
}finally{
  for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
console.log('Harbour lifecycle: direct controls, visibility/scroll continuity, StrictMode cancellation, fresh-canvas recovery, no-worker startup and cleanup passed.');
