const blend = (a, b, t) =>
  a.map((value, i) => Math.round(value + (b[i] - value) * t));
const rgb = (values) => values.join(", ");
const luminance = values => values.map(value => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum,value,index) => sum + value * [.2126,.7152,.0722][index],0);
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
function readable(candidate, foreground, background, minimum = 4.5) {
  for(let step=0;step<=10;step++) {
    const colour = blend(candidate,foreground,step/10);
    if(contrast(colour,background)>=minimum)return colour;
  }
  return foreground;
}

export function harbourTheme(night) {
  const t = Math.min(1, Math.max(0, night));
  const twilight = Math.sin(Math.PI * t) * 0.18;
  const background = blend(
    blend([194, 219, 227], [5, 18, 31], t),
    [105, 98, 120],
    twilight,
  );
  // Text must not interpolate through the same grey as a dusk background.
  const lightText = luminance(background) < .179;
  let foreground = lightText ? [227,236,240] : [23,47,57];
  if(contrast(foreground,background)<4.5)foreground=lightText?[255,255,255]:[0,0,0];
  const muted = readable(lightText?[137,164,183]:[58,83,95],foreground,background);
  const accent = readable(lightText?[115,214,219]:[12,99,111],foreground,background,3);
  return {
    "--background": `rgb(${rgb(background)})`,
    "--background-rgb": rgb(background),
    "--foreground": `rgb(${rgb(foreground)})`,
    "--muted": `rgb(${rgb(muted)})`,
    "--accent": `rgb(${rgb(accent)})`,
    "--rule": `rgba(${rgb(foreground)}, .16)`,
    colorScheme: lightText ? "dark" : "light",
  };
}
