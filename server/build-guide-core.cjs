'use strict';

const BUILD_TIMEOUT_MS = 8000;
const ELEMENTS = ['Pyro', 'Hydro', 'Dendro', 'Electro', 'Anemo', 'Cryo', 'Geo'];
const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'];
const ROLE_WORDS = ['Main DPS', 'Sub DPS', 'Support', 'DPS', 'Healer'];

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function htmlToLines(html) {
  const text = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|header|footer|main|li|ul|ol|h[1-6]|tr|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isNumeric(line) { return /^\d+$/.test(String(line || '').trim()); }
function isHeadingNoise(line) { return /^(showcase|teams|talents|passives|constellations|ascension|main stats|substats|weapons|artifacts)$/i.test(line); }

function section(lines, startPattern, endPatterns = []) {
  const start = lines.findIndex((line) => startPattern.test(line));
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (endPatterns.some((pattern) => pattern.test(lines[i]))) { end = i; break; }
  }
  return lines.slice(start + 1, end);
}

function rankedBlocks(lines, maxRank = 5) {
  const results = [];
  let from = 0;
  for (let rank = 1; rank <= maxRank; rank++) {
    let index = -1;
    for (let i = from; i < lines.length; i++) {
      if (lines[i] !== String(rank)) continue;
      const next = lines[i + 1];
      if (next && !isNumeric(next) && !/^#/.test(next) && !isHeadingNoise(next)) { index = i; break; }
    }
    if (index < 0) break;
    let nextIndex = lines.length;
    if (rank < maxRank) {
      for (let i = index + 2; i < lines.length; i++) {
        if (lines[i] !== String(rank + 1)) continue;
        const next = lines[i + 1];
        if (next && !isNumeric(next) && !/^#/.test(next) && !isHeadingNoise(next)) { nextIndex = i; break; }
      }
    }
    results.push({ rank, lines: lines.slice(index + 1, nextIndex) });
    from = nextIndex;
  }
  return results;
}

function parseWeaponBlocks(lines) {
  return rankedBlocks(lines, 8).map(({ rank, lines: block }) => {
    const raw = block.find((line) => !isNumeric(line) && !isHeadingNoise(line));
    if (!raw) return null;
    const ref = raw.match(/\s+(R\d+)$/i);
    return {
      rank,
      name: raw.replace(/\s+R\d+$/i, ''),
      refinement: ref ? ref[1].toUpperCase() : '',
      tier: rank === 1 ? 'Best' : rank <= 3 ? 'Strong alternative' : 'Alternative',
      note: rank === 1 ? 'Top recommendation from the current source build.' : 'Alternative listed by the current source build.',
    };
  }).filter(Boolean);
}

function parseArtifactBlocks(lines) {
  return rankedBlocks(lines, 6).map(({ rank, lines: block }) => {
    const names = [];
    const nums = [];
    for (const line of block) {
      if (isNumeric(line)) nums.push(Number(line));
      else if (!isHeadingNoise(line) && !/^(2-Piece|4-Piece)/i.test(line) && !names.includes(line)) names.push(line);
    }
    if (!names.length) return null;
    const useful = names.slice(0, 2);
    const pieces = useful.length > 1 ? '2+2' : (nums.includes(4) ? 4 : nums.includes(2) ? 2 : 4);
    return {
      rank,
      name: useful.join(' + '),
      pieces,
      label: rank === 1 ? 'Best overall' : 'Alternative',
      note: rank === 1 ? 'Top artifact recommendation from the current source build.' : 'Alternative artifact setup listed by the current source build.',
    };
  }).filter(Boolean);
}

function parseGenshinGG(html, guideName) {
  const lines = htmlToLines(html);
  const titleIndex = lines.findIndex((line) => new RegExp(`Genshin Impact\\s+${escapeRegExp(guideName)}\\s+Build`, 'i').test(line));
  const early = lines.slice(Math.max(0, titleIndex), titleIndex >= 0 ? titleIndex + 18 : 30);
  const element = ELEMENTS.find((item) => early.includes(item)) || '';
  const weaponType = WEAPON_TYPES.find((item) => early.includes(item)) || '';
  const role = ROLE_WORDS.find((item) => early.includes(item)) || '';

  const weaponLines = section(lines, /Best Weapons$/i, [/Best Artifacts$/i]);
  const artifactLines = section(lines, /Best Artifacts$/i, [/Best Stats$/i]);
  const statLines = section(lines, /Best Stats$/i, [/Showcase|Best .* Teams|Talents/i]);
  const weapons = parseWeaponBlocks(weaponLines);
  const artifacts = parseArtifactBlocks(artifactLines);

  const statValue = (label) => {
    const found = statLines.find((line) => new RegExp(`^${label}:`, 'i').test(line));
    return found ? found.replace(new RegExp(`^${label}:\\s*`, 'i'), '') : '';
  };
  const sands = statValue('Sands');
  const goblet = statValue('Goblet');
  const circlet = statValue('Circlet');
  const substats = statValue('Substats');

  return {
    element,
    weaponType,
    role,
    weapons,
    artifacts,
    stats: {
      main: [sands && `Sands: ${sands}`, goblet && `Goblet: ${goblet}`, circlet && `Circlet: ${circlet}`].filter(Boolean),
      sub: substats ? substats.split(/\s*>\s*|\s*\/\s*/).filter(Boolean) : [],
      alternativeCirclet: '',
      notes: [],
    },
    teamArchetypes: section(lines, /^Best .* Teams$/i, [/Talents|Passives|Constellations|Ascension/i]).slice(0, 8),
  };
}

function parseTeamGuide(html, focusName, alternateName = '') {
  const lines = htmlToLines(html);
  let summary = '';
  const titleIndex = lines.findIndex((line) => /Best Team Guide$/i.test(line));
  for (let i = titleIndex + 1; i < Math.min(lines.length, titleIndex + 12); i++) {
    if (/^Best teams for /i.test(lines[i])) { summary = lines[i]; break; }
  }
  const updatedLine = lines.find((line) => /^Last updated /i.test(line)) || '';
  const updatedMatch = updatedLine.match(/^Last updated\s+(.+?)\./i);
  const teams = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/[—–-]/.test(line) || !/\([^)]+\)/.test(line) || !line.includes(',')) continue;
    const split = line.split(/\s+[—–]\s+|\s+-\s+/);
    if (split.length < 2) continue;
    const memberNames = split[0].split(',').map((name) => name.trim()).filter(Boolean);
    if (memberNames.length !== 4) continue;
    if (new Set(memberNames.map((name) => name.toLowerCase())).size !== 4) continue;

    const rhs = split.slice(1).join(' — ');
    const teamName = (rhs.split('.')[0] || '').trim() || `${focusName} Team ${teams.length + 1}`;
    const memberText = memberNames.join(' ');
    const focusMatches = new RegExp(escapeRegExp(focusName), 'i').test(memberText) || (alternateName && new RegExp(escapeRegExp(alternateName), 'i').test(memberText));
    if (!focusMatches && !/Traveler/i.test(focusName)) continue;

    let tier = '';
    let note = '';
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      const tierMatch = lines[j].match(/^Tier\s+(SS|S\+?|A\+?|B\+?|C)$/i);
      if (tierMatch && !tier) tier = tierMatch[1].toUpperCase();
      if (!note && lines[j].length > 50 && !/^#/.test(lines[j]) && !/^Tier /i.test(lines[j])) note = lines[j];
    }

    const members = memberNames.map((name) => {
      const roleMatch = rhs.match(new RegExp(`${escapeRegExp(name)}\\s*\\(([^)]+)\\)`, 'i'));
      return { name, role: roleMatch ? roleMatch[1] : '', minConstellation: 0 };
    });
    const reaction = inferArchetype(teamName, focusName);
    const key = memberNames.map((n) => n.toLowerCase()).join('|');
    if (teams.some((team) => team._key === key)) continue;
    teams.push({
      _key: key,
      rank: teams.length + 1,
      name: teamName,
      reaction,
      tier: tier || 'Guide',
      members,
      dps: null,
      relative: null,
      confidence: 'guide-ranked',
      note: note || 'Ranked team from the current live team guide.',
    });
    if (teams.length >= 12) break;
  }

  return { summary, updated: updatedMatch ? updatedMatch[1] : '', teams: teams.map(({ _key, ...team }) => team) };
}

function inferArchetype(teamName, focusName = '') {
  let text = String(teamName || '').replace(new RegExp(escapeRegExp(focusName), 'ig'), '').replace(/Team|#\d+/gi, ' ').trim();
  const known = ['Stellar-Conduct','Stellar-Swirl','Vaporize','Melt','Freeze','Hyperbloom','Burgeon','Bloom','Aggravate','Spread','Quicken','Overload','Superconduct','Electro-Charged','Burning','Mono Pyro','Mono Hydro','Mono Cryo','Mono Geo','Pure Pyro','Physical','Plunge','Geo'];
  const hit = known.find((key) => new RegExp(escapeRegExp(key.replace('Pure ', '')), 'i').test(text));
  if (hit) return hit;
  text = text.replace(/\s+/g, ' ').trim();
  return text || 'General';
}


const TRAVELER_TEAM_FALLBACKS = {
  'Traveler (Anemo)': {
    source: 'https://keqingmains.com/anemo-traveler/',
    label: 'KQM — Anemo Traveler',
    teams: [
      ['Double Anemo Pyro core','Anemo / Pyro',['Kaedehara Kazuha','Traveler (Anemo)','Xiangling','Bennett'],'KQM lists Kazuha, Traveler, Xiangling and Bennett as one of Anemo Traveler’s strongest example teams.'],
      ['Forward Melt flex','Melt',['Bennett','Chongyun','Traveler (Anemo)','Rosaria'],'Classic Anemo Traveler Forward Melt example; Rosaria fills the flexible Cryo slot.'],
    ],
  },
  'Traveler (Geo)': {
    source: 'https://www.icy-veins.com/genshin-impact/geo-traveler-team-guide',
    label: 'Icy Veins — Geo Traveler Teams (7.0)',
    teams: [
      ['Hexerei Geo','Hexerei',['Traveler (Geo)','Durin','Nicole','Albedo'],'Current 7.0 Hexerei recommendation built around ATK-scaling Geo damage and multiple Hexerei buffs.'],
      ['Hexerei Zhongli','Hexerei',['Traveler (Geo)','Durin','Nicole','Zhongli'],'Current 7.0 Hexerei alternative with Zhongli’s construct synergy and defensive utility.'],
      ['Lunar-Crystallize','Lunar-Crystallize',['Traveler (Geo)','Linnea','Columbina','Zhongli'],'Current 7.0 Lunar-Crystallize option listed by Icy Veins.'],
    ],
  },
  'Traveler (Electro)': {
    source: 'https://keqingmains.com/electro-traveler/',
    label: 'KQM — Electro Traveler',
    teams: [
      ['Beidou battery core','Electro-Charged',['Traveler (Electro)','Beidou','Xingqiu','Sucrose'],'Electro Traveler batteries Beidou; Xingqiu and Sucrose turn the core into an Electro-Charged driver team.'],
      ['Yoimiya Overvape','Overvape',['Yoimiya','Traveler (Electro)','Xingqiu','Bennett'],'Traveler supplies Electro and Energy while Yoimiya triggers Overload and Vaporize.'],
      ['Eula battery','Physical',['Eula','Traveler (Electro)','Rosaria','Diona'],'A practical physical team using Electro Traveler as an accessible battery and Superconduct enabler.'],
    ],
  },
  'Traveler (Dendro)': {
    source: 'https://keqingmains.com/q/dendro-traveler-quickguide/',
    label: 'KQM — Dendro Traveler',
    teams: [
      ['Hyperbloom','Hyperbloom',['Traveler (Dendro)','Raiden Shogun','Xingqiu','Baizhu'],'KQM example Hyperbloom team with Baizhu providing extra Dendro application and sustain.'],
      ['Aggravate','Aggravate',['Traveler (Dendro)','Keqing','Fischl','Sayu'],'KQM example Quicken/Aggravate setup with VV shred and healing.'],
      ['Double Dendro Quicken','Quicken',['Traveler (Dendro)','Yae Miko','Nahida','Zhongli'],'KQM double-Dendro Quicken example with strong off-field damage and shielding.'],
    ],
  },
  'Traveler (Hydro)': {
    source: 'https://keqingmains.com/q/hydro-traveler-quickguide/',
    label: 'KQM — Hydro Traveler',
    teams: [
      ['Hyperbloom','Hyperbloom',['Traveler (Hydro)','Raiden Shogun','Nahida','Sangonomiya Kokomi'],'KQM’s Hydro Traveler Hyperbloom example; Kokomi covers Hydro uptime outside Traveler’s Skill.'],
      ['Freeze / Mono Cryo','Freeze',['Traveler (Hydro)','Ganyu','Shenhe','Venti'],'KQM example suited to mobs and overworld, alternating between Freeze and Mono Cryo depending on Venti’s absorption.'],
      ['Skill Vaporize','Vaporize',['Traveler (Hydro)','Kaedehara Kazuha','Xiangling','Bennett'],'KQM example focused on Vaporizing Hydro Traveler’s Elemental Skill with Kazuha and Bennett buffs.'],
    ],
  },
  'Traveler (Pyro)': {
    source: 'https://keqingmains.com/q/pyro-traveler-quickguide/',
    label: 'KQM — Pyro Traveler',
    teams: [
      ['Mualani support','Vaporize',['Mualani','Traveler (Pyro)','Xilonen','Sucrose'],'KQM off-field support example using Pyro Traveler with Mualani.'],
      ['Kinich Burning','Burning',['Kinich','Traveler (Pyro)','Emilie','Bennett'],'KQM example where Pyro Traveler maintains Burning and can carry Deepwood.'],
      ['Neuvillette support','Vaporize',['Neuvillette','Furina','Kaedehara Kazuha','Traveler (Pyro)'],'KQM F2P support example providing Pyro and Scroll/C1 damage bonuses.'],
      ['Traveler plunge DPS','Vaporize',['Traveler (Pyro)','Bennett','Furina','Xianyun'],'KQM on-field plunge example for players who want Pyro Traveler as the damage dealer.'],
    ],
  },
};

function travelerFallback(guideName) {
  const fallback = TRAVELER_TEAM_FALLBACKS[guideName];
  if (!fallback) return null;
  return {
    source: fallback.source,
    label: fallback.label,
    teams: fallback.teams.map(([name,reaction,members,note], index) => ({
      rank:index+1, name, reaction, tier:'Guide', dps:null, relative:null, confidence:'guide-example', note,
      members:members.map((member, memberIndex) => ({ name:member, role: memberIndex === 0 ? 'Core / DPS' : 'Teammate', minConstellation:0 })),
    })),
  };
}

function escapeRegExp(value) { return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function safeToken(value, pattern, fallback = '') {
  const raw = String(value || '').trim();
  return pattern.test(raw) ? raw : fallback;
}

async function fetchText(url, fetchImpl = global.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUILD_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ConveneBuilds/1.0; +https://github.com/kazoom02/GachaTracker)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

async function firstSuccessful(urls, fetchImpl) {
  const errors = [];
  for (const url of urls) {
    try { return { url, html: await fetchText(url, fetchImpl) }; }
    catch (error) { errors.push(`${url}: ${error.message}`); }
  }
  const failure = new Error(errors.join(' | ') || 'No source URL available');
  failure.sourceErrors = errors;
  throw failure;
}

function buildTeamCandidates(slug, guideName, officialName = '') {
  const safe = safeToken(slug, /^[a-z0-9_-]{1,80}$/i, '');
  const variants = new Set();
  if (safe) variants.add(safe);
  for (const sourceName of [guideName, officialName]) {
    const normalized = String(sourceName || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!normalized) continue;
    variants.add(normalized);
    variants.add(normalized.replace(/_/g, '-'));
    variants.add(normalized.replace(/_/g, ''));
    const parts = normalized.split('_');
    if (parts.length > 1) variants.add(parts[parts.length - 1]);
  }
  return [...variants].map((item) => `https://genshin-builds.com/en/teams/${encodeURIComponent(item).replace(/%2F/gi, '')}`);
}

async function getBuildGuide(query, fetchImpl = global.fetch) {
  const id = safeToken(query.id, /^[a-z0-9-]{1,80}$/i, 'character');
  const name = safeToken(query.name, /^[\p{L}\p{N} .()'’:-]{1,80}$/u, '') || 'Character';
  const guideName = safeToken(query.guideName, /^[\p{L}\p{N} .()'’:-]{1,80}$/u, '') || name;
  const ggSlug = safeToken(query.ggSlug, /^[a-z0-9%()_-]{1,100}$/i, '');
  const teamSlug = safeToken(query.teamSlug, /^[a-z0-9_-]{1,80}$/i, '');
  const rarity = Number(query.rarity) === 4 ? 4 : 5;

  let build = { element:'', weaponType:'', role:'', weapons:[], artifacts:[], stats:{main:[],sub:[],alternativeCirclet:'',notes:[]}, teamArchetypes:[] };
  let teamGuide = { summary:'', updated:'', teams:[] };
  const sourceStatus = [];

  if (ggSlug) {
    try {
      const url = `https://genshin.gg/characters/${ggSlug}/`;
      const html = await fetchText(url, fetchImpl);
      build = parseGenshinGG(html, guideName);
      sourceStatus.push({ source: 'Genshin.gg', ok: true, url });
    } catch (error) {
      sourceStatus.push({ source: 'Genshin.gg', ok: false, error: error.message });
    }
  }

  try {
    const result = await firstSuccessful(buildTeamCandidates(teamSlug, guideName, name), fetchImpl);
    teamGuide = parseTeamGuide(result.html, guideName, name);
    sourceStatus.push({ source: 'Genshin-Builds.com', ok: true, url: result.url });
  } catch (error) {
    sourceStatus.push({ source: 'Genshin-Builds.com', ok: false, error: error.message });
  }

  let fallbackSource = null;
  if (!teamGuide.teams.length) {
    const fallback = travelerFallback(guideName);
    if (fallback) {
      teamGuide = { ...teamGuide, teams: fallback.teams };
      fallbackSource = fallback;
      sourceStatus.push({ source: fallback.label, ok: true, url: fallback.source, fallback: true });
    }
  }

  const bestTeam = teamGuide.teams[0];
  const bestWeapon = build.weapons[0];
  const bestArtifact = build.artifacts[0];
  const now = new Date().toISOString().slice(0, 10);

  return {
    id,
    game: 'genshin',
    live: true,
    name,
    guideName,
    rarity,
    element: build.element || 'Unknown',
    weaponType: build.weaponType || 'Unknown',
    role: build.role || 'Character',
    patch: '7.0',
    updated: teamGuide.updated || now,
    summary: teamGuide.summary || `Current source-backed build and team recommendations for ${name}.`,
    quick: {
      bestTeam: bestTeam ? bestTeam.members.map((member) => member.name).join(' · ') : 'Live team guide unavailable',
      bestTeamDps: null,
      bestTeamTier: bestTeam?.tier || '',
      bestWeapon: bestWeapon?.name || 'Live build unavailable',
      bestArtifact: bestArtifact?.name || 'Live build unavailable',
    },
    teams: teamGuide.teams,
    variants: [],
    weapons: build.weapons,
    artifacts: build.artifacts,
    stats: build.stats,
    assumptions: [
      'Generic character teams follow the current source guide ranking and tier; Convene does not invent DPS values where no comparable simulation is published.',
      'Imported wish history can prove a character/constellation was seen, but absence from history does not prove the character is unowned. Use roster corrections for incomplete history.',
      'Generic live team entries are treated as C0 unless the composition itself exposes an explicit constellation requirement. High-investment variants should be checked against the linked source.',
      'Source rankings can change with patches, enemies, rotations, investment and new releases. Live data is cached to reduce source traffic.',
    ],
    sources: [
      { label: 'Genshin.gg — Current Character Build', url: sourceStatus.find((item) => item.source === 'Genshin.gg' && item.ok)?.url || 'https://genshin.gg/builds/', use: 'Weapon, artifact and stat ordering' },
      { label: 'Genshin-Builds.com — Current Team Guide', url: sourceStatus.find((item) => item.source === 'Genshin-Builds.com' && item.ok)?.url || 'https://genshin-builds.com/en/teams', use: 'Ranked team compositions and guide tiers' },
      ...(fallbackSource ? [{ label: fallbackSource.label, url: fallbackSource.source, use: 'Traveler team examples when the live Team Lab has no dedicated elemental Traveler guide' }] : []),
    ],
    sourceStatus,
  };
}

module.exports = {
  htmlToLines,
  parseGenshinGG,
  parseTeamGuide,
  inferArchetype,
  buildTeamCandidates,
  getBuildGuide,
};
