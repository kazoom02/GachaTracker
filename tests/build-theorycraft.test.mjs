import assert from 'node:assert/strict';
import { getBuildCharacter } from '../public/js/build-data.js';
import { analyzeGenshinOwnership } from '../public/js/build-account.js';
import { generateAccountTheorycrafts } from '../public/js/build-theorycraft.js';

function ownershipFor(names) {
  return analyzeGenshinOwnership({
    genshin: {
      character: names.map((name) => ({ name, itemType: 'Character' })),
    },
  });
}

const odette = getBuildCharacter('odette');

// Budget Conduct shell: the user's proposed logic should be possible.
// Traveler is free and therefore does not need to appear in wish history.
const budget = generateAccountTheorycrafts(
  odette,
  ownershipFor(['Odette', 'Diona', 'Fischl']),
  {},
  'Stellar-Conduct',
  [],
  10,
);
const dionaFischl = budget.find((team) => {
  const names = team.members.map((member) => member.name);
  return names.includes('Cryo Traveler') && names.includes('Odette') && names.includes('Diona') && names.includes('Fischl');
});
assert.ok(dionaFischl, 'Expected Cryo Traveler / Odette / Fischl / Diona account theorycraft');
assert.equal(dionaFischl.isTheorycraft, true);
assert.ok(dionaFischl.theorycraftNotes.some((note) => /lower-damage Yae alternative/i.test(note)));
assert.ok(dionaFischl.theorycraftNotes.some((note) => /does not activate Hexerei: Secret Rite/i.test(note)));
assert.ok(dionaFischl.theorycraftNotes.some((note) => /Witch's Revelation/i.test(note)));

// Source-backed Stellar-Swirl shell should also be found at C0 rather than requiring
// the C2/C6 assumptions from the separate published-DPS sheet.
const swirl = generateAccountTheorycrafts(
  odette,
  ownershipFor(['Odette', 'Yumemizuki Mizuki', 'Sucrose']),
  {},
  'Stellar-Swirl',
  [],
  10,
);
const mizuki = swirl.find((team) => {
  const names = team.members.map((member) => member.name);
  return names.includes('Yumemizuki Mizuki') && names.includes('Cryo Traveler') && names.includes('Sucrose') && names.includes('Odette');
});
assert.ok(mizuki, 'Expected Mizuki / Odette / Cryo Traveler / Sucrose theorycraft at owned C0+');

// Manual "not owned" must prevent a candidate from being selected.
const blocked = generateAccountTheorycrafts(
  odette,
  ownershipFor(['Odette', 'Diona', 'Fischl']),
  { Fischl: -1 },
  'Stellar-Conduct',
  [],
  20,
);
assert.ok(blocked.every((team) => !team.members.some((member) => member.name === 'Fischl')));

console.log('Account theorycraft tests passed');
