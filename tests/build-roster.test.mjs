import assert from 'node:assert/strict';
const memory = new Map();
globalThis.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
};
const { getRosterOverrides, setRosterOverride, clearRosterOverrides } = await import('../public/js/build-roster.js');
assert.deepEqual(getRosterOverrides('p1'), {});
setRosterOverride('p1', 'Qiqi', 2);
setRosterOverride('p1', 'Sandrone', -1);
assert.deepEqual(getRosterOverrides('p1'), { Qiqi: 2, Sandrone: -1 });
setRosterOverride('p1', 'Qiqi', '');
assert.deepEqual(getRosterOverrides('p1'), { Sandrone: -1 });
clearRosterOverrides('p1');
assert.deepEqual(getRosterOverrides('p1'), {});
console.log('build roster tests passed');
