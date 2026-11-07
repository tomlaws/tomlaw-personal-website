// One site plan owns destinations, landscape edges, furniture, and clear routes.
// +Z is the street-facing side; all five buildings share the north frontage.
export const CITY_LAYOUT = {
  size: 20, width: 20, depth: 19, center: [-2, -1.5],
  towers: [[-5.15, -7.55], [1.45, -7.60]],
  mall: [-9.45, -4.70],
  diner: [-5.15, -3.985],
  apartments: [-2.05, -4.035],
  books: [1.05, -4.025],
  studio: [4.25, -4.31],
  cafe: [-5.75, -.25],
  water: [-.40, .75],
  flowers: [3.70, -.05],
  market: [3.70, 1.70],
  marketAngle: -Math.PI / 2,
  // A narrow neon infill in the back row: clear of the studio's rear face, the
  // east kerb, the skybridge line, and the tram platform behind.
  arcade: [4.58, -7.78],
  busStop: [-1.80, 7.66],
  carLanes: [5.23, 6.10], tramZ: -10.15, streetNorth: -9.58,
  courtyard: { x: -.40, z: .75, width: 4.70, depth: 3.70 },
  terrace: { x: -5.825, z: .70, width: 3.25, depth: 3.80 },
  marketPad: { x: 3.74, z: .825, width: 1.32, depth: 3.25 },
  gardens: [
    { name: 'Galleria west garden', x: -10.90, z: .90, width: 1.05, depth: 2.30 },
    { name: 'Galleria east garden', x: -8.00, z: .90, width: 1.05, depth: 2.30 },
    { name: 'Water-court west planting', x: -2.55, z: .75, width: .30, depth: 2.0 },
    { name: 'Water-court east planting', x: 1.75, z: .75, width: .30, depth: 2.0 },
    { name: 'Market planted buffer', x: 4.95, z: .75, width: .50, depth: 3.10 },
  ],
  trees: [
    { x: -10.90, z: 1.35, height: 1.45, size: .48, flowering: true, inGarden: true },
    { x: -8.00, z: 1.35, height: 1.45, size: .48, flowering: true, inGarden: true },
    { x: -10.65, z: 4.04, height: 1.35, size: .46 },
    { x: -5.60, z: 4.04, height: 1.35, size: .46 },
    { x: 3.20, z: 4.04, height: 1.35, size: .46 },
  ],
  seats: [
    { name: 'Galleria west waiting bench', x: -10.90, z: -.68, angle: Math.PI },
    { name: 'Galleria east waiting bench', x: -8.00, z: -.68, angle: Math.PI },
    { name: 'Water-court west bench', x: -2.03, z: .75, angle: Math.PI / 2 },
    { name: 'Water-court east bench', x: 1.23, z: .75, angle: -Math.PI / 2 },
  ],
  tables: [{ x: -6.70, z: 1.70, umbrella: true }, { x: -4.95, z: 1.70 }],
  lamps: {
    mall: [-8.80, 4.47], cafe: [-3.35, 4.47], crossing: [1.65, 4.47],
    market: [5.36, 1.20], rear: [5.30, -5.95],
  },
  pots: [[-6.55, -2.78], [.22, -2.70], [1.88, -2.70]],
  menuBoards: [[-7.08, .88], [-3.83, -2.80]],
  mailbox: [2.70, -2.77],
  recycling: [-7.23, -.85],
  cycleRacks: [1.80, 7.68], bicycle: [2.10, 7.64], scooter: [3.10, 7.64],
  utility: [5.30, -6.30], noticeBoard: [4.96, -1.09],
  // Reserved routes are geometry-checked against occupied ground footprints.
  walkingRoutes: [
    { name: 'Shopfront promenade', x0: -11.70, x1: 5.45, z0: -2.45, z1: -1.30 },
    { name: 'Street promenade', x0: -11.70, x1: 5.12, z0: 2.60, z1: 3.65 },
    { name: 'Galleria entrance axis', x0: -10.25, x1: -8.65, z0: -2.45, z1: 3.65 },
    { name: 'Cafe–water-court connection', x0: -4.15, x1: -2.80, z0: -2.45, z1: 3.65 },
    { name: 'Market browsing aisle', x0: 2.00, x1: 3.08, z0: -2.45, z1: 3.65 },
    { name: 'Front crossing approach', x0: -.48, x1: .88, z0: 1.48, z1: 4.34 },
    { name: 'East crossing approach', x0: 2.00, x1: 5.22, z0: 2.60, z1: 3.65 },
  ],
};

export const CITY_BOUNDS = {
  minX: CITY_LAYOUT.center[0] - CITY_LAYOUT.width / 2,
  maxX: CITY_LAYOUT.center[0] + CITY_LAYOUT.width / 2,
  minZ: CITY_LAYOUT.center[1] - CITY_LAYOUT.depth / 2,
  maxZ: CITY_LAYOUT.center[1] + CITY_LAYOUT.depth / 2,
};
