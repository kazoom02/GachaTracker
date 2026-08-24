import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/highlight-view.js', import.meta.url), 'utf8');
const { paginateHighlights } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

// main.js supplies newest-first rows. Pagination must expose every item, while the
// oldest-first control should put the account's first five-star at the beginning.
const rows = Array.from({ length: 58 }, (_, index) => ({
  name: index === 57 ? 'Albedo' : `Five Star ${58 - index}`,
  rarity: 5,
}));

const newestPageOne = paginateHighlights(rows, { rarity: 5, order: 'newest', page: 1, pageSize: 40 });
assert.equal(newestPageOne.items.length, 40);
assert.equal(newestPageOne.total, 58);
assert.equal(newestPageOne.maxPage, 2);
assert.equal(newestPageOne.end, 40);

const newestPageTwo = paginateHighlights(rows, { rarity: 5, order: 'newest', page: 2, pageSize: 40 });
assert.equal(newestPageTwo.items.length, 18);
assert.equal(newestPageTwo.items.at(-1).name, 'Albedo');
assert.deepEqual([newestPageTwo.start, newestPageTwo.end], [41, 58]);

const oldestFirst = paginateHighlights(rows, { rarity: 5, order: 'oldest', page: 1, pageSize: 40 });
assert.equal(oldestFirst.items[0].name, 'Albedo');

console.log('Highlight ordering and pagination tests passed');
