import React, { useEffect, useState } from 'react';
import { harbourTime } from './hong-kong-time.mjs';

// A ticking clock should reconcile only its own text, not the repository list.
export function HongKongClock() {
  const [now, setNow] = useState(() => harbourTime());
  useEffect(() => {
    const update = () => { if (!document.hidden) setNow(harbourTime()); };
    const timer = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return <div className="hk-clock">
    <span className="live-dot" />
    <span>HONG KONG</span>
    <time dateTime={now.iso}>{now.clock}<small>HKT</small></time>
  </div>;
}
