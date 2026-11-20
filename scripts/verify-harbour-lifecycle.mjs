import assert from 'node:assert/strict';
import { startLoadingTimeout } from '../src/loading-timeout.mjs';
import { connectHarbourFrame } from '../src/harbour-frame.mjs';
import { startWorkerRenderer } from '../src/harbour/worker-controller.mjs';

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
  const host = Object.assign(new Events(), {innerHeight:800,location:{origin:'https://portfolio.example'}});
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
  const active = () => messages.at(-1).data.active;
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
  page.hidden = true; page.emit('visibilitychange'); assert.equal(active(),false);
  page.hidden = false; page.emit('visibilitychange'); assert.equal(active(),true);
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
    postMessage() {}
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
  clock.advance(45_000);
  assert.equal(workers[1].terminated,undefined,'Successful startup cancels its timeout');
  workers[1].emit('messageerror');
  assert.equal(workers[1].terminated,true); assert.equal(failureCount,1);
  renderer.dispose();
  assert.equal(events.count(),0); assert.equal(document.count(),0); assert.equal(preference.count(),0);
  assert.equal(clock.timers.size,0,'Retries and disposal leave no watchdogs or daylight timers');
} finally {
  for (const [key,descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key];
  }
}
console.log('Harbour lifecycle: offscreen/tab pausing, replay after startup, retry isolation, stalled worker fallback and timer cleanup passed.');
