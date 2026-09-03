// Account-specific theorycraft generator.
// This module only builds teams from explicit, source-backed flex-slot rules.
// It never invents DPS values and it only selects characters verified on the active roster.

import { canonicalCharacterName } from './build-catalog.js';
import { characterHistoryStatus } from './build-account.js';

export const HEXEREI_CHARACTERS = new Set([
  'Venti', 'Klee', 'Albedo', 'Sucrose', 'Fischl', 'Razor', 'Durin', 'Mona', 'Varka',
]);

function teamKey(members = []) {
  return members.map((member) => canonicalCharacterName(member.name || member)).sort().join('|');
}

function candidateScore(candidate, status) {
  let score = Number(candidate.score || 0);
  for (const bonus of candidate.constellationBonuses || []) {
    if (Number(status.constellation ?? -1) >= Number(bonus.constellation || 0)) score += Number(bonus.score || 0);
  }
  return score;
}

function constellationNotes(candidate, status) {
  const notes = [];
  for (const bonus of candidate.constellationBonuses || []) {
    if (Number(status.constellation ?? -1) >= Number(bonus.constellation || 0) && bonus.note) notes.push(bonus.note);
  }
  return notes;
}

function recurseSlots(slots, index, current, names, score, notes, results, ownership, overrides) {
  if (index >= slots.length) {
    results.push({ members: current.map((member) => ({ ...member, tags: [...(member.tags || [])] })), score, notes: [...notes] });
    return;
  }

  const slot = slots[index];
  const candidates = slot.fixed
    ? [{ name: slot.fixed, role: slot.role || '', score: Number(slot.score || 0), note: slot.note || '', tags: slot.tags || [] }]
    : (slot.candidates || []);

  for (const raw of candidates) {
    const name = canonicalCharacterName(raw.name);
    if (!name || names.has(name)) continue;
    const status = characterHistoryStatus(name, ownership, raw.minConstellation || 0, overrides);
    if (status.state !== 'verified') continue;

    const member = {
      name,
      role: raw.role || slot.role || slot.label || '',
      minConstellation: Number(raw.minConstellation || 0),
      theorycraftSlot: slot.label || slot.key || '',
      theorycraftNote: raw.note || '',
      tags: [...new Set([...(slot.tags || []), ...(raw.tags || [])])],
    };
    const nextNotes = [...notes];
    if (raw.note) nextNotes.push(`${name}: ${raw.note}`);
    nextNotes.push(...constellationNotes(raw, status).map((note) => `${name}: ${note}`));

    names.add(name);
    current.push(member);
    recurseSlots(
      slots, index + 1, current, names,
      score + candidateScore(raw, status), nextNotes, results, ownership, overrides,
    );
    current.pop();
    names.delete(name);
  }
}

function enrichSynergy(row, archetype) {
  const names = row.members.map((member) => canonicalCharacterName(member.name));
  const notes = [...row.notes];
  let score = row.score + Number(archetype.baseScore || 0);

  const hexerei = names.filter((name) => HEXEREI_CHARACTERS.has(name));
  if (hexerei.length >= 2) {
    score += 5;
    notes.push(`Hexerei: Secret Rite active (${hexerei.join(' + ')}), assuming their Witch's Homework is completed.`);
  } else if (hexerei.includes('Fischl')) {
    notes.push('Fischl supplies off-field Electro here, but Fischl alone does not activate Hexerei: Secret Rite; that requires a second Hexerei character.');
  }

  if (names.includes('Diona')) {
    notes.push("Diona is the Cryo sustain/Stellar-Conduct flex here. Her Witch's Revelation passive is assumed unlocked; C6 greatly improves her Stellar-Conduct buffing.");
  }
  if (names.includes('Qiqi')) {
    notes.push("Qiqi is the higher-ceiling Cryo sustain option in current Odette guidance when her Witch's Revelation is unlocked.");
  }
  if (names.includes('Fischl')) {
    notes.push('Fischl is a lower-damage Yae alternative: reliable off-field Electro, but she does not reproduce Yae Miko’s personal Stellar-Conduct damage/buffs.');
  }
  if (names.includes('Beidou')) {
    notes.push('Beidou is a viable Yae alternative with defensive utility; current guidance values her more at C6 but notes higher Energy needs.');
  }
  if (names.includes('Alyosha')) {
    notes.push('Alyosha can sustain the Electro application slot; his personal damage ceiling is lower than Yae Miko’s and improves notably with constellations.');
  }

  for (const note of archetype.notes || []) notes.push(note);
  return { ...row, score, notes: [...new Set(notes)] };
}

export function generateAccountTheorycrafts(character, ownership, overrides = {}, reaction = 'all', existingTeams = [], limit = 6) {
  const rules = character?.theorycraft?.archetypes || [];
  if (!rules.length) return [];

  const existing = new Set((existingTeams || []).map((team) => teamKey(team.members || [])));
  const generated = [];

  for (const archetype of rules) {
    if (reaction !== 'all' && archetype.reaction !== reaction) continue;
    const rows = [];
    recurseSlots(archetype.slots || [], 0, [], new Set(), 0, [], rows, ownership, overrides);

    for (const base of rows) {
      const row = enrichSynergy(base, archetype);
      const key = teamKey(row.members);
      if (!key || existing.has(key)) continue;
      generated.push({
        rank: 900,
        name: archetype.nameTemplate
          ? archetype.nameTemplate.replace('{carry}', row.members[0]?.name || 'Flexible')
          : archetype.name || `${archetype.reaction} account theorycraft`,
        reaction: archetype.reaction || 'General',
        tier: 'Theorycraft',
        isTheorycraft: true,
        theorycraftScore: row.score,
        note: archetype.summary || 'Guide-supported flex-slot team assembled from characters verified on your active profile.',
        members: row.members,
        theorycraftNotes: row.notes,
        theorycraftSources: archetype.sources || [],
      });
    }
  }

  const unique = new Map();
  for (const team of generated) {
    const key = teamKey(team.members);
    const previous = unique.get(key);
    if (!previous || Number(team.theorycraftScore) > Number(previous.theorycraftScore)) unique.set(key, team);
  }

  return [...unique.values()]
    .sort((a, b) => Number(b.theorycraftScore || 0) - Number(a.theorycraftScore || 0) || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Number(limit || 6)))
    .map((team, index) => ({ ...team, rank: index + 1 }));
}
