import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import tailwindcss from '@tailwindcss/vite';
import {worldSourceHash} from './scripts/world-inputs.mjs';

const worldVersionId='\0virtual:harbour-world-version';
const worldVersion={
  name:'harbour-world-version',
  resolveId(id){if(id==='virtual:harbour-world-version')return worldVersionId;},
  async load(id){if(id===worldVersionId)return `export default ${JSON.stringify(await worldSourceHash())};`;},
  configureServer(server){
    server.watcher.on('change',file=>{
      const path=file.replaceAll('\\','/');
      if(!(/\/src\/harbour\/[^/]+\.(mjs|js)$/.test(path)||/\/public\/hk-models\/[^/]+\.glb$/.test(path)))return;
      const module=server.moduleGraph.getModuleById(worldVersionId);
      if(module){server.moduleGraph.invalidateModule(module);server.ws.send({type:'full-reload'});}
    });
  },
};

// Begin downloading the lossless world as soon as production HTML arrives,
// rather than waiting for React, the iframe and the renderer module graph.
const worldPreload = {
  name: 'harbour-world-preload',
  apply: 'build',
  async transformIndexHtml(html, context) {
    if (!context.filename.endsWith('index.html') || context.filename.includes('harbour')) return;
    const asset = JSON.parse(await readFile('src/harbour/world-asset.json', 'utf8'));
    return [{ tag: 'link', attrs: { rel: 'preload', as: 'fetch', href: `world/${asset.file}`, crossorigin: 'anonymous' }, injectTo: 'head-prepend' }];
  },
};

export default defineConfig({
  plugins: [tailwindcss(),worldVersion,worldPreload],
  worker: { format: 'es',plugins:()=>[worldVersion] },
  // Generated GLBs are published through the manifest. Restart Vite whenever
  // the generator introduces a new filename so its public-file index refreshes.
  server: { watch: { ignored: ['**/assets/blender/**', '**/assets/validation/**', '**/screenshots/**', '**/public/models/*.glb', '**/tools/blender/**'] } },
  build: { rollupOptions: {
    input: { portfolio: 'index.html', harbour: 'harbour/index.html' },
    output: { manualChunks: { 'three-engine': ['three'], 'react-runtime': ['react','react-dom'] } },
  } },
});
