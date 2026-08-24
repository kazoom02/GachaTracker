import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const legacy = {
  version: 1,
  updatedAt: '2026-08-24T00:00:00.000Z',
  genshin: { character: [{ id: '', name: 'Legacy Pull', rarity: 5, time: '2026-08-20 12:00:00', gachaType: '301' }] },
  wuwa: {},
};

const memory = new Map([['test-profile-storage', JSON.stringify(legacy)]]);
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

let source = await readFile(new URL('../public/js/store.js', import.meta.url), 'utf8');
source = source
  .replace(
    "import { STORAGE_KEY, GENSHIN_BANNERS } from './config.js?v=20260824d';",
    "const STORAGE_KEY = 'test-profile-storage'; const GENSHIN_BANNERS = [{ key: 'character' }, { key: 'weapon' }, { key: 'standard' }];"
  )
  .replace(
    "import { mergeGenshinHistory, sortGenshinHistory } from './genshin-merge.js?v=20260824d';",
    "const mergeGenshinHistory = (stored, incoming) => ({ list: stored.concat(incoming), added: incoming.length }); const sortGenshinHistory = (pulls) => pulls.slice();"
  )
  .replace(
    "import { mergeWuwaHistory } from './wuwa-merge.js?v=20260824d';",
    "const mergeWuwaHistory = (stored, incoming) => ({ list: stored.concat(incoming), added: incoming.length });"
  );

const store = await import(`data:text/javascript,${encodeURIComponent(source)}`);

// Existing v1 history is migrated into the default profile without losing pulls.
assert.equal(store.getProfiles().length, 1);
assert.equal(store.getActiveProfile().name, 'My Account');
assert.equal(store.getActiveProfile().pullCount, 1);
assert.equal(store.getData().genshin.character[0].name, 'Legacy Pull');

// A second profile is isolated from the migrated account.
const alt = store.createProfile('Alt Account');
assert.equal(store.getActiveProfile().id, alt.id);
assert.equal(store.getActiveProfile().pullCount, 0);
store.replaceWuwaPool('1', [{ name: 'Alt Pull', rarity: 5, time: '2026-08-24 12:00:00' }]);
store.save();
assert.equal(store.getActiveProfile().pullCount, 1);

const main = store.getProfiles().find((profile) => profile.name === 'My Account');
store.switchProfile(main.id);
assert.equal(store.getData().genshin.character[0].name, 'Legacy Pull');
assert.deepEqual(store.getData().wuwa, {});

// Full backups carry every profile and can restore the active selection.
store.switchProfile(alt.id);
const backup = store.exportProfilesBackup();
assert.equal(backup.type, 'gacha-tracker-profiles-backup');
assert.equal(Object.keys(backup.profiles).length, 2);
store.renameProfile(alt.id, 'Secondary Account');
store.replaceProfilesBackup(backup);
assert.equal(store.getActiveProfile().name, 'Alt Account');
assert.equal(store.getData().wuwa['1'][0].name, 'Alt Pull');

// Deleting one profile keeps the other account and its data intact.
store.deleteProfile(main.id);
assert.equal(store.getProfiles().length, 1);
assert.equal(store.getActiveProfile().name, 'Alt Account');
assert.throws(() => store.deleteProfile(alt.id), /at least one profile/i);

console.log('Profile storage and migration tests passed');
