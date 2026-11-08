// A compositor transform follows touch scrolling without forcing the 3D
// renderer to redraw the complete scene at every scroll event.
export function mobileScrollTransform(progress, rise) {
  const p = Math.max(0, Math.min(1, progress));
  const phase = p * p * (3 - 2 * p);
  const lift = Math.max(0, Math.min(50, rise)) * phase;
  return `translate3d(0, ${-lift}px, 0) perspective(2200px) rotateY(${-3.5 * phase}deg) rotateX(${-1 * phase}deg) scale(${1 - .1 * phase})`;
}
