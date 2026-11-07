import * as T from 'three';

// Open coastal street: southeast to northwest (+Z in the construction grid),
// then southwest (+X). A single quarter-circle joins the two straight reaches.
export function coastalRoad({ x, startZ, turnZ, endX, radius, y = 0 }) {
  const r = Math.min(radius, (turnZ - startZ) / 2, (endX - x) / 2);
  if (!(r > 0)) throw new Error('Coastal road needs two positive reaches and a turn radius');
  const centre = new T.Vector3(x + r, y, turnZ - r);
  const straight = (x0, z0, x1, z1) => ({
    kind: 'straight', length: Math.hypot(x1 - x0, z1 - z0),
    at: t => new T.Vector3(T.MathUtils.lerp(x0, x1, t), y, T.MathUtils.lerp(z0, z1, t)),
    tangent: () => new T.Vector3(x1 - x0, 0, z1 - z0).normalize(),
    closest(px, pz) {
      const dx = x1 - x0, dz = z1 - z0;
      return T.MathUtils.clamp(((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz), 0, 1);
    },
  });
  const segments = [
    straight(x, startZ, x, centre.z),
    {
      kind: 'turn', length: r * Math.PI / 2,
      at: t => {
        const angle = Math.PI - t * Math.PI / 2;
        return new T.Vector3(centre.x + r * Math.cos(angle), y, centre.z + r * Math.sin(angle));
      },
      tangent: t => {
        const angle = Math.PI - t * Math.PI / 2;
        return new T.Vector3(Math.sin(angle), 0, -Math.cos(angle));
      },
      closest(px, pz) {
        const angle = Math.atan2(pz - centre.z, px - centre.x);
        if (angle >= Math.PI / 2 && angle <= Math.PI) return (Math.PI - angle) / (Math.PI / 2);
        return Math.hypot(px - x, pz - centre.z) < Math.hypot(px - centre.x, pz - turnZ) ? 0 : 1;
      },
    },
    straight(centre.x, turnZ, endX, turnZ),
  ];
  let length = 0;
  for (const segment of segments) {
    segment.start = length; length += segment.length; segment.end = length;
  }
  function locate(u) {
    const s = T.MathUtils.clamp(u, 0, 1) * length;
    const segment = segments.find(segment => s < segment.end) ?? segments.at(-1);
    return { segment, t: (s - segment.start) / segment.length };
  }
  return {
    closed: false, radius: r, segments,
    getLength: () => length,
    getPointAt: u => { const { segment, t } = locate(u); return segment.at(t); },
    getTangentAt: u => { const { segment, t } = locate(u); return segment.tangent(t); },
    closestPoint(px, pz) {
      let best;
      for (const segment of segments) {
        const t = segment.closest(px, pz), point = segment.at(t);
        const distance = Math.hypot(point.x - px, point.z - pz);
        if (!best || distance < best.distance) best = { point, distance, u: (segment.start + t * segment.length) / length };
      }
      return best;
    },
  };
}
