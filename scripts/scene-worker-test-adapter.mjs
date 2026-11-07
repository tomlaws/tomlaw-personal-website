import { parentPort } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';

globalThis.self = {
  postMessage: (value, transfer) => parentPort.postMessage(value, transfer),
};
globalThis.fetch = async url => new Response(await readFile(new URL(url)));
await import('../src/harbour/scene-decode-worker.js');
parentPort.on('message', data => self.onmessage({data}));
