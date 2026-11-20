import assert from 'node:assert/strict';
import {captureShaderErrors} from '../src/harbour/shader-errors.mjs';

const renderer={debug:{checkShaderErrors:false}};
const failures=captureShaderErrors(renderer);
assert.equal(renderer.debug.checkShaderErrors,true);
failures.check();
renderer.debug.onShaderError({getProgramInfoLog:()=> 'Program could not link',
  getShaderInfoLog:shader=> shader==='fragment'?'Invalid fragment shader':''},'program','vertex','fragment');
assert.throws(()=>failures.check(),/Program could not link\nInvalid fragment shader/,
  'A reported GPU failure becomes an exception for the renderer fallback');
assert.throws(()=>failures.check(),/Harbour shader failed/,
  'A failed first frame cannot later be announced as ready');
const empty={debug:{}};
const missingLogs=captureShaderErrors(empty);
empty.debug.onShaderError({getProgramInfoLog:()=>'',getShaderInfoLog:()=>''},null,null,null);
assert.throws(()=>missingLogs.check(),/Harbour shader failed/,'Missing driver diagnostics cannot hide shader failure');
console.log('Shader failures trigger renderer fallback instead of silent empty frames.');
