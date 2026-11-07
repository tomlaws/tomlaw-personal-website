import { defineConfig } from 'vite';
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

export default defineConfig({
  plugins: [tailwindcss(),worldVersion],
  worker: { format: 'es',plugins:()=>[worldVersion] },
  // Generated GLBs are published through the manifest. Restart Vite whenever
  // the generator introduces a new filename so its public-file index refreshes.
  server: { watch: { ignored: ['**/assets/blender/**', '**/assets/validation/**', '**/screenshots/**', '**/public/models/*.glb', '**/tools/blender/**'] } },
  build: { rollupOptions: {
    input: { portfolio: 'index.html', harbour: 'harbour/index.html' },
    output: { manualChunks: { 'three-engine': ['three'], 'react-runtime': ['react','react-dom'] } },
  } },
});
