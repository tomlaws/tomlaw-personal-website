import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Matrix4, NoBlending } from 'three';

// Glass and invisible picking volumes must not become opaque in the AO buffer.
export class CityContactPass extends GTAOPass {
  cacheValid = false;
  lastRefresh = -Infinity;
  refreshInterval = 1000 / 10;
  cachedView = new Matrix4();
  cachedProjection = new Matrix4();

  setSize(width, height) {
    super.setSize(width, height);
    this.cacheValid = false;
  }

  render(renderer, writeBuffer, readBuffer, ...args) {
    const now = performance.now();
    const cameraChanged = !this.cachedView.equals(this.camera.matrixWorld)
      || !this.cachedProjection.equals(this.camera.projectionMatrix);
    if (!this.cacheValid || cameraChanged || now - this.lastRefresh >= this.refreshInterval
      || this.output !== GTAOPass.OUTPUT.Default) {
      super.render(renderer, writeBuffer, readBuffer, ...args);
      this.cachedView.copy(this.camera.matrixWorld);
      this.cachedProjection.copy(this.camera.projectionMatrix);
      this.lastRefresh = now;
      this.cacheValid = true;
      return;
    }
    // The camera is still: retain the existing AO texture and blend it onto
    // this frame's live colour. Animated geometry refreshes at 10 Hz.
    this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.copyMaterial.blending = NoBlending;
    const target = this.renderToScreen ? null : writeBuffer;
    this._renderPass(renderer, this.copyMaterial, target);
    this.blendMaterial.uniforms.intensity.value = this.blendIntensity;
    this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture;
    this._renderPass(renderer, this.blendMaterial, target);
  }

  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse(object => {
      if (!object.isMesh || !object.visible) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every(material => material.transparent || material.visible === false)) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}
