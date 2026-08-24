import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/file-formats.js', import.meta.url), 'utf8');
const formats = await import(`data:text/javascript,${encodeURIComponent(source)}`);

{
  const exportData = {
    siteVersion: 'v4.8.22',
    version: '0.0.2',
    playerId: '601053043',
    pulls: [
      { cardPoolType: 1, resourceId: 1109, qualityLevel: 5, name: 'Lucilla', time: '2026-06-13T11:35:28+00:00', group: 10 },
      { cardPoolType: 1, resourceId: 21020043, qualityLevel: 3, name: 'Sword of Voyager', time: '2026-06-13T11:35:28+00:00', group: 1 },
      { cardPoolType: 11, resourceId: 21030056, qualityLevel: 5, name: 'Spectral Trigger', time: '2026-06-08T06:28:34+00:00', group: 5 },
    ],
  };
  const grouped = formats.groupWuwaJson(exportData);
  const poolOne = formats.sortWuwaFilePulls(grouped['1'].map((entry) => formats.normalizeWuwaFilePull(entry, '1')));
  assert.equal(formats.detectWuwaJsonSource(exportData), 'WuWa Tracker');
  assert.deepEqual(Object.keys(grouped).sort(), ['1', '11']);
  assert.deepEqual(poolOne.map((pull) => pull.group), [1, 10]);
  assert.equal(poolOne[0].itemType, 'Weapon');
  assert.equal(poolOne[1].itemType, 'Resonator');
}

{
  const rows = [
    { Type: 'Weapon', Name: 'Ferrous Shadow', Time: '2022-10-14 18:25:21', '⭐': 3, Pity: 1, '#Roll': 2 },
    { Type: 'Weapon', Name: 'Debate Club', Time: '2022-10-14 18:25:21', '⭐': 3, Pity: 1, '#Roll': 1 },
    { Type: 'Character', Name: 'Xiangling', Time: '2022-10-14 18:25:21', '⭐': 4, Pity: 4, '#Roll': 4 },
  ];
  const pulls = formats.normalizePaimonRows(rows, 'character');
  assert.equal(formats.matchGenshinBanner('Character Event'), 'character');
  assert.equal(formats.matchGenshinBanner("Beginners' Wish"), 'novice');
  assert.deepEqual(pulls.map((pull) => pull.name), ['Debate Club', 'Ferrous Shadow', 'Xiangling']);
  assert.deepEqual(pulls.map((pull) => pull.rarity), [3, 3, 4]);
  assert.deepEqual(pulls.map((pull) => pull.sourceOrder), [1, 2, 4]);
  assert.deepEqual(pulls.map((pull) => pull.sourcePity), [1, 1, 4]);
  assert.ok(pulls.every((pull) => pull.gachaType === '301'));
}

console.log('Third-party file format tests passed');
