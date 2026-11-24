import {startLoadingTimeout} from './loading-timeout.mjs';

// Observe the introduction and control its renderer directly in this document.
export function connectHarbourActivity({hero,setActive,setScrolling,onReady=()=>{},onError,
  window:host=window,document:page=document,Observer=globalThis.IntersectionObserver,timeoutMs=90_000}) {
  let status='loading',disposed=false,observer,inView=true,lastActive,lastScrolling,scrolling=false,scrollTimer;
  const visible=()=>{const bounds=hero.getBoundingClientRect();return bounds.bottom>0&&bounds.top<host.innerHeight;};
  function sync(force=false){
    if(disposed)return;
    const active=status!=='error'&&inView&&!page.hidden;
    if(!active){scrolling=false;clearTimeout(scrollTimer);}
    if(force||active!==lastActive){setActive(active);lastActive=active;}
    if(force||scrolling!==lastScrolling){setScrolling(scrolling);lastScrolling=scrolling;}
  }
  const endScroll=()=>{clearTimeout(scrollTimer);scrolling=false;sync();};
  const onScroll=()=>{
    if(disposed||status==='error'||!inView||page.hidden||host.innerWidth>650)return;
    scrolling=true;sync();clearTimeout(scrollTimer);scrollTimer=setTimeout(endScroll,180);
  };
  function fail(){if(disposed||status==='error')return;status='error';stopTimeout();sync();onError();}
  const stopTimeout=startLoadingTimeout(fail,{timeoutMs,document:page});
  function ready(){
    if(disposed||status==='error')return;
    stopTimeout();if(status!=='ready'){status='ready';onReady();}sync(true);
  }
  const measure=()=>{inView=visible();sync();};
  host.addEventListener('scroll',onScroll,{passive:true});
  host.addEventListener('touchmove',onScroll,{passive:true});
  host.addEventListener('scrollend',endScroll);
  page.addEventListener('visibilitychange',measure);
  if(Observer){observer=new Observer(entries=>{if(disposed)return;const entry=entries.find(item=>item.target===hero);if(entry){inView=entry.isIntersecting;sync();}});observer.observe(hero);}
  else{host.addEventListener('scroll',measure,{passive:true});host.addEventListener('resize',measure);}
  measure();
  return {ready,fail,sync:()=>{inView=visible();sync(true);},dispose(){
    if(disposed)return;disposed=true;stopTimeout();observer?.disconnect();clearTimeout(scrollTimer);
    host.removeEventListener('scroll',onScroll);host.removeEventListener('touchmove',onScroll);host.removeEventListener('scrollend',endScroll);
    host.removeEventListener('scroll',measure);host.removeEventListener('resize',measure);page.removeEventListener('visibilitychange',measure);
  }};
}
