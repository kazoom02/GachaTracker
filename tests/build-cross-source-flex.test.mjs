import assert from 'node:assert/strict';
import { crossSourceFlexTeams } from '../public/js/build-flex-data.js';
import {
  analyzeGenshinOwnership,
  suggestTeamSubstitutions,
} from '../public/js/build-account.js';

const base = {
  rank: 2,
  name: 'Freeze',
  reaction: 'Freeze',
  members: [
    { name:'Lohen', role:'Main DPS' },
    { name:'Furina', role:'Sub-DPS' },
    { name:'Mona', role:'Support' },
    { name:'Escoffier', role:'Sub-DPS' },
  ],
};

const flex = crossSourceFlexTeams('lohen');
assert(flex.some((team) => team.members.some((member) => member.name === 'Xilonen')));
assert(flex.some((team) => team.members.some((member) => member.name === 'Mika')));
assert(flex.some((team) => team.members.some((member) => member.name === 'Charlotte')));

const ownership = analyzeGenshinOwnership({
  genshin: {
    character: [
      { name:'Lohen', itemType:'Character' },
      { name:'Furina', itemType:'Character' },
      { name:'Mona', itemType:'Character' },
      { name:'Xilonen', itemType:'Character' },
      { name:'Charlotte', itemType:'Character' },
    ],
  },
});

const suggestions = suggestTeamSubstitutions(
  base,
  flex,
  ownership,
  {},
  'Lohen',
  [],
  6,
);
const esco = suggestions.find((entry) => entry.member.name === 'Escoffier');
assert(esco, 'Expected Escoffier blocker');
assert.equal(esco.candidates[0].name, 'Xilonen');
assert.equal(esco.candidates[0].status.state, 'verified');
assert.match(esco.candidates[0].evidence[0], /Icy Veins/i);
assert(esco.candidates.some((candidate) => candidate.name === 'Charlotte'));

console.log('Cross-source flex replacement tests passed');
