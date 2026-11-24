import {harbourTime} from '../hong-kong-time.mjs';
import {setHarbourBackdrop} from './backdrop.mjs';

// Standalone renderer clock. All renderer controls stay in this document.
export function connectRenderClock({setTime}) {
  const sync=()=>{if(document.hidden)return;const now=harbourTime();setHarbourBackdrop(now.night);setTime(now.night);};
  document.addEventListener('visibilitychange',sync);
  sync();const timer=setInterval(sync,30_000);
  function disconnect(){clearInterval(timer);removeEventListener('pagehide',disconnect);document.removeEventListener('visibilitychange',sync);}
  addEventListener('pagehide',disconnect,{once:true});
  return disconnect;
}
