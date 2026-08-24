import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/genshin-merge.js', import.meta.url), 'utf8');
const { mergeGenshinHistory } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const filePull = (name, time, rarity = 3, gachaType = '301') => ({
  id: '', name, time, rarity, itemType: rarity === 5 ? 'Character' : 'Weapon', gachaType,
});
const livePull = (id, name, time, rarity = 3, gachaType = '400') => ({
  id, name, time, rarity, itemType: rarity === 5 ? 'Character' : 'Weapon', gachaType,
});

{
  // paimon.moe labels the combined Character Event sheet as 301. The same live
  // history can contain type 400 and must enrich—not duplicate—the file rows.
  const stored = [
    filePull('Cool Steel', '2026-08-20 12:00:00'),
    filePull('Lucilla', '2026-08-20 12:00:01', 5),
  ];
  const incoming = [
    livePull('1001', 'Cool Steel', '2026-08-20 12:00:00'),
    livePull('1002', 'Lucilla', '2026-08-20 12:00:01', 5),
    livePull('1003', 'Debate Club', '2026-08-24 18:00:00'),
  ];
  const result = mergeGenshinHistory(stored, incoming);
  assert.equal(result.added, 1);
  assert.equal(result.list.length, 3);
  assert.deepEqual(result.list.map((pull) => pull.id), ['1001', '1002', '1003']);
  assert.ok(result.list.every((pull) => pull.gachaType === '400'));
}

{
  // Genuine repeated weapons in one ten-pull keep their multiplicity, while a
  // second live import remains idempotent.
  const stored = [filePull('Cool Steel', '2026-08-20 12:00:00')];
  const incoming = [
    livePull('2001', 'Cool Steel', '2026-08-20 12:00:00'),
    livePull('2002', 'Cool Steel', '2026-08-20 12:00:00'),
  ];
  const first = mergeGenshinHistory(stored, incoming);
  const second = mergeGenshinHistory(first.list, incoming);
  assert.equal(first.added, 1);
  assert.equal(first.list.length, 2);
  assert.equal(second.added, 0);
  assert.equal(second.list.length, 2);
}

{
  // Heal duplicates already written by the old 301/400 mismatch: paired id-less
  // file rows are removed in favour of their real-id live copies.
  const stored = [
    filePull('Cool Steel', '2026-08-20 12:00:00'),
    filePull('Cool Steel', '2026-08-20 12:00:00'),
    livePull('3001', 'Cool Steel', '2026-08-20 12:00:00'),
    livePull('3002', 'Cool Steel', '2026-08-20 12:00:00'),
  ];
  const result = mergeGenshinHistory(stored, []);
  assert.equal(result.added, 0);
  assert.equal(result.list.length, 2);
  assert.deepEqual(result.list.map((pull) => pull.id), ['3001', '3002']);
}

{
  // A partial live window is not enough evidence to collapse repeated file pulls.
  const stored = [
    filePull('Cool Steel', '2026-08-20 12:00:00'),
    filePull('Cool Steel', '2026-08-20 12:00:00'),
    livePull('4001', 'Cool Steel', '2026-08-20 12:00:00'),
  ];
  const result = mergeGenshinHistory(stored, []);
  assert.equal(result.list.length, 3);
}

console.log('Genshin cross-source merge tests passed');
