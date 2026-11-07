// Keep architectural details at display resolution. Reduce update frequency
// under GPU pressure instead of stretching a smaller image over the page.
export function mapPixelRatio(deviceRatio = 1) {
  return Math.min(1.5, Math.max(1, Number.isFinite(deviceRatio) ? deviceRatio : 1));
}
