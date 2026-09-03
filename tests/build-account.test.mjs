import assert from 'node:assert/strict';
import { analyzeGenshinOwnership, characterHistoryStatus, teamHistoryStatus, weaponHistoryStatus } from '../public/js/build-account.js';

const data = {
  genshin: {
    character: [
      { name: 'Odette', itemType: 'Character', rarity: 5 },
      { name: 'Yae Miko', itemType: 'Character', rarity: 5 },
      { name: 'Yae Miko', itemType: 'Character', rarity: 5 },
      { name: 'Qiqi', itemType: 'Character', rarity: 5 },
      { name: 'Cool Steel', itemType: 'Weapon', rarity: 3 },
    ],
    standard: [
      { name: 'Qiqi', itemType: 'Character', rarity: 5 },
      { name: 'Favonius Sword', itemType: 'Weapon', rarity: 4 },
    ],
  },
};

const ownership = analyzeGenshinOwnership(data);
assert.equal(ownership.characters.size, 3);
assert.equal(ownership.characters.get('Yae Miko'), 2);
assert.equal(ownership.weapons.get('Favonius Sword'), 1);
assert.equal(characterHistoryStatus('Yae Miko', ownership, 1).state, 'verified');
assert.equal(characterHistoryStatus('Yae Miko', ownership, 2).state, 'short');
assert.equal(characterHistoryStatus('Sandrone', ownership).state, 'unknown');
assert.equal(weaponHistoryStatus('Favonius Sword', ownership).state, 'verified');

const team = {
  members: [
    { name: 'Odette' },
    { name: 'Yae Miko', minConstellation: 1 },
    { name: 'Qiqi' },
  ],
};
assert.equal(teamHistoryStatus(team, ownership).fullyVerified, true);
team.members.push({ name: 'Sandrone' });
assert.equal(teamHistoryStatus(team, ownership).fullyVerified, false);
assert.equal(teamHistoryStatus(team, ownership).unknown, 1);

console.log('Build ownership tests passed');
