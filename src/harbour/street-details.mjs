import * as T from 'three';
import { CITY_LAYOUT as site } from './layout.mjs';

export const SIGNAL_PERIOD = 40;
export function signalState(time) {
  const phase = ((time % SIGNAL_PERIOD) + SIGNAL_PERIOD) % SIGNAL_PERIOD;
  return { phase, cars: phase < 19 || phase >= 33 ? 'green' : phase < 22 ? 'amber' : 'red', pedestrians: phase >= 24 && phase < 30 };
}

export function addStreetDetails({ staticRoot, mesh, box, cyl, sphere, tube, rod, torus, sign, m, material, windowSystem, rememberPlacement }) {
  const features = [];
  const red = material('#ef9084', { emissive: '#f0a08e', emissiveIntensity: .05 });
  const amber = material('#f2cb7c', { emissive: '#e8c184', emissiveIntensity: .05 });
  const green = material('#8ce2b0', { emissive: '#b6e3c4', emissiveIntensity: .05 });
  const walk = material('#8ce2b8', { emissive: '#c2e9cd', emissiveIntensity: .05 });
  const wait = material('#ef9084', { emissive: '#eba294', emissiveIntensity: 1.3 });
  function feature(name) { features.push(name); }
  function trafficLight(x, z, angle) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = angle; staticRoot.add(g);
    cyl(.025, 1.38, m.metal, 0, .72, 0, g); cyl(.072, .07, m.rail, 0, .07, 0, g);
    box(.16, .42, .14, m.dark, 0, 1.38, 0, g, .055);
    [red, amber, green].forEach((mat, i) => { const lens = cyl(.045, .017, mat, 0, 1.505 - i * .13, .08, g, .045, 20); lens.rotation.x = Math.PI / 2; const hood = torus(.049, .009, m.metal, 0, 1.505 - i * .13, .091, g); hood.rotation.x = 0; });
    const pedestrian = new T.Group(); pedestrian.position.set(.10, .94, 0); pedestrian.rotation.y = Math.PI / 2; g.add(pedestrian);
    box(.14, .25, .075, m.dark, 0, 0, 0, pedestrian, .03);
    sphere(.023, .023, .009, walk, 0, -.025, .043, pedestrian);
    rod([0, -.041, .045], [0, -.079, .045], .007, walk, pedestrian);
    rod([0, -.064, .045], [-.018, -.094, .045], .006, walk, pedestrian); rod([0, -.064, .045], [.018, -.084, .045], .006, walk, pedestrian);
    box(.042, .042, .011, wait, 0, .06, .047, pedestrian, .007);
    cyl(.034, .044, m.rail, 0, .57, 0, g); sphere(.014, .017, .028, m.yellow, 0, .57, .029, g);
    rememberPlacement('Traffic signal', g);
  }
  trafficLight(-.78, 4.54, -Math.PI / 2); trafficLight(1.1, 6.84, Math.PI / 2); feature('working traffic lights');
  box(.045, .009, .65, m.marking, -.57, .027, 5.27, staticRoot, 0); box(.045, .009, .65, m.marking, .86, .027, 6.12, staticRoot, 0);

  // Surfacing, dropped curbs, and tactile panels are aligned in pedestrian.mjs.
  feature('accessible curb crossings');
  for (const [x, z] of [[-1.02, 4.52], [1.18, 4.52], [5.36, 4.12], [5.36, 2.32], [-.72, 6.90], [1.38, 6.90]]) {
    cyl(.03, .3, m.metal, x, .18, z); sphere(.031, .03, .031, m.metal, x, .33, z); cyl(.032, .035, m.cream, x, .26, z);
  }
  feature('reflective bollards');

  // Drain covers and manholes have actual metal ribs, not texture stickers.
  for (const [x, z] of [[-5.18, 4.98], [2.75, 4.99], [7.13, .42]]) {
    box(.34, .013, .17, m.dark, x, .025, z, staticRoot, .022);
    for (let i = 0; i < 7; i++)box(.015, .015, .13, m.rail, x - .135 + i * .045, .034, z, staticRoot, .003);
  }
  for (const [x, z] of [[-2.67, 6.08], [2.28, 5.29], [6.22, -1.1]]) {
    cyl(.14, .012, m.metal, x, .025, z, staticRoot, .14, 32);
    const rim = torus(.129, .005, m.rail, x, .033, z); rim.rotation.x = -Math.PI / 2;
    for (let i = -3; i <= 3; i++) { const zz = i * .027, half = Math.sqrt(.11 * .11 - zz * zz); rod([x - half, .034, z + zz], [x + half, .034, z + zz], .003, m.rail); }
  }
  feature('storm drains and manholes');

  // Painted turning arrows mark the straight streets and their intersection.
  for (const [x, z, angle] of [[-4.1, 5.29, 0], [4.1, 6.11, Math.PI], [6.40, -2.2, -Math.PI / 2]]) {
    const g = new T.Group(); g.position.set(x, .028, z); g.rotation.y = angle; staticRoot.add(g);
    box(.3, .008, .025, m.marking, 0, 0, 0, g, .003); box(.16, .008, .025, m.marking, .11, 0, .055, g, .003).rotation.y = -.7; box(.16, .008, .025, m.marking, .11, 0, -.055, g, .003).rotation.y = .7;
  }
  feature('lane arrows and stop lines');

  // A slim bus information post and a legible route panel beside the shelter.
  const route = new T.Group(); route.position.set(site.busStop[0] + 1.0, 0, site.busStop[1]); staticRoot.add(route);
  cyl(.023, 1.06, m.metal, 0, .55, 0, route); box(.3, .54, .055, m.cream, 0, .99, 0, route, .08);
  tube([[-.08, .8, .033], [-.06, .96, .033], [.07, 1.08, .033], [.04, 1.17, .033]], .005, m.sage, route, 12);
  for (const [x, y] of [[-.08, .82], [-.06, .96], [.07, 1.08], [.04, 1.17]]) sphere(.012, .012, .005, m.coral, x, y, .037, route);
  rememberPlacement('Bus route panel', route);
  feature('bus route map');

  // Bike stands, a parked scooter, a hydrant, and waste sorting beside the public space.
  const [rackX, rackZ] = site.cycleRacks;
  for (let i = 0; i < 3; i++)tube([[rackX + i * .34, .052, rackZ], [rackX + i * .34, .28, rackZ], [rackX + .11 + i * .34, .38, rackZ], [rackX + .23 + i * .34, .28, rackZ], [rackX + .23 + i * .34, .052, rackZ]], .018, m.rail, staticRoot, 20);
  const scooter = new T.Group(); scooter.position.set(site.scooter[0], .052, site.scooter[1]); scooter.rotation.y = .18; staticRoot.add(scooter);
  box(.42, .035, .12, m.sage, 0, .10, 0, scooter, .04); rod([.16, .12, 0], [.13, .52, 0], .016, m.metal, scooter); rod([.13, .52, -.085], [.13, .52, .085], .017, m.metal, scooter);
  for (const x of [-.18, .18]) { const wheel = torus(.068, .021, m.tire, x, .069, 0, scooter); wheel.rotation.y = 0; }
  rememberPlacement('Parked scooter', scooter);
  feature('bicycle parking and scooter');
  cyl(.054, .23, m.coral, 5.20, .16, 4.54); sphere(.06, .035, .06, m.coral, 5.20, .30, 4.54); rod([5.10, .20, 4.54], [5.30, .20, 4.54], .027, m.coral); feature('fire hydrant');
  const bins = new T.Group(); bins.position.set(site.recycling[0], 0, site.recycling[1]); staticRoot.add(bins);
  for (let i = 0; i < 2; i++) {
    cyl(.115, .36, i ? m.sage : m.blue, 0, .23, i * .30, bins); cyl(.122, .04, m.metal, 0, .425, i * .30, bins); box(.14, .043, .023, m.dark, 0, .35, i * .30 + .12, bins, .014);
  }
  rememberPlacement('Cafe recycling bins', bins);
  feature('separated waste bins');
  const utility = new T.Group(); utility.position.set(site.utility[0], .04, site.utility[1]); staticRoot.add(utility);
  box(.29, .57, .24, m.base, 0, .29, 0, utility, .065); for (let i = 0; i < 5; i++)box(.16, .009, .009, m.dark, 0, .18 + i * .041, .124, utility, 0); sphere(.012, .012, .014, m.rail, .08, .43, .128, utility);
  rememberPlacement('Electrical cabinet', utility);
  feature('electrical cabinet');
  // A framed neighborhood notice board has flyers protected by glass.
  const notice = new T.Group(); notice.position.set(site.noticeBoard[0], 0, site.noticeBoard[1]); notice.rotation.y = -Math.PI / 2; staticRoot.add(notice);
  cyl(.016, .89, m.metal, -.15, .46, 0, notice); cyl(.016, .89, m.metal, .15, .46, 0, notice); box(.41, .47, .05, m.woodDark, 0, .78, 0, notice, .05);
  for (const [x, y, w, h, mat] of [[-.085, .82, .12, .20, m.cream], [.08, .86, .12, .13, m.peach], [.05, .68, .16, .12, m.cream]]) box(w, h, .007, mat, x, y, .03, notice, .002);
  const pane = box(.365, .425, .005, windowSystem.glass, 0, .78, .041, notice, .032); pane.castShadow = false; pane.receiveShadow = false;
  rememberPlacement('Market notice board', notice);
  feature('neighborhood notice board');

  function animate(time) {
    const state = signalState(time);
    red.emissiveIntensity = state.cars === 'red' ? 1.65 : .04; amber.emissiveIntensity = state.cars === 'amber' ? 1.6 : .04; green.emissiveIntensity = state.cars === 'green' ? 1.3 : .04;
    walk.emissiveIntensity = state.pedestrians ? 1.45 : .03; wait.emissiveIntensity = state.pedestrians ? .03 : 1.35;
    return state;
  }
  animate(0);
  return { features, animate };
}
