import * as T from 'three';

export function portfolioCameraPose(home, progress, mobile = false) {
  const t = T.MathUtils.smoothstep(T.MathUtils.clamp(progress, 0, 1), 0, 1);
  const offset = home.position.clone().sub(home.target);
  offset.applyAxisAngle(new T.Vector3(0, 1, 0), t * .14);
  offset.y -= t * 1.6;
  const zoomFactor=1-t*.10;
  return {
    position: home.target.clone().add(offset),
    zoom: (mobile ? 1.12 : 1.18) * zoomFactor,
    phase:t,
    zoomFactor,
  };
}

export function keepMobileMapVisible(camera, points, height, zoom) {
  // The mobile hero shares the width-based map stage. Reserve its 90 px fade
  // and 30 px of breathing room without tying the framing to window height.
  const lowest = Math.min(...points.map(point => point.clone().applyMatrix4(camera.matrixWorldInverse).y));
  const span = camera.top - camera.bottom;
  const center = (camera.top + camera.bottom) / 2;
  const bottom = height * (1 - 2 * (lowest - center) * zoom / span) / 2;
  const limit = height - 120;
  const lift = Math.max(0, bottom - limit) * span / (height * zoom);
  camera.top -= lift;
  camera.bottom -= lift;
}

export function fitScrollFrame(camera, points, frame, width, height, rise=0, zoomFactor=1) {
  // Keep the canvas fixed. Moving it exposed its bottom edge during parallax.
  // Fit the sea plate and landmark crowns in the current orbit, preserving
  // the requested zoom wherever it fits and leaving room for the upward drift.
  camera.updateMatrixWorld(true);
  const bounds=new T.Box3();
  for(const point of points)bounds.expandByPoint(point.clone().applyMatrix4(camera.matrixWorldInverse));
  const size=bounds.getSize(new T.Vector3());
  const spanX=frame.right-frame.left,spanY=frame.top-frame.bottom;
  const padding=Math.min(12,width*.03,height*.03);
  const lift=T.MathUtils.clamp(rise,0,Math.min(180,height*.3));
  // Fit the base size first, then apply the shared zoom-out phase. Clamping
  // the animated zoom first held it still until it crossed the fitting limit.
  camera.zoom=Math.min(camera.zoom/zoomFactor,
    spanX*(width-2*padding)/(width*size.x),
    spanY*(height-2*padding-lift)/(height*size.y))*zoomFactor;
  const visibleX=spanX/camera.zoom,visibleY=spanY/camera.zoom;
  // Desktop keeps its permanent right-tip crop. Phones show the complete,
  // centered sea plate with deliberate space on both sides.
  const centerX=width<=650?(bounds.min.x+bounds.max.x)/2:
    bounds.max.x-visibleX/2-Math.min(28,width*.025)*visibleX/width;
  const centerY=T.MathUtils.clamp((frame.top+frame.bottom)/2-lift*visibleY/height,
    bounds.max.y-visibleY/2+padding*visibleY/height,
    bounds.min.y+visibleY/2-(padding+lift)*visibleY/height);
  camera.left=centerX-spanX/2;camera.right=centerX+spanX/2;
  camera.top=centerY+spanY/2;camera.bottom=centerY-spanY/2;
}
