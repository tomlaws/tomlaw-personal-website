import { FramebufferTexture, Source } from 'three';

// Backport https://github.com/mrdoob/three.js/pull/34636 for r180.
// Transmission snapshots for the harbour mirror and the main camera must not
// share mutable size/source metadata. Otherwise each differently sized capture
// invalidates the other texture, making lit glass and its bloom flicker.
// Feature detection makes this a no-op after upgrading to a fixed Three build.
export function isolateFramebufferTextures() {
  const probe = new FramebufferTexture(2, 2), clone = probe.clone();
  const needsFix = probe.source === clone.source;
  probe.dispose(); clone.dispose();
  if (!needsFix) return false;
  const copy = FramebufferTexture.prototype.copy;
  FramebufferTexture.prototype.copy = function (source) {
    copy.call(this, source);
    this.source = new Source({ ...source.image });
    return this;
  };
  return true;
}
