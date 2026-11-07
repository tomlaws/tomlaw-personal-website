// Opt-in local diagnostics: ?profile. No telemetry or network requests.
export function createRenderProfiler(renderer,emit=data=>console.info('[render-profile]',JSON.stringify(data))){
  renderer.info.autoReset=false;
  let started,last,windowStart,frames=0,gaps=0,cpu=0,completion=0,calls=0,triangles=0,stageStart,stageCalls,stageTriangles;
  let stages={},gpu=[],cpuFrames=[],frameGaps=[],completions=[];
  const p95=values=>values.length?+values.toSorted((a,b)=>a-b)[Math.ceil(values.length*.95)-1].toFixed(1):undefined;
  return {
    begin(timestamp){
      started=performance.now();renderer.info.reset();
      stageStart=started;stageCalls=0;stageTriangles=0;
      if(last!==undefined){gaps+=timestamp-last;frameGaps.push(timestamp-last);}
      last=timestamp;windowStart??=timestamp;
    },
    mark(name){
      const now=performance.now(),render=renderer.info.render;
      const stage=stages[name]??={cpuMs:0,calls:0,triangles:0,updates:0};
      const draws=render.drawCalls??render.calls;
      stage.cpuMs+=now-stageStart;stage.calls+=draws-stageCalls;stage.triangles+=render.triangles-stageTriangles;
      if(draws>stageCalls)stage.updates++;
      stageStart=now;stageCalls=draws;stageTriangles=render.triangles;
    },
    end(timestamp,timing={}){
      const frameCpu=timing.cpuMs??performance.now()-started;
      cpu+=frameCpu;cpuFrames.push(frameCpu);completion+=timing.completeMs??0;
      if(timing.completeMs!==undefined)completions.push(timing.completeMs);
      if(timing.gpuMs!==undefined)gpu.push(timing.gpuMs);
      calls+=renderer.info.render.drawCalls??renderer.info.render.calls;triangles+=renderer.info.render.triangles;frames++;
      if(timestamp-windowStart<2500)return;
      emit({frames,fps:+(frames*1000/Math.max(gaps,1)).toFixed(1),cpuMs:+(cpu/frames).toFixed(1),completeMs:completion?+(completion/frames).toFixed(1):undefined,gpuMs:gpu.length?+(gpu.reduce((a,b)=>a+b,0)/gpu.length).toFixed(1):undefined,p95:{frameMs:p95(frameGaps),cpuMs:p95(cpuFrames),gpuMs:p95(gpu),completeMs:p95(completions)},programs:renderer.info.programs?.length,calls:Math.round(calls/frames),triangles:Math.round(triangles/frames),pixelRatio:renderer.getPixelRatio(),stages:Object.fromEntries(Object.entries(stages).map(([name,value])=>[name,{updates:value.updates,cpuMs:+(value.cpuMs/frames).toFixed(1),calls:Math.round(value.calls/frames),triangles:Math.round(value.triangles/frames)}]))});
      windowStart=timestamp;frames=0;gaps=0;cpu=0;completion=0;calls=0;triangles=0;stages={};gpu=[];cpuFrames=[];frameGaps=[];completions=[];
    }
  };
}
