// Account optimizer helpers. Imported history is evidence of ownership, never proof of
// non-ownership; manual roster corrections can fill gaps in time-limited wish history.

import { canonicalCharacterName } from './build-catalog.js';

function clean(value) { return String(value ?? '').trim(); }
function isCharacterPull(pull) { return /character/i.test(clean(pull?.itemType)); }
function isWeaponPull(pull) { return /weapon/i.test(clean(pull?.itemType)); }

export function analyzeGenshinOwnership(data = {}) {
  const characters = new Map();
  const weapons = new Map();
  let characterPulls = 0;
  let weaponPulls = 0;
  let typedPulls = 0;

  for (const pulls of Object.values(data?.genshin || {})) {
    for (const pull of pulls || []) {
      const rawName = clean(pull?.name);
      if (!rawName) continue;
      if (isCharacterPull(pull)) {
        typedPulls++;
        characterPulls++;
        const name = canonicalCharacterName(rawName);
        characters.set(name, (characters.get(name) || 0) + 1);
      } else if (isWeaponPull(pull)) {
        typedPulls++;
        weaponPulls++;
        weapons.set(rawName, (weapons.get(rawName) || 0) + 1);
      }
    }
  }
  return { characters, weapons, characterPulls, weaponPulls, typedPulls, hasTypedHistory: typedPulls > 0 };
}

export function characterHistoryStatus(name, ownership, minimumConstellation = 0, overrides = {}) {
  const canonical = canonicalCharacterName(name);
  const required = Math.max(0, Number(minimumConstellation || 0));
  const manual = Object.prototype.hasOwnProperty.call(overrides || {}, canonical) ? Number(overrides[canonical]) : null;

  if (manual === -1) {
    return { state: 'unowned', source: 'manual', copies: 0, constellation: null, requirementMet: false, label: 'Marked not owned' };
  }
  if (Number.isInteger(manual) && manual >= 0 && manual <= 6) {
    const met = manual >= required;
    return {
      state: met ? 'verified' : 'short', source: 'manual', copies: manual + 1, constellation: manual, requirementMet: met,
      label: met ? `Roster C${manual}` : `Roster C${manual} · C${required} required`,
    };
  }

  // The Traveler is account-owned by definition and does not appear in wish history.
  // Treat each elemental form as at least C0; higher constellation requirements still
  // need an explicit roster correction because free constellation unlocks vary by progress.
  if (/^(Traveler \(|Cryo Traveler$)/.test(canonical)) {
    const met = required <= 0;
    return { state: met ? 'verified' : 'short', source: 'free', copies: 1, constellation: 0, requirementMet: met, label: met ? 'Free Traveler · C0+' : `Free Traveler · C0+ · C${required} required` };
  }

  const copies = ownership?.characters?.get(canonical) || 0;
  if (!copies) return { state: 'unknown', source: 'history', copies: 0, constellation: null, requirementMet: false, label: 'Ownership unknown' };
  const constellation = Math.min(6, Math.max(0, copies - 1));
  const met = constellation >= required;
  return {
    state: met ? 'verified' : 'short', source: 'history', copies, constellation, requirementMet: met,
    label: met ? `Seen C${constellation}+` : `Seen C${constellation}+ · C${required} required`,
  };
}

export function weaponHistoryStatus(name, ownership) {
  const copies = ownership?.weapons?.get(clean(name)) || 0;
  return { state: copies ? 'verified' : 'unknown', copies, label: copies ? `Seen in history${copies > 1 ? ` ×${copies}` : ''}` : 'Not seen in imported history' };
}

export function teamHistoryStatus(team, ownership, overrides = {}) {
  const members = (team?.members || []).map((member) => ({
    member,
    status: characterHistoryStatus(member.name, ownership, member.minConstellation || 0, overrides),
  }));
  const counts = { verified: 0, short: 0, unknown: 0, unowned: 0 };
  for (const entry of members) counts[entry.status.state] = (counts[entry.status.state] || 0) + 1;
  return {
    members, ...counts,
    fullyVerified: members.length > 0 && counts.verified === members.length,
    blockers: members.filter((entry) => entry.status.state !== 'verified'),
  };
}

function strength(team) {
  if (Number.isFinite(Number(team?.dps))) return { numeric: 1, value: Number(team.dps) };
  const tierScores = { SS: 600, 'S+': 560, S: 520, 'A+': 460, A: 420, 'B+': 360, B: 320, C: 240, GUIDE: 200 };
  return { numeric: 0, value: (tierScores[String(team?.tier || '').toUpperCase()] || 200) - Number(team?.rank || 999) };
}

export function rankBuildableTeams(teams = [], ownership, overrides = {}) {
  return teams
    .map((team) => ({ team, account: teamHistoryStatus(team, ownership, overrides) }))
    .filter((entry) => entry.account.fullyVerified)
    .sort((a, b) => {
      const sa = strength(a.team), sb = strength(b.team);
      return sb.numeric - sa.numeric || sb.value - sa.value || Number(a.team.rank || 999) - Number(b.team.rank || 999);
    });
}

export function rankClosestTeams(teams = [], ownership, overrides = {}, limit = 4) {
  return teams
    .map((team) => ({ team, account: teamHistoryStatus(team, ownership, overrides) }))
    .filter((entry) => !entry.account.fullyVerified)
    .sort((a, b) => {
      const blockerDiff = a.account.blockers.length - b.account.blockers.length;
      if (blockerDiff) return blockerDiff;
      const sa = strength(a.team), sb = strength(b.team);
      return sb.numeric - sa.numeric || sb.value - sa.value || Number(a.team.rank || 999) - Number(b.team.rank || 999);
    })
    .slice(0, limit);
}
