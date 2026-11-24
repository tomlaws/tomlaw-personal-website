import assert from 'node:assert/strict';
import {timingSummary,summarizeScrollCapture} from '../src/scroll-diagnostics.mjs';
import {createRenderProfiler} from '../src/harbour/render-profiler.mjs';
assert.deepEqual(timingSummary([NaN,undefined,-1]),{samples:0});
assert.deepEqual(timingSummary([16,17,16,80]),{samples:4,medianMs:16,p95Ms:80,maxMs:80,over25ms:1});
const frames=[
  {callbackDeltaMs:50,mapActive:true,scrolling:true},
  {callbackDeltaMs:16,mapActive:true,scrolling:false},
  {callbackDeltaMs:17,mapActive:false,scrolling:true},
  {callbackDeltaMs:16,mapActive:false,scrolling:false},
];
const report=summarizeScrollCapture({frames,scrolls:[{delayMs:2},{delayMs:undefined}],renderSamples:[{data:{fps:24}}],events:[],durationMs:10000.3,initial:{actualThread:'worker'},final:{actualThread:'main'}});
assert.equal(report.durationMs,10000);
assert.equal(report.pageCallbackIntervals['map-active:scrolling'].maxMs,50);
assert.equal(report.pageCallbackIntervals['map-inactive:scrolling'].maxMs,17);
assert.equal(report.scrollEventDispatchDelay.samples,1);
assert.equal(report.initial.actualThread,'worker');assert.equal(report.final.actualThread,'main');
assert.equal(report.longestCallbacks[0],frames[0]);
assert.match(report.measurements,/not native/);
const emitted=[],renderer={info:{render:{calls:3,triangles:9},programs:[],reset(){}},getPixelRatio:()=>2};
const profiler=createRenderProfiler(renderer,value=>emitted.push(value));
for(let i=0;i<80;i++){const t=i*1000/30;profiler.begin(t);profiler.end(t,{...profiler.snapshot(),cpuMs:2,completeMs:45});}
assert.equal(emitted.length,1);assert.equal(emitted[0].mode,'completion-observed');
assert.equal(emitted[0].completeMs,45,'The fence observation interval is retained separately from CPU time');
assert.equal(emitted[0].gpuMs,undefined);
console.log('Scroll diagnostics: real callback/scroll samples, map-active grouping, renderer recovery identity and honest timing labels passed.');
