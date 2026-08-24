import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/wuwa-merge.js', import.meta.url), 'utf8');
const { mergeWuwaHistory } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const pull = (name, time, rarity = 3, itemType = 'Weapon') => ({ name, time, rarity, itemType });

{
  const stored = [pull('A', '01'), pull('B', '02'), pull('C', '03')];
  const fresh = [pull('A', '01'), pull('B', '02'), pull('C', '03'), pull('D', '04')];
  const result = mergeWuwaHistory(stored, fresh);
  assert.equal(result.added, 1);
  assert.deepEqual(result.list.map((p) => p.name), ['A', 'B', 'C', 'D']);
}

{
  // A capped API response can be shorter than stored history while ending in new pulls.
  const stored = ['A', 'B', 'C', 'D', 'E'].map((name, i) => pull(name, `0${i + 1}`));
  const fresh = [pull('D', '04'), pull('E', '05'), pull('F', '06')];
  const result = mergeWuwaHistory(stored, fresh);
  assert.equal(result.added, 1);
  assert.deepEqual(result.list.map((p) => p.name), ['A', 'B', 'C', 'D', 'E', 'F']);
}

{
  // Timezone-shifted file data still overlaps by its ordered item sequence.
  const stored = [pull('A', '2026-01-01 01:00:00'), pull('B', '2026-01-01 01:00:01'), pull('C', '2026-01-01 01:00:02'), pull('D', '2026-01-01 01:00:03')];
  const fresh = [pull('A', '2026-01-01 09:00:00'), pull('B', '2026-01-01 09:00:01'), pull('C', '2026-01-01 09:00:02'), pull('D', '2026-01-01 09:00:03'), pull('E', '2026-01-01 09:00:04')];
  const result = mergeWuwaHistory(stored, fresh);
  assert.equal(result.added, 1);
  assert.equal(result.strategy, 'content-overlap');
  assert.equal(result.list.at(-1).name, 'E');
}

{
  // Identical items inside one ten-pull keep their multiplicity and remain idempotent.
  const stored = [pull('Broadblade', '2026-01-01 10:00:00')];
  const fresh = [pull('Broadblade', '2026-01-01 10:00:00'), pull('Broadblade', '2026-01-01 10:00:00')];
  const first = mergeWuwaHistory(stored, fresh);
  const second = mergeWuwaHistory(first.list, fresh);
  assert.equal(first.added, 1);
  assert.equal(second.added, 0);
  assert.equal(second.list.length, 2);
}

console.log('WuWa merge tests passed');
