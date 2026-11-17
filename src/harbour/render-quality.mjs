// Bound the total render-target area: a 4K window otherwise costs four times
// as much as a 1080p window, before multisampling and full-screen effects.
// Keep the existing small-screen quality and gently scale large viewports.
export function mapPixelRatio(deviceRatio = 1, width = 0, height = 0) {
  const dpr = Math.min(width > 0 && width <= 650 ? 1.25 : 1.5,
    Math.max(1, Number.isFinite(deviceRatio) ? deviceRatio : 1));
  if (!(width > 0 && height > 0)) return dpr;
  const pixelBudget = 3_200_000;
  return Math.min(dpr, Math.sqrt(pixelBudget / (width * height)));
}
