import { iconCandidates } from './config.js?v=20260903b';
import { getActiveProfile, getData, getProfiles, switchProfile } from './store.js?v=20260903b';
import { findBuildCharacter } from './build-data.js?v=20260903b';
import { GENSHIN_BUILD_CATALOG, canonicalCharacterName, getCatalogCharacter, guideQuery } from './build-catalog.js?v=20260903b';
import { analyzeGenshinOwnership, characterHistoryStatus, rankBuildableTeams, rankClosestTeams, teamHistoryStatus, weaponHistoryStatus } from './build-account.js?v=20260903b';
import { clearRosterOverrides, getRosterOverrides, setRosterOverride } from './build-roster.js?v=20260903b';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const fmt = new Intl.NumberFormat('en-US');
const LIVE_CACHE_KEY = 'convene-build-guide-cache-v1';
const LIVE_FRESH_MS = 12 * 60 * 60 * 1000;
const LIVE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

let catalogEntry = getCatalogCharacter(new URLSearchParams(location.search).get('character') || 'odette');
let character = null;
let ownership = analyzeGenshinOwnership(getData());
let overrides = getRosterOverrides(getActiveProfile().id);
let reactionFilter = 'all';
let optimizerReaction = 'all';
let buildableOnly = false;
let loadToken = 0;

function readCache() {
  try { return JSON.parse(localStorage.getItem(LIVE_CACHE_KEY) || '{}') || {}; } catch { return {}; }
}
function writeCache(id, data) {
  try {
    const cache = readCache();
    cache[id] = { savedAt: Date.now(), data };
    const entries = Object.entries(cache).sort((a,b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0)).slice(0, 40);
    localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage may be disabled */ }
}
function cachedGuide(id, maxAge = LIVE_FRESH_MS) {
  const item = readCache()[id];
  if (!item?.data || Date.now() - Number(item.savedAt || 0) > maxAge) return null;
  return item.data;
}

function imageTile(name, itemType = 'Character', poolKey = 'character', extraClass = '') {
  const candidates = iconCandidates('genshin', name, itemType, poolKey);
  const initials = String(name).split(/\s+/).map((part) => part[0]).join('').slice(0,2).toUpperCase();
  return `<span class="build-icon ${extraClass}" data-icon-sources="${esc(JSON.stringify(candidates))}" data-icon-index="0"><span>${esc(initials)}</span></span>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon-sources]:not([data-icon-ready])').forEach((tile) => {
    tile.dataset.iconReady = '1';
    let urls = [];
    try { urls = JSON.parse(tile.dataset.iconSources || '[]'); } catch { return; }
    if (!urls.length) return;
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    let index = 0;
    const next = () => { if (index >= urls.length) { img.remove(); return; } img.src = urls[index++]; };
    img.addEventListener('error', next);
    tile.appendChild(img);
    next();
  });
}

function setGuideStatus(message = '', type = 'info') {
  const box = $('#guide-status');
  if (!message) { box.hidden = true; box.textContent = ''; box.className = 'guide-status'; return; }
  box.hidden = false;
  box.className = `guide-status guide-status--${type}`;
  box.textContent = message;
}

function normalizeLiveGuide(data, entry) {
  const teams = (data.teams || []).map((team, index) => ({
    ...team,
    rank: Number(team.rank || index + 1),
    reaction: team.reaction || 'General',
    members: (team.members || []).map((member) => ({ ...member, name: canonicalCharacterName(member.name), minConstellation: Number(member.minConstellation || 0) })),
  }));
  return {
    ...data,
    id: entry.id,
    name: entry.name,
    rarity: entry.rarity,
    teams,
    variants: data.variants || [],
    weapons: data.weapons || [],
    artifacts: data.artifacts || [],
    stats: { main: [], sub: [], alternativeCirclet: '', notes: [], ...(data.stats || {}) },
    quick: { bestTeam: '', bestTeamDps: null, bestTeamTier: '', bestWeapon: '', bestArtifact: '', ...(data.quick || {}) },
    assumptions: data.assumptions || [],
    sources: data.sources || [],
  };
}

function fallbackGuide(entry, detail = '') {
  return {
    id: entry.id, game:'genshin', live:true, degraded:true, name:entry.name, rarity:entry.rarity,
    element:'Unknown', weaponType:'Unknown', role:'Character', patch:'7.0', updated:new Date().toISOString().slice(0,10),
    summary:`Convene has ${entry.name} in the current Genshin roster, but the live build sources could not be normalized right now.`,
    quick:{ bestTeam:'Guide temporarily unavailable', bestTeamDps:null, bestTeamTier:'', bestWeapon:'—', bestArtifact:'—' },
    teams:[], variants:[], weapons:[], artifacts:[], stats:{main:[],sub:[],alternativeCirclet:'',notes:[]},
    assumptions:['Live guide data could not be loaded. The character remains available in the selector and account roster, but Convene will not invent recommendations.'],
    sources:[{label:'Genshin.gg Builds',url:'https://genshin.gg/builds/',use:'Live build source'},{label:'Genshin-Builds.com Teams',url:'https://genshin-builds.com/en/teams',use:'Live team source'}],
    loadError:detail,
  };
}

async function loadCharacter(entry) {
  const token = ++loadToken;
  catalogEntry = entry;
  reactionFilter = 'all';
  optimizerReaction = 'all';
  buildableOnly = false;
  const curated = findBuildCharacter(entry.id);
  if (curated) {
    character = curated;
    setGuideStatus('Curated Convene snapshot loaded. This character includes compatible published DPS comparisons.', 'good');
    renderAll();
    return;
  }

  const fresh = cachedGuide(entry.id, LIVE_FRESH_MS);
  if (fresh) {
    character = normalizeLiveGuide(fresh, entry);
    setGuideStatus('Live guide loaded from Convene cache. It refreshes automatically after 12 hours.', 'info');
    renderAll();
    return;
  }

  character = fallbackGuide(entry);
  setGuideStatus(`Loading current ${entry.name} build and team guides…`, 'loading');
  renderAll();
  try {
    const response = await fetch(`/api/build-guide?${guideQuery(entry)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Build API returned ${response.status}`);
    const data = await response.json();
    if (token !== loadToken) return;
    character = normalizeLiveGuide(data, entry);
    writeCache(entry.id, data);
    const failed = (data.sourceStatus || []).filter((item) => !item.ok).map((item) => item.source);
    setGuideStatus(failed.length ? `Loaded with partial source coverage. Unavailable: ${failed.join(', ')}.` : 'Current live build and team guides loaded.', failed.length ? 'warn' : 'good');
    renderAll();
  } catch (error) {
    if (token !== loadToken) return;
    const stale = cachedGuide(entry.id, LIVE_STALE_MS);
    if (stale) {
      character = normalizeLiveGuide(stale, entry);
      setGuideStatus(`Live refresh failed, so Convene is showing the most recent cached guide. ${error.message}`, 'warn');
    } else {
      character = fallbackGuide(entry, error.message);
      setGuideStatus(`Could not load the live guide for ${entry.name}. No recommendations were invented. ${error.message}`, 'error');
    }
    renderAll();
  }
}

function renderProfilePicker() {
  const active = getActiveProfile();
  $('#build-profile-select').innerHTML = getProfiles().map((profile) => `<option value="${esc(profile.id)}" ${profile.id === active.id ? 'selected' : ''}>${esc(profile.name)} · ${profile.pullCount.toLocaleString()} pulls</option>`).join('');
}

function renderCharacterPicker(filter = $('#character-search')?.value || '') {
  const needle = String(filter).trim().toLowerCase();
  const matches = GENSHIN_BUILD_CATALOG.filter((entry) => !needle || entry.name.toLowerCase().includes(needle) || entry.guideName.toLowerCase().includes(needle));
  const list = matches.some((entry) => entry.id === catalogEntry.id) ? matches : [catalogEntry, ...matches];
  $('#character-select').innerHTML = list.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === catalogEntry.id ? 'selected' : ''}>${esc(entry.name)} · ${entry.rarity}★</option>`).join('');
}

function renderHero() {
  document.title = `${character.name} Best Teams, Weapons & Artifacts — Convene`;
  $('#character-name').textContent = character.name;
  $('#character-meta').textContent = `${character.rarity}★ · ${character.element || 'Unknown element'} · ${character.weaponType || 'Unknown weapon'}`;
  $('#character-role').textContent = character.role || 'Character';
  $('#character-summary').textContent = character.summary || '';
  $('#updated').textContent = `${character.patch ? `Patch ${character.patch} · ` : ''}updated ${character.updated || 'current'}`;
  $('#source-mode').textContent = character.live ? 'Live source ranking' : 'Curated DPS snapshot';
  $('#quick-team').textContent = character.quick?.bestTeam || '—';
  $('#quick-team-dps').textContent = Number.isFinite(Number(character.quick?.bestTeamDps))
    ? `${fmt.format(Number(character.quick.bestTeamDps))} published DPS`
    : character.quick?.bestTeamTier ? `Tier ${character.quick.bestTeamTier} · source #1` : (character.teams?.length ? 'Source-ranked recommendation' : '');
  $('#quick-weapon').textContent = character.quick?.bestWeapon || character.weapons?.[0]?.name || '—';
  $('#quick-artifact').textContent = character.quick?.bestArtifact || character.artifacts?.[0]?.name || '—';

  const own = characterHistoryStatus(character.name, ownership, 0, overrides);
  $('#ownership-self').className = `history-chip history-chip--${own.state}`;
  $('#ownership-self').textContent = own.label;
  $('#character-portrait').innerHTML = `${imageTile(character.name, 'Character', 'character', 'build-icon--portrait')}<span class="portrait-fallback">${esc(character.name[0] || '?')}</span>`;
  hydrateIcons($('#character-portrait'));
}

function renderAccountInsight() {
  const active = getActiveProfile();
  $('#owned-count').textContent = ownership.characters.size.toLocaleString();
  $('#typed-pulls').textContent = ownership.typedPulls.toLocaleString();
  $('#account-title').textContent = `${active.name}: personalized roster`;
  const correctionCount = Object.keys(overrides).length;
  $('#account-copy').textContent = ownership.hasTypedHistory
    ? `Convene found ${ownership.characters.size} unique characters in typed wish records. ${correctionCount ? `${correctionCount} manual roster correction${correctionCount === 1 ? '' : 's'} also appl${correctionCount === 1 ? 'ies' : 'y'}.` : 'Use roster corrections for free characters or older pulls outside your imported history.'}`
    : `No typed Genshin character history is available yet. The optimizer stays conservative until you import history or fill roster corrections.${correctionCount ? ` ${correctionCount} manual correction${correctionCount === 1 ? '' : 's'} currently applied.` : ''}`;
}

function memberCard(member) {
  const status = characterHistoryStatus(member.name, ownership, member.minConstellation || 0, overrides);
  const requirement = Number(member.minConstellation || 0) ? `C${member.minConstellation} required` : 'C0+';
  return `<div class="build-unit build-unit--${status.state}">
    ${imageTile(member.name)}
    <div class="build-unit__copy"><b>${esc(member.name)}</b><small>${esc(member.role || '')}</small></div>
    <span class="build-unit__req">${esc(requirement)}</span>
    <span class="history-dot history-dot--${status.state}" title="${esc(status.label)}"></span>
  </div>`;
}

function metricForTeam(team, personalRank = null) {
  if (Number.isFinite(Number(team.dps))) return `<div class="build-dps"><strong>${fmt.format(Number(team.dps))}</strong><span>PUBLISHED DPS</span></div>`;
  const tier = team.tier && team.tier !== 'Guide' ? `Tier ${team.tier}` : 'Guide ranked';
  return `<div class="build-dps build-dps--tier"><strong>${esc(tier)}</strong><span>${personalRank ? `YOUR #${personalRank} · ` : ''}SOURCE #${esc(team.rank)}</span></div>`;
}

function teamCard(team, { personalRank = null, closest = false } = {}) {
  const account = teamHistoryStatus(team, ownership, overrides);
  const rankText = personalRank ? `Your #${personalRank}` : `#${team.rank}`;
  const accountLabel = account.fullyVerified ? 'Roster verified' : `${account.verified}/${team.members.length} verified · ${account.blockers.length} blocker${account.blockers.length === 1 ? '' : 's'}`;
  const maxDps = Math.max(0, ...(character.teams || []).map((item) => Number(item.dps) || 0));
  const meter = Number.isFinite(Number(team.dps)) && maxDps > 0 ? `<div class="build-meter"><i style="width:${Math.max(8, Number(team.dps) / maxDps * 100)}%"></i></div>` : '';
  const blockers = closest ? `<div class="team-blockers">${account.blockers.map(({member,status}) => `<span class="blocker blocker--${status.state}"><b>${esc(member.name)}</b> ${esc(status.label)}</span>`).join('')}</div>` : '';
  return `<article class="build-team ${personalRank === 1 || (!personalRank && team.rank === 1) ? 'build-team--best' : ''}">
    <div class="build-team__rank"><b>${esc(rankText)}</b><span>${esc(team.reaction || 'General')}</span></div>
    <div class="build-team__body">
      <div class="build-team__title"><div><h3>${esc(team.name)}</h3><p>${esc(team.note || '')}</p></div>${metricForTeam(team, personalRank)}</div>
      <div class="build-units">${(team.members || []).map(memberCard).join('')}</div>
      ${meter}${blockers}
      <div class="build-team__foot"><span>${team.tier ? `Tier ${esc(team.tier)}` : Number.isFinite(Number(team.relative)) ? `${esc(team.relative)}% of source #1` : 'Source-ranked'}</span><span>Source rank #${esc(team.rank)}</span><span class="account-fit ${account.fullyVerified ? 'account-fit--yes' : ''}">${esc(accountLabel)}</span></div>
    </div>
  </article>`;
}

function reactions() {
  return [...new Set((character.teams || []).map((team) => team.reaction).filter(Boolean))];
}

function filterTeams(list, reaction) { return reaction === 'all' ? list : list.filter((team) => team.reaction === reaction); }

function filterButtons(container, selected, includeBuildable = false) {
  const items = ['all', ...reactions()];
  container.innerHTML = items.map((item) => `<button class="team-filter ${selected === item ? 'team-filter--on' : ''}" data-filter-value="${esc(item)}">${item === 'all' ? 'All' : esc(item)}</button>`).join('') + (includeBuildable ? `<button class="team-filter team-filter--account ${buildableOnly ? 'team-filter--on' : ''}" id="buildable-filter">Buildable on my roster</button>` : '');
}

function renderOptimizer() {
  const all = filterTeams(character.teams || [], optimizerReaction);
  const ranked = rankBuildableTeams(all, ownership, overrides);
  filterButtons($('#optimizer-filters'), optimizerReaction, false);
  $('#optimizer-filters').querySelectorAll('[data-filter-value]').forEach((button) => button.addEventListener('click', () => { optimizerReaction = button.dataset.filterValue; renderOptimizer(); hydrateIcons($('#my-teams')); hydrateIcons($('#closest-teams')); }));

  $('#my-teams').innerHTML = ranked.length
    ? ranked.slice(0, 6).map((entry, index) => teamCard(entry.team, { personalRank:index + 1 })).join('')
    : `<div class="build-empty"><b>No team is fully verified yet.</b><span>That does not necessarily mean you cannot build one. Open Roster corrections below and fill characters missing from your imported wish history.</span></div>`;

  const closest = rankClosestTeams(all, ownership, overrides, 4);
  $('#closest-teams').innerHTML = closest.length ? closest.map((entry) => teamCard(entry.team, { closest:true })).join('') : `<div class="build-empty"><b>No locked teams to show.</b><span>${ranked.length ? 'Every source-ranked team in this filter is roster verified.' : 'No team data is available for this character/filter.'}</span></div>`;
  hydrateIcons($('#my-teams')); hydrateIcons($('#closest-teams'));
}

function renderTeams() {
  let teams = filterTeams(character.teams || [], reactionFilter);
  if (buildableOnly) teams = teams.filter((team) => teamHistoryStatus(team, ownership, overrides).fullyVerified);
  filterButtons($('#reaction-filters'), reactionFilter, true);
  $('#reaction-filters').querySelectorAll('[data-filter-value]').forEach((button) => button.addEventListener('click', () => { reactionFilter = button.dataset.filterValue; renderTeams(); hydrateIcons($('#teams')); }));
  $('#buildable-filter')?.addEventListener('click', () => { buildableOnly = !buildableOnly; renderTeams(); hydrateIcons($('#teams')); });

  const hasDps = (character.teams || []).some((team) => Number.isFinite(Number(team.dps)));
  $('#teams-heading').textContent = hasDps ? 'Best quantified teams' : 'Best source-ranked teams';
  $('#teams-copy').textContent = hasDps
    ? 'Compatible published calculations are ordered by DPS; account ownership is layered on without changing those source numbers.'
    : 'These teams follow the current guide’s order and tier. Convene deliberately does not assign fake DPS where a compatible calculation is unavailable.';

  $('#teams').innerHTML = teams.length ? teams.map((team) => teamCard(team)).join('') : `<div class="build-empty"><b>No team matches this filter.</b><span>${buildableOnly ? 'Disable the roster filter or add roster corrections.' : 'The live team source may not have a guide for this character yet.'}</span></div>`;
  hydrateIcons($('#teams'));
}

function renderVariants() {
  const variants = character.variants || [];
  $('#variants-section').hidden = !variants.length;
  if (!variants.length) { $('#variants').innerHTML = ''; return; }
  $('#variants').innerHTML = variants.map((variant) => `<article class="build-variant"><span class="reaction-pill">${esc(variant.reaction || 'Variant')}</span><h3>${variant.members.map((name, index) => { const status = characterHistoryStatus(name, ownership, 0, overrides); return `${index ? '<span class="member-sep">·</span>' : ''}<span class="variant-member variant-member--${status.state}"><i></i>${esc(name)}</span>`; }).join('')}</h3><p>${esc(variant.note || '')}</p><small>Guide-backed variant · no invented DPS</small></article>`).join('');
}

function renderWeapons() {
  const weapons = character.weapons || [];
  $('#weapons').innerHTML = weapons.length ? weapons.map((weapon) => {
    const seen = weaponHistoryStatus(weapon.name, ownership);
    const score = weapon.range || (Number.isFinite(Number(weapon.relative)) ? `${weapon.relative}%` : `#${weapon.rank}`);
    return `<article class="build-list-row"><span class="build-list-rank">#${esc(weapon.rank)}</span>${imageTile(weapon.name, 'Weapon', 'weapon')}<div class="build-list-copy"><h3>${esc(weapon.name)} ${weapon.refinement ? `<small>${esc(weapon.refinement)}</small>` : ''}</h3><p>${esc(weapon.note || '')}</p>${seen.state === 'verified' ? `<span class="equipment-owned">${esc(seen.label)}</span>` : ''}</div><div class="build-list-score"><strong>${esc(score)}</strong><span>${esc(weapon.tier || 'Source ranked')}</span></div></article>`;
  }).join('') : `<div class="build-empty"><b>Weapon guide unavailable.</b><span>Convene will not invent an equipment ranking.</span></div>`;
  hydrateIcons($('#weapons'));
}

function renderArtifacts() {
  const artifacts = character.artifacts || [];
  $('#artifacts').innerHTML = artifacts.length ? artifacts.map((artifact) => `<article class="artifact-card ${artifact.rank === 1 ? 'artifact-card--best' : ''}"><header><span>#${esc(artifact.rank)}</span><div><h3>${esc(artifact.name)}</h3><p>${esc(String(artifact.pieces || ''))}${artifact.label ? ` · ${esc(artifact.label)}` : ''}</p></div></header>${artifact.relativeTeam != null ? `<div class="artifact-metrics"><span><b>${esc(artifact.relativeTeam)}%</b> team DPS</span>${artifact.relativePersonal != null ? `<span><b>${esc(artifact.relativePersonal)}%</b> personal</span>` : ''}</div>` : ''}<p>${esc(artifact.note || '')}</p></article>`).join('') : `<div class="build-empty"><b>Artifact guide unavailable.</b><span>Try again when the live source is reachable.</span></div>`;

  const stats = character.stats || {main:[],sub:[],notes:[]};
  const hasStats = (stats.main || []).length || (stats.sub || []).length || stats.alternativeCirclet || (stats.notes || []).length;
  $('#stats').hidden = !hasStats;
  $('#stats').innerHTML = hasStats ? `<h3>Recommended stats</h3>${(stats.main || []).length ? `<div><b>Main stats</b><span>${stats.main.map(esc).join(' · ')}</span></div>` : ''}${(stats.sub || []).length ? `<div><b>Substats</b><span>${stats.sub.map(esc).join(' > ')}</span></div>` : ''}${stats.alternativeCirclet ? `<p>${esc(stats.alternativeCirclet)}</p>` : ''}${(stats.notes || []).map((note) => `<p>${esc(note)}</p>`).join('')}` : '';
}

function relevantRosterNames() {
  const names = new Set([character.name]);
  for (const team of character.teams || []) for (const member of team.members || []) names.add(canonicalCharacterName(member.name));
  for (const variant of character.variants || []) for (const name of variant.members || []) names.add(canonicalCharacterName(name));
  return [...names].sort((a,b) => a.localeCompare(b));
}

function renderRosterEditor() {
  const names = relevantRosterNames();
  $('#roster-editor').innerHTML = names.map((name) => {
    const auto = characterHistoryStatus(name, ownership, 0, {});
    const manual = Object.prototype.hasOwnProperty.call(overrides, name) ? String(overrides[name]) : '';
    const options = [`<option value="" ${manual === '' ? 'selected' : ''}>Auto · ${esc(auto.label)}</option>`, `<option value="-1" ${manual === '-1' ? 'selected' : ''}>Not owned</option>`, ...Array.from({length:7}, (_,c) => `<option value="${c}" ${manual === String(c) ? 'selected' : ''}>Owned · C${c}</option>`)].join('');
    return `<label class="roster-row"><span>${imageTile(name)}<b>${esc(name)}</b></span><select data-roster-name="${esc(name)}">${options}</select></label>`;
  }).join('');
  $('#roster-editor').querySelectorAll('[data-roster-name]').forEach((select) => select.addEventListener('change', () => {
    setRosterOverride(getActiveProfile().id, select.dataset.rosterName, select.value);
    overrides = getRosterOverrides(getActiveProfile().id);
    renderPersonalLayers();
  }));
  hydrateIcons($('#roster-editor'));
}

function renderMethod() {
  $('#assumptions').innerHTML = (character.assumptions || []).map((item) => `<li>${esc(item)}</li>`).join('');
  $('#sources').innerHTML = (character.sources || []).map((source) => `<a class="build-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><span><b>${esc(source.label)}</b><small>${esc(source.use || '')}</small></span><i aria-hidden="true">↗</i></a>`).join('');
}

function renderPersonalLayers() {
  renderHero();
  renderAccountInsight();
  renderOptimizer();
  renderTeams();
  renderVariants();
  renderWeapons();
  renderRosterEditor();
}

function renderAll() {
  if (!character) return;
  ownership = analyzeGenshinOwnership(getData());
  overrides = getRosterOverrides(getActiveProfile().id);
  renderProfilePicker();
  renderCharacterPicker();
  renderHero();
  renderAccountInsight();
  renderOptimizer();
  renderTeams();
  renderVariants();
  renderWeapons();
  renderArtifacts();
  renderRosterEditor();
  renderMethod();
}

$('#build-profile-select').addEventListener('change', (event) => {
  switchProfile(event.target.value);
  ownership = analyzeGenshinOwnership(getData());
  overrides = getRosterOverrides(getActiveProfile().id);
  renderAll();
});

$('#character-select').addEventListener('change', (event) => {
  const entry = getCatalogCharacter(event.target.value);
  const url = new URL(location.href);
  url.searchParams.set('character', entry.id);
  history.replaceState(null, '', url);
  $('#character-search').value = '';
  loadCharacter(entry);
});

$('#character-search').addEventListener('input', () => renderCharacterPicker());
$('#character-search').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const needle = event.currentTarget.value.trim().toLowerCase();
  const match = GENSHIN_BUILD_CATALOG.find((entry) => entry.name.toLowerCase() === needle || entry.guideName.toLowerCase() === needle) || GENSHIN_BUILD_CATALOG.find((entry) => entry.name.toLowerCase().includes(needle));
  if (match) {
    $('#character-select').value = match.id;
    $('#character-select').dispatchEvent(new Event('change'));
  }
});

$('#roster-reset').addEventListener('click', () => {
  clearRosterOverrides(getActiveProfile().id);
  overrides = {};
  renderPersonalLayers();
});

loadCharacter(catalogEntry);
