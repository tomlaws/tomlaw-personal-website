import {readSceneData} from './scene-codec.mjs';
import {startLoadingTimeout} from '../loading-timeout.mjs';

async function fetchPreparedData(url,fetcher) {
  const controller=new AbortController();
  const stop=startLoadingTimeout(()=>controller.abort(),{timeoutMs:20_000});
  try { return await readSceneData(await fetcher(url,{signal:controller.signal})); }
  finally { stop(); }
}

export async function loadPreparedData(url,{
  inWorker=typeof document==='undefined',fetcher=fetch,
  createWorker=typeof Worker==='undefined'?null:()=>new Worker(new URL('./scene-decode-worker.js',import.meta.url),{type:'module'}),
}={}) {
  // The rendering worker is already off the UI thread. Decode there directly
  // instead of downloading/starting another worker and transferring it back.
  if(inWorker||!createWorker)return fetchPreparedData(url,fetcher);
  let worker,stop=()=>{};
  try {
    worker=createWorker();
    return await new Promise((resolve,reject)=>{
      stop=startLoadingTimeout(()=>reject(new Error('Scene decode worker timed out')),{timeoutMs:20_000});
      worker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.scene);
      worker.onerror=event=>reject(new Error(event.message||'Scene decode worker failed'));
      worker.onmessageerror=()=>reject(new Error('Scene decode worker returned invalid data'));
      worker.postMessage({url});
    });
  } catch(error) {
    stop();worker?.terminate();worker=undefined;
    console.warn('Scene decode worker unavailable; decoding locally.',error);
    return fetchPreparedData(url,fetcher);
  } finally { stop();worker?.terminate(); }
}
