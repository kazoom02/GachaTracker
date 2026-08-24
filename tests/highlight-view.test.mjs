import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/highlight-view.js', import.meta.url), 'utf8');
const { filterHighlights } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

// main.js supplies newest-first rows. Every matching item should remain visible,
// while the oldest-first control puts the account's first five-star at the beginning.
const rows = Array.from({ length: 58 }, (_, index) => ({
  name: index === 57 ? 'Albedo' : `Five Star ${58 - index}`,
  rarity: 5,
}));

const newestFirst = filterHighlights(rows, { rarity: 5, order: 'newest' });
assert.equal(newestFirst.length, 58);
assert.equal(newestFirst[0].name, 'Five Star 58');
assert.equal(newestFirst.at(-1).name, 'Albedo');

const oldestFirst = filterHighlights(rows, { rarity: 5, order: 'oldest' });
assert.equal(oldestFirst.length, 58);
assert.equal(oldestFirst[0].name, 'Albedo');
assert.equal(oldestFirst.at(-1).name, 'Five Star 58');

assert.equal(filterHighlights([{ rarity: 4 }, { rarity: 5 }], { rarity: 4 }).length, 1);

console.log('Highlight filtering and ordering tests passed');
