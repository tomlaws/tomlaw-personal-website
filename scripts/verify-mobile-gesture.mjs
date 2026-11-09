import assert from 'node:assert/strict';
import {createMobileGesture} from '../src/mobile-gesture.mjs';
let callbacks = new Map(), id = 0, changes = [];
const gesture = createMobileGesture({
  enabled: () => true,
  setSuspended: value => changes.push(value),
  setTimer: fn => {callbacks.set(++id,fn);return id;},
  clearTimer: key => callbacks.delete(key),
});
gesture.touchStart();
gesture.scroll();
assert.deepEqual(changes,[true], 'A held finger suspends rendering exactly once');
assert.equal(callbacks.size,0,'Rendering cannot resume while a finger is held down');
gesture.touchEnd({touches:[]});
assert.equal(callbacks.size,1,'Release begins the momentum idle timeout');
gesture.scroll();
assert.equal(callbacks.size,1,'Momentum scroll extends the idle timeout');
[...callbacks.values()][0]();
assert.deepEqual(changes,[true,false], 'Rendering resumes once momentum has stopped');
gesture.touchStart();
gesture.touchEnd({touches:[]});
gesture.scrollEnd();
assert.deepEqual(changes,[true,false,true,false], 'Native scrollend resumes promptly');
assert.equal(callbacks.size,0,'No timer is left after scrollend');
gesture.dispose();
console.log('Mobile gesture: rendering stays suspended throughout touch and momentum, then resumes.');
