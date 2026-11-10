// Match the mobile iframe's blank top margin. Standalone map views and
// desktop retain the full viewport.
export function embeddedTopInset(search, width) {
  return width <= 650 && new URLSearchParams(search).get('embedded') === '1' ? 250 : 0;
}

export function applyEmbeddedView(camera, width, height, topInset) {
  if (topInset > 0) camera.setViewOffset(width, height + topInset, 0, topInset, width, height);
  else if (camera.view?.enabled) camera.clearViewOffset();
  else camera.updateProjectionMatrix();
}
