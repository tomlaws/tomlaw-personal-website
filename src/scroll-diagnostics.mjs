// Opt-in, local-only diagnostics. These are JS scheduling intervals, not native
// display/compositor FPS. No samples are uploaded or persisted automatically.
export function timingSummary(values) {
  const sorted=values.filter(value=>Number.isFinite(value)&&value>=0).toSorted((a,b)=>a-b);
  if(!sorted.length)return {samples:0};
  const q=part=>+sorted[Math.max(0,Math.ceil(sorted.length*part)-1)].toFixed(2);
  return {samples:sorted.length,medianMs:q(.5),p95Ms:q(.95),maxMs:sorted.at(-1),over25ms:sorted.filter(v=>v>25).length};
}

export function summarizeScrollCapture({frames,scrolls,renderSamples,events,durationMs,initial,final}) {
  const groups={};
  for(const active of [true,false])for(const scrolling of [true,false]){
    const group=frames.filter(frame=>frame.mapActive===active&&frame.scrolling===scrolling);
    groups[`${active?'map-active':'map-inactive'}:${scrolling?'scrolling':'settled'}`]=timingSummary(group.map(frame=>frame.callbackDeltaMs));
  }
  return {schema:1,durationMs:Math.round(durationMs),initial,final,
    measurements:'JS callback intervals and renderer telemetry; not native screen-presentation FPS.',
    pageCallbackIntervals:groups,scrollEventDispatchDelay:timingSummary(scrolls.map(event=>event.delayMs)),
    longestCallbacks:frames.toSorted((a,b)=>b.callbackDeltaMs-a.callbackDeltaMs).slice(0,12),renderSamples,events};
}

export function createScrollDiagnostics({hero,window:win=window,document:doc=document,durationMs=10_000}) {
  let surfaceInfo,run,report,lastScroll=-Infinity,mapActive=true,raf,finishTimer,disposed=false;
  const recent=[];
  const make=(tag,text)=>{const element=doc.createElement(tag);if(text)element.textContent=text;return element;};
  const panel=make('aside');panel.className='scroll-diagnostics';panel.setAttribute('aria-label','Scroll diagnostics');
  const style=make('style');style.textContent=`
.scroll-diagnostics{position:fixed;z-index:2147483647;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:420px;padding:12px;border:1px solid var(--rule);background:var(--background);color:var(--foreground);font:13px/1.4 system-ui,sans-serif}
.scroll-diagnostics strong{display:block}.scroll-diagnostics p{margin:6px 0}.scroll-diagnostics button{font:inherit;min-height:42px;padding:6px 12px;margin:4px 6px 0 0;border:1px solid var(--rule);background:var(--background);color:var(--foreground)}
.scroll-diagnostics nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}.scroll-diagnostics a{text-decoration:underline}.scroll-diagnostics textarea{display:block;width:100%;height:140px;font:16px/1.3 monospace}
.scroll-diagnostics[data-recording=true]>*:not(.scroll-capture-status){display:none}.scroll-diagnostics[data-recording=true]{pointer-events:none;padding:8px}
`;
  const title=make('strong','Phone scroll capture');
  const status=make('p');status.className='scroll-capture-status';
  const help=make('p','Tap Record, then scroll from the city toward the repository list for 10 seconds. Copy the report into the chat afterwards. The report is not uploaded.');
  const record=make('button','Record 10 seconds'),copy=make('button','Copy report');record.type=copy.type='button';
  const details=make('details'),summary=make('summary','Show report'),output=make('textarea');output.readOnly=true;output.setAttribute('aria-label','Diagnostic report');details.append(summary,output);
  const nav=make('nav');
  for(const[label,renderer,thread]of [['WebGL worker','webgl',''],['WebGL main','webgl','main'],['WebGPU','webgpu','']]){
    const link=make('a',label),url=new URL(win.location.href);url.searchParams.set('diagnostics','scroll');url.searchParams.set('renderer',renderer);url.hash='';
    if(thread)url.searchParams.set('thread',thread);else url.searchParams.delete('thread');link.href=url.href;nav.append(link);
  }
  panel.append(title,status,help,record,copy,details,nav);doc.head.append(style);doc.body.append(panel);
  function state(){
    const canvas=doc.querySelector('.city-canvas'),bounds=canvas?.getBoundingClientRect(),params=new URLSearchParams(win.location.search);
    return {requestedRenderer:params.get('renderer')??'webgl',requestedThread:params.get('thread')??'worker',
      actualRenderer:doc.documentElement.dataset.renderer??'starting',actualThread:doc.documentElement.dataset.renderThread??'starting',
      userAgent:win.navigator.userAgent,dpr:win.devicePixelRatio,viewport:[win.innerWidth,win.innerHeight],
      visualViewport:win.visualViewport?{width:win.visualViewport.width,height:win.visualViewport.height,scale:win.visualViewport.scale}:null,
      capabilities:{worker:typeof win.Worker!=='undefined',transferableCanvas:typeof win.HTMLCanvasElement!=='undefined'&&'transferControlToOffscreen' in win.HTMLCanvasElement.prototype,webgpu:Boolean(win.navigator.gpu)},
      drawingBuffer:surfaceInfo?.drawingBuffer??null,placeholderCanvasSize:canvas?[canvas.width,canvas.height]:null,canvasRect:bounds?{top:bounds.top,left:bounds.left,width:bounds.width,height:bounds.height}:null,
      reducedMotion:win.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ready:doc.querySelector('.world-background')?.classList.contains('ready')??false,
      appAsset:[...doc.scripts].find(script=>script.src.includes('/assets/portfolio-'))?.getAttribute('src')??'development'};
  }
  function refresh(){
    if(disposed||run)return;
    const value=state();record.disabled=!value.ready;
    status.textContent=`Actual: ${value.actualRenderer} / ${value.actualThread}. ${value.ready?'Ready to record.':'Waiting for the city.'}`;
  }
  const observer=new win.MutationObserver(refresh);
  observer.observe(doc.documentElement,{attributes:true});
  const background=doc.querySelector('.world-background');if(background)observer.observe(background,{attributes:true,attributeFilter:['class']});
  function observe(label,data){
    if(disposed)return;
    if(label==='activity')mapActive=data.active;
    if(label==='renderer-start')surfaceInfo=undefined;
    if((label==='render-surface'||label==='render-profile')&&data.drawingBuffer)surfaceInfo=data;
    if(label==='render-profile'){if(run)run.renderSamples.push({atMs:Math.round(win.performance.now()-run.started),data});return;}
    if(['activity','render-surface','renderer-start','renderer-ready','renderer-error'].includes(label)){
      const event={at:win.performance.now(),label,data};recent.push(event);if(recent.length>30)recent.shift();if(run)run.events.push({...event,at:Math.round(event.at-run.started)});
    }
    refresh();
  }
  function onScroll(event){
    const now=win.performance.now();lastScroll=now;
    if(!run)return;
    const delay=now-event.timeStamp;
    run.scrolls.push({delayMs:delay>=0&&delay<60000?delay:undefined});
  }
  function tick(timestamp){
    if(!run||disposed)return;
    const now=win.performance.now(),y=win.scrollY;
    if(run.lastNow!==undefined)run.frames.push({atMs:Math.round(now-run.started),callbackDeltaMs:now-run.lastNow,
      rafDeltaMs:timestamp-run.lastRaf,scrollY:y,mapActive,scrolling:now-lastScroll<180||y!==run.lastY});
    run.lastNow=now;run.lastRaf=timestamp;run.lastY=y;raf=win.requestAnimationFrame(tick);
  }
  function finish(){
    if(!run)return;
    const value=run;run=undefined;win.cancelAnimationFrame(raf);
    report=summarizeScrollCapture({...value,durationMs:win.performance.now()-value.started,final:state()});
    panel.dataset.recording='false';output.value=JSON.stringify(report,null,2);status.textContent='Capture finished. Tap Copy report and paste it in the chat.';record.disabled=false;
  }
  record.addEventListener('click',()=>{
    if(run||disposed)return;
    const bounds=hero.getBoundingClientRect();mapActive=bounds.bottom>0&&bounds.top<win.innerHeight&&!doc.hidden;
    report=undefined;lastScroll=-Infinity;run={started:win.performance.now(),initial:state(),frames:[],scrolls:[],renderSamples:[],events:recent.map(event=>({...event,at:'before capture'}))};
    panel.dataset.recording='true';status.textContent='Recording—scroll normally toward the repository list.';
    raf=win.requestAnimationFrame(tick);finishTimer=win.setTimeout(finish,durationMs);
  });
  copy.addEventListener('click',async()=>{
    const text=output.value||JSON.stringify({initial:state(),events:recent},null,2);output.value=text;
    try{await win.navigator.clipboard.writeText(text);status.textContent='Report copied. Paste it in the chat.';}
    catch{details.open=true;output.focus();output.select();status.textContent='Select and copy the report text below.';}
  });
  const onViewport=()=>{if(run)run.events.push({at:Math.round(win.performance.now()-run.started),label:'viewport-resize',data:{width:win.innerWidth,height:win.innerHeight,visualHeight:win.visualViewport?.height}});};
  const onVisibility=()=>{if(run)run.events.push({at:Math.round(win.performance.now()-run.started),label:'document-visibility',data:{hidden:doc.hidden}});};
  win.addEventListener('scroll',onScroll,{passive:true});win.addEventListener('resize',onViewport);win.visualViewport?.addEventListener('resize',onViewport);doc.addEventListener('visibilitychange',onVisibility);refresh();
  return {observe,dispose(){disposed=true;run=undefined;win.cancelAnimationFrame(raf);win.clearTimeout(finishTimer);observer.disconnect();win.removeEventListener('scroll',onScroll);win.removeEventListener('resize',onViewport);win.visualViewport?.removeEventListener('resize',onViewport);doc.removeEventListener('visibilitychange',onVisibility);panel.remove();style.remove();}};
}
