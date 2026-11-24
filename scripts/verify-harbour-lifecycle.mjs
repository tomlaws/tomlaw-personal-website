import assert from 'node:assert/strict';
import { startLoadingTimeout } from '../src/loading-timeout.mjs';
import { connectHarbourFrame } from '../src/harbour-frame.mjs';
import { startWorkerRenderer } from '../src/harbour/worker-controller.mjs';
import { startInlineHarbour } from '../src/inline-harbour.mjs';

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
  install({setTimeout:clock.setTimer, clearTimeout:clock.clearTimer, performance:{now:clock.now}});
  const host = Object.assign(new Events(), {innerWidth:430,innerHeight:800,location:{origin:'https://portfolio.example'}});
  const messages = [], target = {postMessage:(data,origin) => messages.push({data,origin})};
  let bounds = {top:80,bottom:930}, ready = 0, errors = 0, observer;
  const hero = {getBoundingClientRect:() => bounds}, frame = {contentWindow:target};
  class Observer {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(element) { assert.equal(element,hero); }
    disconnect() { this.disconnected = true; }
  }
  const options = {frame,hero,window:host,document:page,Observer,timeoutMs:100,
    onReady:() => ready++,onError:() => errors++};
  const connection = connectHarbourFrame(options);
  const active = () => messages.findLast(message => message.data.command === 'active').data.active;
  const scrolling = () => messages.findLast(message => message.data.command === 'scrolling').data.scrolling;
  assert.equal(active(),true);
  assert.equal(messages[0].origin,host.location.origin);
  bounds = {top:-1000,bottom:-100};
  observer.callback([{target:hero,isIntersecting:false}]);
  assert.equal(active(),false,'The scrolling hero pauses the fixed iframe');
  const receive = (data, extra = {}) => host.emit('message',{data,origin:host.location.origin,source:target,...extra});
  receive({type:'harbour:state',ready:true},{origin:'https://unrelated.example'});
  receive({type:'harbour:state',ready:true},{source:{}});
  assert.equal(ready,0,'Other origins and windows cannot mark the city ready');
  receive({type:'harbour:state',ready:true});
  assert.equal(ready,1); assert.equal(active(),false,'Readiness replays a pause lost during startup');
  clock.advance(200); assert.equal(errors,0,'A ready scene has no startup deadline');
  bounds = {top:80,bottom:930}; observer.callback([{target:hero,isIntersecting:true}]);
  assert.equal(active(),true,'Returning to the introduction resumes rendering');
  for (const event of ['touchstart','scroll','touchmove','touchend','scrollend']) host.emit(event);
  assert.equal(active(),true,'Touch scrolling never suspends a visible city');
  assert.equal(scrolling(),false,'Scrollend restores the normal rendering budget');
  host.emit('touchmove'); assert.equal(scrolling(),true);
  assert.equal(active(),true,'A scrolling budget does not pause the city');
  const edgeCount=messages.length;
  clock.advance(100); host.emit('scroll'); clock.advance(100); host.emit('scroll');
  assert.equal(messages.length,edgeCount,'Momentum updates do not flood the iframe with messages');
  clock.advance(179); assert.equal(scrolling(),true,'The lighter budget covers momentum');
  clock.advance(1); assert.equal(scrolling(),false,'Browsers without scrollend restore the budget after settling');
  host.emit('scroll'); receive({type:'harbour:state',ready:true});
  assert.equal(scrolling(),true,'Renderer fallback replays the current scrolling budget');
  page.hidden = true; page.emit('visibilitychange'); assert.equal(active(),false);
  assert.equal(scrolling(),false,'Hiding the page clears the transient budget and timer');
  page.hidden = false; page.emit('visibilitychange'); assert.equal(active(),true);
  host.innerWidth=1200; host.emit('scroll'); assert.equal(scrolling(),false,'Desktop scrolling retains its budget');
  host.innerWidth=430; host.emit('scroll');
  receive({type:'harbour:error'}); assert.equal(errors,1); assert.equal(active(),false);
  receive({type:'harbour:state',ready:true}); assert.equal(ready,1,'A failed attempt cannot resurrect itself');
  connection.dispose();
  assert.equal(observer.disconnected,true); assert.equal(host.count(),0); assert.equal(page.count(),0);

  const replacement = {postMessage:(data,origin) => messages.push({data,origin})};
  frame.contentWindow = replacement;
  const retry = connectHarbourFrame(options);
  receive({type:'harbour:state',ready:true});
  assert.equal(ready,1,'A late message from the old iframe cannot finish a retry');
  host.emit('message',{data:{type:'harbour:state',ready:true},origin:host.location.origin,source:replacement});
  assert.equal(ready,2,'The replacement iframe can become ready independently');
  retry.dispose();

  const stalled = connectHarbourFrame({...options,Observer:undefined});
  bounds = {top:-1000,bottom:-10}; host.emit('scroll'); assert.equal(active(),false);
  bounds = {top:80,bottom:930}; host.emit('resize'); assert.equal(active(),true);
  clock.advance(100); assert.equal(errors,2,'A never-ready iframe exposes the retry state');
  stalled.dispose(); assert.equal(host.count(),0); assert.equal(page.count(),0);

  // Exercise the production worker controller without opening a browser/GPU.
  const document = Object.assign(new Events(), {hidden:false,
    documentElement:{dataset:{},style:{setProperty(){}}}});
  const canvas = {dataset:{},transferControlToOffscreen:() => ({})};
  const loading = {hidden:false,classList:{add(){}}};
  document.getElementById = id => id === 'world' ? canvas : loading;
  const preference = Object.assign(new Events(),{matches:false}), owner = {postMessage(){}};
  const events = new Events(), workers = [];
  class Worker extends Events {
    constructor() { super(); workers.push(this); }
    postMessage(data) { (this.messages ??= []).push(data); }
    terminate() { this.terminated = true; }
  }
  install({document, Worker, location:{origin:host.location.origin,search:''},
    window:{},parent:owner,matchMedia:() => preference,innerWidth:390,innerHeight:844,devicePixelRatio:2,
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
    setInterval:clock.setTimer,clearInterval:clock.clearTimer});
  let failureCount = 0;
  const pending = startWorkerRenderer({backend:'webgl',onFailure:() => failureCount++});
  const rejected = assert.rejects(pending,/startup timed out/);
  clock.advance(45_000); await rejected;
  assert.equal(workers[0].terminated,true,'A stuck worker is terminated before renderer fallback');
  assert.equal(failureCount,0,'Startup rejection uses the caller’s normal fallback');
  assert.equal(events.count(),0); assert.equal(document.count(),0); assert.equal(preference.count(),0);

  const success = startWorkerRenderer({backend:'webgl',onFailure:() => failureCount++});
  workers[1].emit('message',{data:{type:'ready',backend:'webgl'}});
  const renderer = await success;
  events.emit('message',{origin:host.location.origin,source:owner,
    data:{type:'harbour:command',command:'scrolling',scrolling:true}});
  assert.deepEqual(workers[1].messages.at(-1),{type:'scrolling',scrolling:true},'The iframe relays the budget to its render worker');
  clock.advance(45_000);
  assert.equal(workers[1].terminated,undefined,'Successful startup cancels its timeout');
  workers[1].emit('messageerror');
  assert.equal(workers[1].terminated,true); assert.equal(failureCount,1);
  renderer.dispose();
  assert.equal(events.count(),0); assert.equal(document.count(),0); assert.equal(preference.count(),0);
  assert.equal(clock.timers.size,0,'Retries and disposal leave no watchdogs or daylight timers');

  // Exercise the direct page canvas, including React's setup/cleanup/setup
  // cycle, independent canvas dimensions and a failed worker's iframe fallback.
  install({window:Object.assign(events,{innerWidth:390,innerHeight:800,location}),parent:events});
  document.getElementById=()=>null;
  bounds={top:80,bottom:930};
  let inlineReady=0,fallbacks=0;
  const directCanvas={dataset:{},clientWidth:390,clientHeight:680,
    transferControlToOffscreen:()=>({})};
  const inlineOptions={canvas:directCanvas,hero,search:'?embedded=1',
    onReady:()=>inlineReady++,onFallback:()=>fallbacks++};
  const before=workers.length;
  const cancelled=startInlineHarbour(inlineOptions);cancelled.dispose();
  await Promise.resolve();
  assert.equal(workers.length,before,'StrictMode cleanup cancels startup before transferring its canvas');
  const unfinished=startInlineHarbour(inlineOptions);await Promise.resolve();
  const unfinishedWorker=workers.at(-1);unfinished.dispose();await new Promise(setImmediate);
  assert.equal(unfinishedWorker.terminated,true,'Unmounting a starting city terminates its worker immediately');
  assert.equal(fallbacks,0,'Intentional cancellation cannot launch a fallback');
  assert.equal(clock.timers.size,0);
  const inline=startInlineHarbour(inlineOptions);
  await Promise.resolve();
  const directWorker=workers.at(-1),init=directWorker.messages[0];
  assert.equal(init.state.height,680,'The city uses canvas height rather than Safari chrome height');
  assert.equal(init.state.search,'?embedded=1','Embedded projection retains its original screen framing');
  directWorker.emit('message',{data:{type:'ready',backend:'webgl'}});
  await Promise.resolve();
  assert.equal(inlineReady,1);
  assert.equal(directWorker.messages.findLast(message=>message.type==='active').active,true);
  const messageCount=directWorker.messages.length;
  events.innerHeight=600;events.emit('resize');
  assert.equal(directWorker.messages.length,messageCount,'Safari chrome changes do not clear an unchanged canvas');
  directCanvas.clientHeight=700;events.emit('resize');
  assert.equal(directWorker.messages.at(-1).viewport.height,700,'Actual canvas size changes still reach the worker');
  events.emit('scroll');
  assert.equal(directWorker.messages.findLast(message=>message.type==='active').active,true,'Scrolling never pauses the direct canvas');
  bounds={top:-1000,bottom:-10};events.emit('scroll');
  assert.equal(directWorker.messages.findLast(message=>message.type==='active').active,false,'The direct canvas sleeps after leaving the hero');
  inline.dispose();inline.dispose();
  assert.equal(directWorker.terminated,true);
  assert.equal(events.count(),0);assert.equal(document.count(),0);assert.equal(preference.count(),0);
  assert.equal(clock.timers.size,0,'Inline disposal clears visibility/scroll/daylight/startup timers');
  bounds={top:80,bottom:930};
  const broken=startInlineHarbour(inlineOptions);await Promise.resolve();
  workers.at(-1).emit('error',{message:'Injected failure',preventDefault(){}});
  await new Promise(setImmediate);
  assert.equal(fallbacks,1,'A failed direct worker requests the existing iframe fallback once');
  broken.dispose();
  assert.equal(events.count(),0);assert.equal(document.count(),0);assert.equal(preference.count(),0);
  assert.equal(clock.timers.size,0);
} finally {
  for (const [key,descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
  }
}
console.log('Harbour lifecycle: offscreen/tab pausing, replay after startup, retry isolation, stalled worker fallback and timer cleanup passed.');
