// Keep the city's own coordinates, but place the square plate farther out into
// the harbour. Land closes against its two southern/back edges.
export const HARBOUR_SIZE = 28;
export const HARBOUR_CENTER = [-2, 2];
export const HARBOUR_BOUNDS = { minX: -16, maxX: 12, minZ: -12, maxZ: 16 };

export function insideCoast(x, z, outline) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [ax, az] = outline[i], [bx, bz] = outline[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

// A stable seed gives a casual arrangement while preserving day/night parity.
// The clearance envelope includes the complete wake, beyond the boat's hull.
export function placeHarbourVessels(outline, bounds = HARBOUR_BOUNDS, seed = 37129) {
  let state = seed;
  const random = () => { state = state * 16807 % 2147483647; return state / 2147483647; };
  const between = (a, b) => a + (b - a) * random();
  const clear = placement => {
    const { x, z, angle, envelope } = placement, c = Math.cos(angle), s = Math.sin(angle);
    for (let ix = 0; ix <= 4; ix++) for (let iz = 0; iz <= 12; iz++) {
      const px = -envelope.width + 2 * envelope.width * ix / 4;
      const pz = -envelope.back + (envelope.front + envelope.back) * iz / 12;
      const wx = x + c * px + s * pz, wz = z - s * px + c * pz;
      if (wx < bounds.minX + .45 || wx > bounds.maxX - .45 || wz < bounds.minZ + .45 || wz > bounds.maxZ - .45) return false;
      if (insideCoast(wx, wz, outline)) return false;
      // Reserve the footbridge landing and both Central finger piers.
      if (Math.abs(wx + 4.45) < 1.35 && Math.abs(wz - 10.35) < 1.35) return false;
      if ([7.04, 10.02].some(pierX => Math.abs(wx - pierX) < .9 && wz > 9.8 && wz < 12.1)) return false;
    }
    return true;
  };
  const specs = [
    { design: 'star', scale: 1.25, envelope: { width: 1.05, front: 3.15, back: 3.95 },
      sample: () => ({ x: between(-13.95, -12.85), z: between(.2, 5.2), angle: between(-.20, .23) }) },
    { design: 'junk', scale: 1, envelope: { width: .95, front: 1.85, back: 1.85 },
      sample: () => ({ x: between(-2.7, 5.2), z: between(12.85, 13.65), angle: between(-1.22, -.64) }) },
  ];
  const placed = [];
  for (const { sample, ...spec } of specs) {
    let found;
    for (let attempt = 0; attempt < 300; attempt++) {
      const candidate = { ...spec, ...sample() };
      if (clear(candidate) && placed.every(p => Math.hypot(p.x - candidate.x, p.z - candidate.z) > 11)) { found = candidate; break; }
    }
    if (!found) throw new Error(`No clear harbour position for ${spec.design}`);
    placed.push(found);
  }
  return placed;
}
