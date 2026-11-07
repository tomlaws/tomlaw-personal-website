// Bound expensive driver compilation rather than asking it to build dozens of
// PBR pipelines concurrently. This only changes preparation, never render quality.
export function createWorkQueue(concurrency=2) {
  let active=0;
  const waiting=[];
  function pump(){
    while(active<concurrency&&waiting.length){
      const {task,resolve,reject}=waiting.shift();active++;
      Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;pump();});
    }
  }
  return task=>new Promise((resolve,reject)=>{waiting.push({task,resolve,reject});pump();});
}

export async function warmScenePipelines(renderer,compile) {
  const device=renderer.backend.device;
  const nativeCompile=device.createRenderPipelineAsync;
  const copy=renderer.copyFramebufferToTexture;
  const queued=createWorkQueue(2);
  let failed;
  const failure=new Promise((_,reject)=>{failed=reject;});
  device.createRenderPipelineAsync=descriptor=>queued(async()=>{
    try{return await nativeCompile.call(device,descriptor);}
    catch(error){
      // r180's compileAsync wrapper does not forward a rejected driver promise.
      // Reject our outer warmup immediately so normal renderer fallback can run.
      failed(error);return new Promise(()=>{});
    }
  });
  // Compilation has no active framebuffer pass. Allocate transmission snapshots
  // for binding validation; their real contents are copied on the first draw.
  renderer.copyFramebufferToTexture=texture=>renderer._textures.updateTexture(texture,{renderTarget:renderer.getRenderTarget()});
  try {await Promise.race([compile(),failure]);}
  finally {device.createRenderPipelineAsync=nativeCompile;renderer.copyFramebufferToTexture=copy;}
}
