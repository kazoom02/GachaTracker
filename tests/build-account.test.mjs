import assert from 'node:assert/strict';
import { analyzeGenshinOwnership, characterHistoryStatus, rankBuildableTeams, rankClosestTeams, suggestTeamSubstitutions, teamHistoryStatus, weaponHistoryStatus } from '../public/js/build-account.js';

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
assert.equal(characterHistoryStatus('Traveler (Dendro)', ownership).state, 'verified');
assert.equal(characterHistoryStatus('Traveler (Dendro)', ownership, 1).state, 'short');

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


// Alias normalization + manual roster corrections.
const aliasOwnership = analyzeGenshinOwnership({ genshin: { character: [{ name: 'Kazuha', itemType: 'Character' }] } });
assert.equal(aliasOwnership.characters.get('Kaedehara Kazuha'), 1);
assert.equal(characterHistoryStatus('Kaedehara Kazuha', aliasOwnership).state, 'verified');
assert.equal(characterHistoryStatus('Sandrone', ownership, 0, { Sandrone: 0 }).state, 'verified');
assert.equal(characterHistoryStatus('Sandrone', ownership, 0, { Sandrone: -1 }).state, 'unowned');

const optimizerTeams = [
  { rank: 1, name: 'Top', dps: 200000, members: [{ name: 'Odette' }, { name: 'Sandrone' }] },
  { rank: 2, name: 'Available', dps: 170000, members: [{ name: 'Odette' }, { name: 'Yae Miko', minConstellation: 1 }, { name: 'Qiqi' }] },
  { rank: 3, name: 'Guide team', tier: 'SS', dps: null, members: [{ name: 'Odette' }, { name: 'Qiqi' }] },
];
const ranked = rankBuildableTeams(optimizerTeams, ownership, {});
assert.equal(ranked[0].team.name, 'Available');
assert.equal(ranked[1].team.name, 'Guide team');
const withCorrection = rankBuildableTeams(optimizerTeams, ownership, { Sandrone: 0 });
assert.equal(withCorrection[0].team.name, 'Top');
const closest = rankClosestTeams(optimizerTeams, ownership, {}, 2);
assert.equal(closest[0].team.name, 'Top');


// Source-backed substitution tests.
const substitutionOwnership = analyzeGenshinOwnership({
  genshin: {
    character: [
      { name: 'Arlecchino', itemType: 'Character' },
      { name: 'Bennett', itemType: 'Character' },
      { name: 'Xilonen', itemType: 'Character' },
      { name: 'Fischl', itemType: 'Character' },
    ],
  },
});
const substitutionTeams = [
  {
    rank: 1,
    name: 'Yae version',
    tier: 'SS',
    members: [
      { name: 'Arlecchino', role: 'Main DPS' },
      { name: 'Yae Miko', role: 'Sub DPS' },
      { name: 'Xilonen', role: 'Support' },
      { name: 'Bennett', role: 'Healer / Support' },
    ],
  },
  {
    rank: 2,
    name: 'Fischl swap',
    tier: 'S',
    members: [
      { name: 'Arlecchino', role: 'Main DPS' },
      { name: 'Fischl', role: 'Sub DPS' },
      { name: 'Xilonen', role: 'Support' },
      { name: 'Bennett', role: 'Healer / Support' },
    ],
  },
  {
    rank: 3,
    name: 'Unknown swap',
    tier: 'S',
    members: [
      { name: 'Arlecchino', role: 'Main DPS' },
      { name: 'Yelan', role: 'Sub DPS' },
      { name: 'Xilonen', role: 'Support' },
      { name: 'Bennett', role: 'Healer / Support' },
    ],
  },
];
const substitutions = suggestTeamSubstitutions(
  substitutionTeams[0],
  substitutionTeams,
  substitutionOwnership,
  {},
  'Arlecchino',
  [],
  3,
);
assert.equal(substitutions.length, 1);
assert.equal(substitutions[0].member.name, 'Yae Miko');
assert.equal(substitutions[0].candidates[0].name, 'Fischl');
assert.equal(substitutions[0].candidates[0].status.state, 'verified');
assert.ok(substitutions[0].candidates[0].evidence.includes('Direct guide swap'));

// The focus character should never get a misleading replacement suggestion.
const missingFocusOwnership = analyzeGenshinOwnership({ genshin: { character: [{ name: 'Bennett', itemType: 'Character' }] } });
const focusSuggestions = suggestTeamSubstitutions(
  substitutionTeams[0],
  substitutionTeams,
  missingFocusOwnership,
  {},
  'Arlecchino',
);
const focusEntry = focusSuggestions.find((entry) => entry.member.name === 'Arlecchino');
assert.equal(focusEntry.coreCharacter, true);
assert.deepEqual(focusEntry.candidates, []);

console.log('Source-backed substitution tests passed');
