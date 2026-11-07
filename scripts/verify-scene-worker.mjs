import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { readSceneData } from '../src/harbour/scene-codec.mjs';

const asset = JSON.parse(await readFile('src/harbour/world-asset.json', 'utf8'));
const url = new URL(`../public/world/${asset.file}`, import.meta.url);
const expected = await readSceneData(new Response(await readFile(url)));
const worker = new Worker(new URL('./scene-worker-test-adapter.mjs', import.meta.url));
try {
  worker.postMessage({url: url.href});
  const [result] = await once(worker, 'message');
  assert.equal(result.error, undefined);
  assert.deepEqual(result.scene.world, expected.world, 'Worker preserves the complete world metadata');
  const arrays = value => {
    const result = [];
    const visit = item => {
      if (!item || typeof item !== 'object') return;
      if (ArrayBuffer.isView(item)) { result.push(item); return; }
      for (const child of Object.values(item)) visit(child);
    };
    visit(value); return result;
  };
  const actualArrays = arrays(result.scene), expectedArrays = arrays(expected);
  assert.equal(actualArrays.length, expectedArrays.length);
  for (let i=0; i<actualArrays.length; i++) assert.deepEqual(actualArrays[i], expectedArrays[i], `Geometry buffer ${i} remains lossless`);
  console.log(`Scene worker: ${actualArrays.length} transferred buffers match the lossless original.`);
} finally { await worker.terminate(); }
