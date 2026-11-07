import SunCalc from "suncalc";

export const HONG_KONG = Object.freeze({
  latitude: 22.2845,
  longitude: 114.1589,
  timeZone: "Asia/Hong_Kong",
});
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: HONG_KONG.timeZone,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: HONG_KONG.timeZone,
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Absolute instants + geographic coordinates keep the lighting independent of
// the visitor's timezone. Solar elevation also accounts for seasonal daylight.
export function harbourTime(date = new Date()) {
  const altitude =
    (SunCalc.getPosition(date, HONG_KONG.latitude, HONG_KONG.longitude)
      .altitude *
      180) /
    Math.PI;
  let night = 1 - smoothstep(-7, 12, altitude);
  // Development-only lighting fixture; production always follows Hong Kong.
  if (import.meta.env?.DEV && typeof location !== "undefined") {
    const value = new URLSearchParams(location.search).get("qaNight");
    if (value !== null && Number.isFinite(Number(value)))
      night = Math.min(1, Math.max(0, Number(value)));
  }
  const hour = Number(clock.format(date).slice(0, 2));
  const phase =
    altitude < -7
      ? "After dark"
      : altitude < 3
        ? hour < 12
          ? "First light"
          : "Blue hour"
        : altitude < 12
          ? "Golden hour"
          : "Daylight";
  return {
    night,
    altitude,
    phase,
    clock: clock.format(date),
    date: calendar.format(date),
    iso: date.toISOString(),
  };
}
