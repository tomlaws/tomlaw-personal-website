// NodeBuffer identifiers are private WGSL names. WebGPU binds buffers by
// group and binding number, so canonical names allow identical generated
// shaders for different cameras to share Three.js program/pipeline caches.
export function canonicalizeNodeBuffers(source) {
  if (!source) return source;
  const names = new Map();
  return source.replace(/NodeBuffer_\d+/g, name => {
    if (!names.has(name)) names.set(name, `NodeBuffer_${names.size}`);
    return names.get(name);
  });
}

export function shareEquivalentVertexPrograms(renderer) {
  const nodes = renderer._nodes;
  if (!nodes || typeof nodes._createNodeBuilderState !== 'function') return;
  const create = nodes._createNodeBuilderState;
  nodes._createNodeBuilderState = function(builder) {
    const state = create.call(this, builder);
    state.vertexShader = canonicalizeNodeBuffers(state.vertexShader);
    return state;
  };
}
