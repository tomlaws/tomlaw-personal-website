import { harbourTime } from "../hong-kong-time.mjs";
import { setHarbourBackdrop } from './backdrop.mjs';

// The background has one clock and no user-selectable lighting or camera modes.
export function connectPortfolio({ setTime, setActive, setScroll, isReady=()=>true }) {
  const tell = (data) => {
    if (parent !== window)
      parent.postMessage({ type: "harbour:state", ...data }, location.origin);
  };
  function sync() {
    const now = harbourTime();
    setHarbourBackdrop(now.night);
    setTime(now.night);
    tell({ ready: isReady(), ...now });
  }
  const receive = (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== parent ||
      event.data?.type !== "harbour:command"
    )
      return;
    if (event.data.command === "active") setActive(Boolean(event.data.active));
    if (event.data.command === "scroll" && Number.isFinite(event.data.progress))
      setScroll?.(Math.min(1, Math.max(0, event.data.progress)),
        Number.isFinite(event.data.rise)?Math.min(180,Math.max(0,event.data.rise)):0);
  };
  addEventListener("message", receive);
  const onVisibility = () => {
    if (!document.hidden) sync();
  };
  document.addEventListener("visibilitychange", onVisibility);
  sync();
  const timer = setInterval(sync, 30_000);
  function disconnect() {
    clearInterval(timer);
    removeEventListener("message", receive);
    removeEventListener("pagehide", disconnect);
    document.removeEventListener("visibilitychange", onVisibility);
  }
  addEventListener("pagehide", disconnect, { once: true });
  return disconnect;
}
