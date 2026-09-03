const SIMPACT_API = 'https://simpact.app/api/db';
const GCSIM_NAMES_URL = 'https://raw.githubusercontent.com/genshinsim/gcsim/main/ui/packages/localization/src/locales/names.dm.json';
const GCSIM_WEAPONS_URL = 'https://raw.githubusercontent.com/genshinsim/gcsim/main/ui/packages/ui/src/Data/weapon.dm.json';
const REQUEST_TIMEOUT_MS = 6500;
const MAX_DB_ENTRIES = 150;
const DB_SCAN_PAGES = 3;
const REF_CACHE_MS = 6 * 60 * 60 * 1000;
let refCache = null;

const FOUR_STAR_KEYS = new Set([
  'aino','alyosha','amber','barbara','beidou','bennett','candace','charlotte','chevreuse','chongyun','collei',
  'dahlia','diona','dori','faruzan','fischl','freminet','gaming','gorou','heizou','iansan','ifa','illuga','jahoda',
  'kachina','kaeya','kaveh','kirara','kuki','lanyan','layla','lisa','lynette','mika','ningguang','noelle','ororon',
  'prune','razor','rosaria','sara','sayu','sethos','sucrose','thoma','xiangling','xingqiu','xinyan','yanfei','yaoyao','yunjin'
]);

function safeToken(value, pattern, fallback = '') {
  const raw = String(value || '').trim();
  return pattern.test(raw) ? raw : fallback;
}

function isTravelerKey(key) {
  return /^(aether|lumine)(anemo|dendro|electro|geo|hydro|pyro|cryo)$/.test(String(key || '').toLowerCase());
}

function charRarity(key) {
  const clean = String(key || '').toLowerCase();
  if (isTravelerKey(clean)) return 5;
  return FOUR_STAR_KEYS.has(clean) ? 4 : 5;
}

function displayFallback(key) {
  const spaced = String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced ? spaced.replace(/\b\w/g, (m) => m.toUpperCase()) : 'Unknown';
}

async function fetchJson(url, fetchImpl = global.fetch, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ConveneBuilds/1.0; +https://github.com/kazoom02/GachaTracker)',
        'Accept': 'application/json,text/plain,*/*',
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildSimpactQuery(keys = [], skip = 0) {
  const normalized = [...new Set(keys.map((key) => String(key || '').trim().toLowerCase()).filter(Boolean))];
  const charClause = normalized.length === 1
    ? { 'summary.char_names': normalized[0] }
    : { $or: normalized.map((key) => ({ 'summary.char_names': key })) };
  return {
    query: {
      $and: [
        charClause,
        { accepted_tags: { $in: [1] } },
        { is_db_valid: true },
        { 'summary.target_count': 1 },
      ],
    },
    project: {
      config: 1,
      description: 1,
      accepted_tags: 1,
      rejected_tags: 1,
      is_db_valid: 1,
      share_key: 1,
      create_date: 1,
      last_update: 1,
      summary: 1,
    },
    limit: MAX_DB_ENTRIES,
    skip: Math.max(0, Number(skip || 0)),
    sort: { 'summary.mean_dps_per_target': -1 },
  };
}

function parseConfigAssumptions(config = '', summary = {}, acceptedTags = []) {
  const text = String(config || '');
  const iteration = Number(text.match(/\biteration\s*=\s*(\d+)/i)?.[1] || 0);
  const targetLevel = Number(text.match(/\btarget\s+lvl\s*=\s*(\d+)/i)?.[1] || 0);
  const resist = Number(text.match(/\bresist\s*=\s*([0-9.]+)/i)?.[1] ?? NaN);
  const durationMean = Number(summary?.sim_duration?.mean || 0);
  const randomDelays = acceptedTags.includes(6) || /\brandnorm\s*\(|\brand_delay\s*\(/i.test(text);
  const energyStandard = /energy\s+every\s+interval\s*=\s*480\s*,\s*720\s+amount\s*=\s*1/i.test(text);
  const targetStandard = targetLevel === 100 && Number.isFinite(resist) && Math.abs(resist - 0.1) <= 0.001;
  const enoughIterations = iteration >= 1000;
  const longRotation = durationMean >= 90;
  const mediumRotation = durationMean >= 60;

  let quality = 'Validated gcsim';
  let qualityRank = 1;
  if (targetStandard && enoughIterations && mediumRotation) {
    quality = 'Comparable gcsim';
    qualityRank = 2;
  }
  if (targetStandard && enoughIterations && longRotation && randomDelays && energyStandard) {
    quality = 'KQMS-like';
    qualityRank = 3;
  }

  return {
    iteration,
    targetLevel,
    resist: Number.isFinite(resist) ? resist : null,
    durationMean,
    randomDelays,
    energyStandard,
    targetStandard,
    quality,
    qualityRank,
  };
}

function normalizeReferences(namesPayload, weaponPayload) {
  const english = namesPayload?.English || {};
  return {
    characterNames: english.character_names || {},
    weaponNames: english.weapon_names || {},
    artifactNames: english.artifact_names || {},
    weaponData: weaponPayload?.data || weaponPayload || {},
  };
}

function investmentFor(team, focusKeys, refs) {
  const focusSet = new Set((focusKeys || []).map((key) => String(key).toLowerCase()));
  let fiveStarCharacters = 0;
  let nonFocusFiveStars = 0;
  let fiveStarConstellations = 0;
  let fiveStarWeapons = 0;
  let unknownWeaponRarity = false;

  for (const member of team) {
    const rarity = member.rarity;
    const isFocus = focusSet.has(String(member.key || '').toLowerCase());
    if (rarity === 5 && !member.isTraveler) {
      fiveStarCharacters++;
      if (!isFocus) nonFocusFiveStars++;
      if (member.constellation > 0) fiveStarConstellations++;
    }
    const weaponRarity = refs.weaponData?.[member.weaponKey]?.rarity;
    if (weaponRarity === 5) fiveStarWeapons++;
    if (!weaponRarity) unknownWeaponRarity = true;
  }

  const fiveStarsAtC0 = team.every((member) => member.rarity !== 5 || member.isTraveler || member.constellation === 0);
  const noFiveStarWeapons = !unknownWeaponRarity && fiveStarWeapons === 0;
  const f2pGear = fiveStarsAtC0 && noFiveStarWeapons;
  const budgetRoster = f2pGear && nonFocusFiveStars <= 1;
  const fourStarSupports = f2pGear && team.every((member) => {
    const isFocus = focusSet.has(String(member.key || '').toLowerCase());
    return isFocus || member.rarity === 4 || member.isTraveler;
  });

  const supportConstellations = supportConstellationSummary(team, focusKeys);
  const maxFourStarConstellation = maxFourStarSupportConstellation(team, focusKeys);
  const lowConstFourStarSupports = fourStarSupports && maxFourStarConstellation <= 2;
  const midConstFourStarSupports = fourStarSupports && maxFourStarConstellation <= 4;

  return {
    f2pGear,
    budgetRoster,
    fourStarSupports,
    lowConstFourStarSupports,
    midConstFourStarSupports,
    supportConstellations,
    maxFourStarConstellation,
    fiveStarCharacters,
    nonFocusFiveStars,
    fiveStarConstellations,
    fiveStarWeapons,
    unknownWeaponRarity,
  };
}

function normalizeEntry(entry, focusKeys, refs) {
  const summary = entry?.summary || {};
  const dps = Number(summary.mean_dps_per_target || 0);
  if (!Number.isFinite(dps) || dps <= 0) return null;
  const rawTeam = Array.isArray(summary.team) ? summary.team : [];
  if (rawTeam.length !== 4) return null;

  const team = rawTeam.map((raw) => {
    const key = String(raw?.name || '').toLowerCase();
    const weaponKey = String(raw?.weapon?.name || '').toLowerCase();
    const weaponMeta = refs.weaponData?.[weaponKey] || {};
    const sets = Object.entries(raw?.sets || {}).filter(([, count]) => Number(count) > 0).map(([setKey, count]) => ({
      key: setKey,
      name: refs.artifactNames?.[setKey] || displayFallback(setKey),
      count: Number(count),
    }));
    return {
      key,
      name: refs.characterNames?.[key] || displayFallback(key),
      rarity: charRarity(key),
      isTraveler: isTravelerKey(key),
      constellation: Number(raw?.cons || 0),
      level: Number(raw?.level || 0),
      maxLevel: Number(raw?.max_level || 0),
      weaponKey,
      weapon: refs.weaponNames?.[weaponKey] || displayFallback(weaponKey),
      weaponRarity: Number(weaponMeta?.rarity || 0) || null,
      refinement: Number(raw?.weapon?.refine || 0),
      weaponLevel: Number(raw?.weapon?.level || 0),
      talents: {
        attack: Number(raw?.talents?.attack || 0),
        skill: Number(raw?.talents?.skill || 0),
        burst: Number(raw?.talents?.burst || 0),
      },
      sets,
    };
  });

  const assumptions = parseConfigAssumptions(entry.config, summary, entry.accepted_tags || []);
  const investment = investmentFor(team, focusKeys, refs);
  return {
    id: String(entry._id || entry.share_key || ''),
    shareKey: String(entry.share_key || ''),
    url: entry.share_key ? `https://gcsim.app/sh/${encodeURIComponent(entry.share_key)}` : 'https://simpact.app/database',
    dps,
    targetCount: Number(summary.target_count || 1),
    description: String(entry.description || '').trim(),
    createdAt: Number(entry.create_date || 0),
    updatedAt: Number(entry.last_update || 0),
    acceptedTags: entry.accepted_tags || [],
    quality: assumptions.quality,
    qualityRank: assumptions.qualityRank,
    assumptions,
    investment,
    team,
  };
}

function signature(sim) {
  return sim.team.map((member) => `${member.key}:c${member.constellation}:${member.weaponKey}:r${member.refinement}`).sort().join('|');
}

function dedupeAndRank(rows) {
  const best = new Map();
  for (const row of rows) {
    const key = signature(row);
    const current = best.get(key);
    if (!current || row.qualityRank > current.qualityRank || (row.qualityRank === current.qualityRank && row.dps > current.dps)) {
      best.set(key, row);
    }
  }
  return [...best.values()].sort((a, b) =>
    b.qualityRank - a.qualityRank ||
    b.dps - a.dps ||
    b.updatedAt - a.updatedAt
  );
}

function topBy(rows, predicate, limit = 12) {
  return rows.filter(predicate).slice(0, limit);
}


async function loadReferenceData(fetchImpl = global.fetch) {
  const now = Date.now();
  if (refCache && now - refCache.savedAt < REF_CACHE_MS) return refCache.refs;

  const [namesResult, weaponResult] = await Promise.allSettled([
    fetchJson(GCSIM_NAMES_URL, fetchImpl, 4500),
    fetchJson(GCSIM_WEAPONS_URL, fetchImpl, 4500),
  ]);
  const refs = normalizeReferences(
    namesResult.status === 'fulfilled' ? namesResult.value : {},
    weaponResult.status === 'fulfilled' ? weaponResult.value : {},
  );
  refCache = { savedAt: now, refs };
  return refs;
}

function supportConstellationSummary(team, focusKeys) {
  const focusSet = new Set((focusKeys || []).map((key) => String(key || '').toLowerCase()));
  return team
    .filter((member) => member.rarity === 4 && !focusSet.has(String(member.key || '').toLowerCase()))
    .map((member) => `${member.name} C${member.constellation}`);
}

function maxFourStarSupportConstellation(team, focusKeys) {
  const focusSet = new Set((focusKeys || []).map((key) => String(key || '').toLowerCase()));
  const values = team
    .filter((member) => member.rarity === 4 && !focusSet.has(String(member.key || '').toLowerCase()))
    .map((member) => Number(member.constellation || 0));
  return values.length ? Math.max(...values) : 0;
}

async function getSimulationTeams(query, fetchImpl = global.fetch) {
  const id = safeToken(query.id, /^[a-z0-9-]{1,80}$/i, 'character');
  const name = safeToken(query.name, /^[\p{L}\p{N} .()'’:-]{1,80}$/u, '') || 'Character';
  const focusKeys = String(query.gcsimKeys || '')
    .split(',')
    .map((key) => safeToken(key, /^[a-z0-9-]{1,80}$/i, '').toLowerCase())
    .filter(Boolean);
  if (!focusKeys.length) return {
    id, name, live: true, supported: false, teams: [], comparable: [], f2p: [], budget: [], fourStarSupports: [],
    source: { label: 'Simpact / gcsim', url: 'https://simpact.app/database' },
    warning: 'No gcsim character key is configured for this roster entry.',
  };

  const pageQueries = Array.from({ length: DB_SCAN_PAGES }, (_, page) => buildSimpactQuery(focusKeys, page * MAX_DB_ENTRIES));
  const pageUrls = pageQueries.map((dbQuery) => `${SIMPACT_API}?q=${encodeURIComponent(JSON.stringify(dbQuery))}`);
  const [pageResults, refs] = await Promise.all([
    Promise.allSettled(pageUrls.map((url) => fetchJson(url, fetchImpl))),
    loadReferenceData(fetchImpl),
  ]);

  const successfulPages = pageResults.filter((result) => result.status === 'fulfilled');
  if (!successfulPages.length) {
    const firstError = pageResults.find((result) => result.status === 'rejected');
    throw new Error(`Simpact database unavailable: ${firstError?.reason?.message || firstError?.reason || 'no pages returned'}`);
  }

  const rawRows = successfulPages.flatMap((result) => Array.isArray(result.value?.data) ? result.value.data : []);
  const normalized = dedupeAndRank(rawRows.map((entry) => normalizeEntry(entry, focusKeys, refs)).filter(Boolean));

  const comparable = topBy(normalized, (row) => row.qualityRank >= 2, 20);
  const strict = topBy(normalized, (row) => row.qualityRank >= 3, 20);
  const f2p = topBy(normalized, (row) => row.investment.f2pGear, 24);
  const budget = topBy(normalized, (row) => row.investment.budgetRoster, 24);
  const fourStarSupports = topBy(normalized, (row) => row.investment.fourStarSupports, 24);
  const lowConstFourStarSupports = topBy(normalized, (row) => row.investment.lowConstFourStarSupports, 24);
  const midConstFourStarSupports = topBy(normalized, (row) => row.investment.midConstFourStarSupports, 24);
  const accountCandidates = normalized.slice(0, 120);

  return {
    id,
    name,
    live: true,
    supported: normalized.length > 0,
    fetchedAt: new Date().toISOString(),
    coverage: {
      pagesRequested: DB_SCAN_PAGES,
      pagesLoaded: successfulPages.length,
      fetched: rawRows.length,
      normalized: normalized.length,
      strict: strict.length,
      comparable: comparable.length,
      f2p: f2p.length,
      budget: budget.length,
      fourStarSupports: fourStarSupports.length,
      lowConstFourStarSupports: lowConstFourStarSupports.length,
      midConstFourStarSupports: midConstFourStarSupports.length,
    },
    teams: normalized.slice(0, 32),
    accountCandidates,
    strict,
    comparable,
    f2p,
    budget,
    fourStarSupports,
    lowConstFourStarSupports,
    midConstFourStarSupports,
    source: {
      label: 'Simpact / gcsim database',
      url: 'https://simpact.app/database',
      docs: 'https://docs.gcsim.app/',
    },
    methodology: [
      'DPS is the exact mean DPS/target reported by the linked gcsim database entry; Convene does not recalculate or rescale the number.',
      'Every displayed numeric team preserves the simulation’s exact character constellations, weapon refinements, artifact sets, talents and target assumptions.',
      'KQMS-like rows require a level-100 10% RES target, at least 1000 iterations, at least 90 seconds mean duration, random execution delays, and the KQM-standard clear-particle energy line.',
      'Comparable gcsim rows require the standard level-100 10% RES target, at least 1000 iterations and at least 60 seconds mean duration, but may not satisfy every current KQMS condition.',
      'Validated gcsim rows are useful evidence but are not directly comparable to differently configured simulations. Convene ranks simulation quality before DPS.',
      'F2P Gear means no 5-star weapons and all non-Traveler 5-star characters at C0. Budget Roster additionally allows at most one non-focus 5-star teammate. 4-star support constellations are shown exactly as simulated.',
      '4★ Supports keeps the focus character plus only 4-star/Traveler teammates. Low-Const 4★ further caps every non-focus 4-star at C2; Mid-Const 4★ caps them at C4.',
      'Convene scans multiple DPS-sorted database pages before building F2P/4-star rankings, reducing the chance that whale configs crowd lower-investment teams out of the search window.',
      'A simulated constellation is the exact constellation required to reproduce that DPS number, not automatically the minimum constellation required for the team archetype to function.',
    ],
  };
}

module.exports = {
  buildSimpactQuery,
  parseConfigAssumptions,
  normalizeEntry,
  dedupeAndRank,
  getSimulationTeams,
};
