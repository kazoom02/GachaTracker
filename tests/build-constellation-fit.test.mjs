import assert from 'node:assert/strict';
import { crossSourceFlexTeams } from '../public/js/build-flex-data.js';
import {
  analyzeGenshinOwnership,
  rankBuildableTeams,
  suggestTeamSubstitutions,
} from '../public/js/build-account.js';

const base = {
  rank: 2,
  name:'Freeze',
  reaction:'Freeze',
  members:[
    {name:'Lohen'}, {name:'Furina'}, {name:'Mona'}, {name:'Escoffier'},
  ],
};
const flex = crossSourceFlexTeams('lohen');

function history(entries) {
  return analyzeGenshinOwnership({
    genshin:{ character: entries.flatMap(([name, copies]) =>
      Array.from({length:copies}, () => ({name, itemType:'Character'}))
    )},
  });
}

// Xilonen C2 should expose her Cryo +60% CRIT DMG breakpoint.
const ownXilonenC2 = history([
  ['Lohen',1], ['Furina',1], ['Mona',1], ['Xilonen',3], ['Charlotte',1],
]);
const suggestions = suggestTeamSubstitutions(base, flex, ownXilonenC2, {}, 'Lohen', [], 8);
const esco = suggestions.find((row) => row.member.name === 'Escoffier');
const xilonen = esco.candidates.find((row) => row.name === 'Xilonen');
assert.equal(xilonen.status.constellation, 2);
assert(xilonen.constellationFit.active.some((bp) => bp.constellation === 2));
assert.match(xilonen.constellationFit.active.at(-1).note, /60% CRIT DMG/i);

// Charlotte C1 should gain a Furina-specific breakpoint; C0 should not.
const ownCharlotteC1 = history([
  ['Lohen',1], ['Furina',1], ['Mona',1], ['Charlotte',2], ['Mika',1],
]);
const suggestions2 = suggestTeamSubstitutions(base, flex, ownCharlotteC1, {}, 'Lohen', [], 8);
const esco2 = suggestions2.find((row) => row.member.name === 'Escoffier');
const charlotte = esco2.candidates.find((row) => row.name === 'Charlotte');
assert.equal(charlotte.status.constellation, 1);
assert(charlotte.constellationFit.active.some((bp) => bp.constellation === 1));
assert.match(charlotte.constellationFit.active.at(-1).note, /Furina/i);

// Qualitative flex ranking can use relevant constellation fit.
// Numeric simulations remain separately DPS-ranked by the optimizer.
const playable = flex.filter((team) =>
  team.members.some((member) => member.name === 'Charlotte') ||
  team.members.some((member) => member.name === 'Mika')
);
const ranked = rankBuildableTeams(playable, ownCharlotteC1, {});
assert.equal(ranked[0].team.members.some((member) => member.name === 'Charlotte'), true);

console.log('Constellation-aware replacement ranking tests passed');
