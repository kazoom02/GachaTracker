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


function roleKey(role) {
  const value = clean(role).toLowerCase();
  if (!value) return '';
  if (/heal|sustain/.test(value)) return 'sustain';
  if (/shield/.test(value)) return 'shield';
  if (/main dps|on[- ]?field|carry|driver|core\s*\/\s*dps/.test(value)) return 'main-dps';
  if (/sub dps|off[- ]?field/.test(value)) return 'sub-dps';
  if (/support|buffer|buff|debuff|battery|enabler|teammate/.test(value)) return 'support';
  if (/\bdps\b/.test(value)) return 'dps';
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sourceStrengthBonus(team) {
  if (Number.isFinite(Number(team?.dps))) {
    const dps = Math.max(0, Number(team.dps));
    return Math.min(80, dps / 5000);
  }
  const tierScores = { SS: 45, 'S+': 40, S: 36, 'A+': 30, A: 26, 'B+': 20, B: 16, C: 10, GUIDE: 12, BEST: 42 };
  return (tierScores[String(team?.tier || '').toUpperCase()] || 12) + Math.max(0, 14 - Number(team?.rank || 14));
}

function canonicalTeamMembers(team) {
  return (team?.members || []).map((member) => ({ ...member, canonical: canonicalCharacterName(member.name) }));
}

/**
 * Suggest source-backed replacements for blocked team members.
 *
 * Priority:
 * 1. A character the active roster can already satisfy.
 * 2. A direct "same core, one slot changed" swap from another ranked team.
 * 3. Same functional role in another ranked team.
 * 4. Same team slot in another ranked team.
 * 5. Guide-backed variants that preserve most of the current core.
 *
 * Missing focus characters are intentionally not replaced: the build page is about that
 * character, so replacing them would turn the recommendation into a different guide.
 */
export function suggestTeamSubstitutions(
  team,
  allTeams = [],
  ownership,
  overrides = {},
  focusName = '',
  variants = [],
  limitPerMember = 3,
) {
  const account = teamHistoryStatus(team, ownership, overrides);
  const baseMembers = canonicalTeamMembers(team);
  const baseNames = new Set(baseMembers.map((member) => member.canonical));
  const focus = canonicalCharacterName(focusName);
  const output = [];

  for (const blocker of account.blockers) {
    const missing = canonicalCharacterName(blocker.member.name);
    if (missing === focus) {
      output.push({
        member: blocker.member,
        status: blocker.status,
        coreCharacter: true,
        candidates: [],
      });
      continue;
    }

    const targetIndex = baseMembers.findIndex((member) => member.canonical === missing);
    const targetRole = roleKey(blocker.member.role);
    const candidates = new Map();

    function addCandidate(rawMember, evidence = {}) {
      if (!rawMember?.name) return;
      const canonical = canonicalCharacterName(rawMember.name);
      if (!canonical || canonical === missing || canonical === focus || baseNames.has(canonical)) return;

      const minimumConstellation = Math.max(0, Number(rawMember.minConstellation || 0));
      const status = characterHistoryStatus(canonical, ownership, minimumConstellation, overrides);
      if (status.state === 'unowned') return;

      const existing = candidates.get(canonical) || {
        name: canonical,
        role: rawMember.role || '',
        minConstellation: minimumConstellation,
        status,
        score: 0,
        evidence: new Set(),
        bestSourceRank: 999,
      };

      // If the same candidate appears with different requirements, prefer the least
      // restrictive source-backed requirement for an actual substitution suggestion.
      if (minimumConstellation < existing.minConstellation) {
        existing.minConstellation = minimumConstellation;
        existing.status = characterHistoryStatus(canonical, ownership, minimumConstellation, overrides);
      }
      if (!existing.role && rawMember.role) existing.role = rawMember.role;

      if (evidence.directCore) {
        existing.score += 190;
        existing.evidence.add('Direct guide swap');
      }
      if (evidence.roleMatch) {
        existing.score += 95;
        existing.evidence.add('Same role');
      }
      if (evidence.sameSlot) {
        existing.score += 45;
        existing.evidence.add('Same team slot');
      }
      if (evidence.variant) {
        existing.score += 80;
        existing.evidence.add('Guide-backed variant');
      }
      if (evidence.team) {
        existing.score += sourceStrengthBonus(evidence.team);
        existing.bestSourceRank = Math.min(existing.bestSourceRank, Number(evidence.team.rank || 999));
      }

      // Roster-aware ordering is intentionally dominant.
      if (existing.status.state === 'verified') existing.score += 1000;
      else if (existing.status.state === 'short') existing.score += 160;
      else if (existing.status.state === 'unknown') existing.score += 20;

      candidates.set(canonical, existing);
    }

    for (const otherTeam of allTeams || []) {
      if (!otherTeam || otherTeam === team) continue;
      const otherMembers = canonicalTeamMembers(otherTeam);
      const otherNames = new Set(otherMembers.map((member) => member.canonical));
      if (focus && !otherNames.has(focus)) continue;

      let retained = 0;
      for (const base of baseMembers) {
        if (base.canonical === missing) continue;
        if (otherNames.has(base.canonical)) retained++;
      }
      // A four-character team retaining at least two of the other three members is a
      // meaningful direct-core swap. This remains useful when source pages reorder slots.
      const directCore = retained >= Math.max(2, baseMembers.length - 2);

      otherMembers.forEach((candidate, index) => {
        if (baseNames.has(candidate.canonical)) return;
        const candidateRole = roleKey(candidate.role);
        const roleMatch = Boolean(targetRole && candidateRole && targetRole === candidateRole);
        const sameSlot = index === targetIndex;
        if (!directCore && !roleMatch && !sameSlot) return;
        addCandidate(candidate, { directCore, roleMatch, sameSlot, team: otherTeam });
      });
    }

    // Variants do not always carry explicit roles, but an almost-identical core is still
    // meaningful source evidence for a swap.
    for (const variant of variants || []) {
      const variantNames = (variant?.members || []).map((name) => canonicalCharacterName(name));
      if (!variantNames.length || (focus && !variantNames.includes(focus))) continue;
      let retained = 0;
      for (const base of baseMembers) {
        if (base.canonical === missing) continue;
        if (variantNames.includes(base.canonical)) retained++;
      }
      if (retained < Math.max(2, baseMembers.length - 2)) continue;
      for (const name of variantNames) {
        if (baseNames.has(name) || name === focus) continue;
        addCandidate({ name, role: '', minConstellation: 0 }, { directCore: true, variant: true });
      }
    }

    const ranked = [...candidates.values()]
      .sort((a, b) => {
        const stateScore = (state) => ({ verified: 4, short: 3, unknown: 2, unowned: 0 }[state] || 0);
        return stateScore(b.status.state) - stateScore(a.status.state)
          || b.score - a.score
          || a.bestSourceRank - b.bestSourceRank
          || a.name.localeCompare(b.name);
      })
      .slice(0, Math.max(1, Number(limitPerMember || 3)))
      .map((candidate) => ({
        ...candidate,
        evidence: [...candidate.evidence],
      }));

    output.push({
      member: blocker.member,
      status: blocker.status,
      coreCharacter: false,
      candidates: ranked,
    });
  }

  return output;
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
