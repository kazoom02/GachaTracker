import assert from 'node:assert/strict';
import { GENSHIN_BUILD_CATALOG, canonicalCharacterName, getCatalogCharacter } from '../public/js/build-catalog.js';
assert.equal(GENSHIN_BUILD_CATALOG.length, 125);
assert.equal(new Set(GENSHIN_BUILD_CATALOG.map(x => x.id)).size, 125);
assert.equal(canonicalCharacterName('Kazuha'), 'Kaedehara Kazuha');
assert.equal(canonicalCharacterName('Traveler (Cryo)'), 'Cryo Traveler');
assert.equal(getCatalogCharacter('odette').name, 'Odette');

assert.deepEqual(getCatalogCharacter('itto').gcsimKeys, ['aratakiitto']);
assert.deepEqual(getCatalogCharacter('kaedehara-kazuha').gcsimKeys, ['kaedeharakazuha']);
assert.deepEqual(getCatalogCharacter('raiden-shogun').gcsimKeys, ['raidenshogun']);
assert.equal(canonicalCharacterName('aratakiitto'), 'Arataki Itto');
assert.equal(canonicalCharacterName('yumemizukimizuki'), 'Yumemizuki Mizuki');
console.log('build catalog tests passed');
