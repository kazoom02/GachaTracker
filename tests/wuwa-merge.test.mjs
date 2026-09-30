import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/wuwa-merge.js', import.meta.url), 'utf8');
const { mergeWuwaHistory, repairWuwaHistory } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const pull = (name, time, rarity = 3, itemType = 'Weapon', resourceId = '') => ({ name, time, rarity, itemType, resourceId });

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

{
  // File inference and a localized live label may disagree on itemType. The stable
  // resource id still identifies the overlap, preventing a full-history duplicate.
  const stored = [
    pull('Sword of Voyager', '2026-01-01 01:00:00', 3, 'Weapon', '21020043'),
    pull('Lucilla', '2026-01-01 01:00:01', 5, 'Resonator', '1109'),
  ];
  const fresh = [
    pull('Sword of Voyager', '2026-01-01 09:00:00', 3, 'Arma', '21020043'),
    pull('Lucilla', '2026-01-01 09:00:01', 5, 'Ressonador', '1109'),
    pull('Broadblade of Night', '2026-01-01 09:00:02', 3, 'Arma', '21010015'),
  ];
  const result = mergeWuwaHistory(stored, fresh);
  assert.equal(result.added, 1);
  assert.equal(result.strategy, 'content-overlap');
  assert.deepEqual(result.list.map((p) => p.name), ['Sword of Voyager', 'Lucilla', 'Broadblade of Night']);
}

{
  // Convene's older JSON exports omitted resourceId. A later live import carries
  // ids for those same rows and must enrich them instead of appending copies.
  const stored = [
    pull('Sword of Voyager', '2026-01-01 01:00:00', 3),
    pull('Lucilla', '2026-01-01 01:00:01', 5, 'Resonator'),
  ];
  const fresh = [
    pull('Sword of Voyager', '2026-01-01 01:00:00', 3, 'Weapon', '21020043'),
    pull('Lucilla', '2026-01-01 01:00:01', 5, 'Resonator', '1109'),
    pull('Broadblade of Night', '2026-01-01 01:00:02', 3, 'Weapon', '21010015'),
  ];
  const result = mergeWuwaHistory(stored, fresh);
  assert.equal(result.added, 1);
  assert.equal(result.strategy, 'exact-overlap');
  assert.deepEqual(result.list.map((p) => p.resourceId), ['21020043', '1109', '21010015']);
}

{
  // The same id-less export can be UTC while the live API uses server-local time.
  const stored = [
    pull('A', '2026-01-01 01:00:00'),
    pull('B', '2026-01-01 01:00:01'),
    pull('C', '2026-01-01 01:00:02'),
    pull('D', '2026-01-01 01:00:03'),
  ];
  const fresh = [
    pull('A', '2026-01-01 09:00:00', 3, 'Weapon', '1'),
    pull('B', '2026-01-01 09:00:01', 3, 'Weapon', '2'),
    pull('C', '2026-01-01 09:00:02', 3, 'Weapon', '3'),
    pull('D', '2026-01-01 09:00:03', 3, 'Weapon', '4'),
    pull('E', '2026-01-01 09:00:04', 3, 'Weapon', '5'),
  ];
  const result = mergeWuwaHistory(stored, fresh);
  assert.equal(result.added, 1);
  assert.equal(result.strategy, 'content-overlap');
  assert.deepEqual(result.list.map((p) => p.resourceId), ['1', '2', '3', '4', '5']);
}

{
  // Repair histories already affected by the bug. Two identical pulls in one
  // ten-pull remain two pulls; only their two id-less legacy copies disappear.
  const legacy = [
    pull('Broadblade', '2026-01-01 10:00:00'),
    pull('Broadblade', '2026-01-01 10:00:00'),
    pull('Broadblade', '2026-01-01 10:00:00', 3, 'Weapon', '21010015'),
    pull('Broadblade', '2026-01-01 10:00:00', 3, 'Weapon', '21010015'),
  ];
  const repaired = repairWuwaHistory(legacy);
  assert.equal(repaired.length, 2);
  assert.ok(repaired.every((entry) => entry.resourceId === '21010015'));

  const result = mergeWuwaHistory(legacy, repaired);
  assert.equal(result.added, 0);
  assert.equal(result.list.length, 2);
}

{
  // Do not collapse a partially identified repeated group: it may represent
  // several genuine identical items whose live window was incomplete.
  const partial = [
    pull('Broadblade', '2026-01-01 10:00:00'),
    pull('Broadblade', '2026-01-01 10:00:00'),
    pull('Broadblade', '2026-01-01 10:00:00', 3, 'Weapon', '21010015'),
  ];
  assert.equal(repairWuwaHistory(partial).length, 3);
}

{
  // Legacy duplicates may also be several hours apart when a file used UTC and
  // the live API used server-local time. Ordered overlap still identifies them.
  const idless = ['A', 'B', 'C', 'D'].map((name, index) =>
    pull(name, `2026-01-01 01:00:0${index}`));
  const identified = ['A', 'B', 'C', 'D', 'E'].map((name, index) =>
    pull(name, `2026-01-01 09:00:0${index}`, 3, 'Weapon', String(index + 1)));
  const repaired = repairWuwaHistory(idless.concat(identified));
  assert.deepEqual(repaired.map((entry) => entry.name), ['A', 'B', 'C', 'D', 'E']);
  assert.ok(repaired.every((entry) => entry.resourceId));
}

console.log('WuWa merge tests passed');
