import * as T from 'three';

// Home view from the Tsim Sha Tsui side of Victoria Harbour. The construction
// grid follows the miniature's folded coastline; its X/Z axes are not compass
// bearings. Geographic north follows the harbour-facing diagonal (-X,+Z),
// defined by compass.mjs, and projects straight down in this default view.
// The Central towers and observation wheel appear on the right, and the
// eastern districts appear on the left. This shared pose is used by both the
// page and the layout/framing checks.
export const HOME_TARGET_HEIGHT = 1.3;

// A balanced isometric view from the harbour toward the island.
export const HOME_OFFSET = new T.Vector3(-18, 17.4, 18);

export function homeView(center) {
  const target = new T.Vector3(center[0], HOME_TARGET_HEIGHT, center[1]);
  return { target, position: target.clone().add(HOME_OFFSET) };
}
