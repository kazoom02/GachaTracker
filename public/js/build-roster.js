const ROSTER_KEY = 'convene-build-roster-v1';

function loadAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ROSTER_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function saveAll(value) {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(value));
}

export function getRosterOverrides(profileId) {
  const all = loadAll();
  const source = all[String(profileId)] || {};
  const normalized = {};
  for (const [name, value] of Object.entries(source)) {
    const number = Number(value);
    if (number === -1 || (Number.isInteger(number) && number >= 0 && number <= 6)) normalized[name] = number;
  }
  return normalized;
}

export function setRosterOverride(profileId, characterName, value) {
  const all = loadAll();
  const id = String(profileId);
  const name = String(characterName || '').trim();
  if (!name) return;
  all[id] = all[id] || {};
  if (value === '' || value == null || Number.isNaN(Number(value))) delete all[id][name];
  else {
    const number = Number(value);
    if (number !== -1 && (!Number.isInteger(number) || number < 0 || number > 6)) throw new Error('Roster constellation must be -1 or C0-C6.');
    all[id][name] = number;
  }
  if (!Object.keys(all[id]).length) delete all[id];
  saveAll(all);
}

export function clearRosterOverrides(profileId) {
  const all = loadAll();
  delete all[String(profileId)];
  saveAll(all);
}
