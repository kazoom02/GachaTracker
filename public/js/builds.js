import { iconCandidates } from './config.js?v=20260903b';
import { getActiveProfile, getData, getProfiles, switchProfile } from './store.js?v=20260903b';
import { findBuildCharacter } from './build-data.js?v=20260903b';
import { GENSHIN_BUILD_CATALOG, canonicalCharacterName, getCatalogCharacter, guideQuery } from './build-catalog.js?v=20260903b';
import { analyzeGenshinOwnership, buildGuideVariantTeams, characterHistoryStatus, rankBuildableTeams, rankClosestTeams, suggestAlternativeLineups, suggestTeamSubstitutions, teamHistoryStatus, weaponHistoryStatus } from './build-account.js?v=20260903e';
import { clearRosterOverrides, getRosterOverrides, setRosterOverride } from './build-roster.js?v=20260903b';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
const fmt = new Intl.NumberFormat('en-US');
const LIVE_CACHE_KEY = 'convene-build-guide-cache-v1';
const LIVE_FRESH_MS = 12 * 60 * 60 * 1000;
const LIVE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const initialCharacterId = new URLSearchParams(location.search).get('character');
let catalogEntry = getCatalogCharacter(initialCharacterId || 'odette');
let character = null;
let ownership = analyzeGenshinOwnership(getData());
let overrides = getRosterOverrides(getActiveProfile().id);
let reactionFilter = 'all';
let optimizerReaction = 'all';
let buildableOnly = false;
let rosterViewFilter = 'all';
let currentView = initialCharacterId ? 'detail' : 'roster';
let loadToken = 0;
let previewSerial = 0;
const lineupPreviewRegistry = new Map();

function resetLineupPreviews() {
  previewSerial = 0;
  lineupPreviewRegistry.clear();
}

function registerLineupPreview(baseTeam, targetTeam, context = '') {
  const id = `lineup-${++previewSerial}`;
  lineupPreviewRegistry.set(id, { baseTeam, targetTeam, context });
  return id;
}

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
  showView('detail');
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


function showView(view) {
  currentView = view === 'detail' ? 'detail' : 'roster';
  const roster = $('#character-roster-view');
  const detail = $('#character-detail-view');
  roster.hidden = currentView !== 'roster';
  detail.hidden = currentView !== 'detail';
  if (currentView === 'roster') {
    document.title = 'Genshin Character Builds — Convene';
    setGuideStatus();
  }
}

function rosterCharacterStatus(entry) {
  return characterHistoryStatus(entry.name, ownership, 0, overrides);
}

function renderRosterHome() {
  ownership = analyzeGenshinOwnership(getData());
  overrides = getRosterOverrides(getActiveProfile().id);

  const needle = String($('#roster-search')?.value || '').trim().toLowerCase();
  const rows = GENSHIN_BUILD_CATALOG.map((entry) => {
    const status = rosterCharacterStatus(entry);
    return { entry, status, owned: status.state === 'verified' };
  });

  const ownedCount = rows.filter((row) => row.owned).length;
  $('#roster-owned-count').textContent = ownedCount.toLocaleString();
  $('#roster-locked-count').textContent = (rows.length - ownedCount).toLocaleString();

  $('#roster-filters').querySelectorAll('[data-roster-filter]').forEach((button) => {
    button.classList.toggle('roster-filter--on', button.dataset.rosterFilter === rosterViewFilter);
  });

  const visible = rows.filter(({ entry, owned }) => {
    const matchesSearch = !needle || entry.name.toLowerCase().includes(needle) || entry.guideName.toLowerCase().includes(needle);
    if (!matchesSearch) return false;
    if (rosterViewFilter === 'owned') return owned;
    if (rosterViewFilter === 'locked') return !owned;
    return true;
  });

  $('#character-grid').innerHTML = visible.length ? visible.map(({ entry, status, owned }) => {
    const locked = !owned;
    const manualUnowned = status.state === 'unowned';
    const ownershipLabel = owned ? status.label : manualUnowned ? 'Not owned' : 'Not confirmed';
    const title = owned
      ? `${entry.name} · ${status.label}`
      : `${entry.name} · ${manualUnowned ? 'marked not owned' : 'not confirmed on this profile'} · click to view the guide`;
    return `<button class="roster-character-card ${owned ? 'roster-character-card--owned' : 'roster-character-card--locked'}" type="button" data-character-id="${esc(entry.id)}" title="${esc(title)}">
      <span class="roster-character__portrait">
        ${imageTile(entry.name, 'Character', 'character', 'roster-character__icon')}
        ${locked ? '<span class="roster-character__lock" aria-hidden="true">🔒</span>' : '<span class="roster-character__owned" aria-hidden="true">✓</span>'}
      </span>
      <span class="roster-character__copy">
        <b>${esc(entry.name)}</b>
        <small class="roster-character__rarity">${entry.rarity === 5 ? '★★★★★' : '★★★★'}</small>
        <small class="roster-character__status">${esc(ownershipLabel)}</small>
      </span>
    </button>`;
  }).join('') : `<div class="build-empty roster-empty"><b>No characters match.</b><span>Try another search or roster filter.</span></div>`;

  hydrateIcons($('#character-grid'));
}

function openCharacter(entry, historyMode = 'push') {
  const url = new URL(location.href);
  url.searchParams.set('character', entry.id);
  if (historyMode === 'replace') history.replaceState(null, '', url);
  else if (historyMode !== 'none') history.pushState(null, '', url);
  showView('detail');
  $('#character-search').value = '';
  loadCharacter(entry);
}

function openRoster(historyMode = 'push') {
  const url = new URL(location.href);
  url.searchParams.delete('character');
  if (historyMode === 'replace') history.replaceState(null, '', url);
  else if (historyMode !== 'none') history.pushState(null, '', url);
  showView('roster');
  renderProfilePicker();
  renderRosterHome();
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



function inferredRole(name) {
  const canonical = canonicalCharacterName(name);
  for (const sourceTeam of character?.teams || []) {
    const found = (sourceTeam.members || []).find((member) => canonicalCharacterName(member.name) === canonical && member.role);
    if (found?.role) return found.role;
  }
  return '';
}

function enrichVariantTeam(team) {
  if (!team?.isVariant) return team;
  return {
    ...team,
    members: (team.members || []).map((member) => ({ ...member, role: member.role || inferredRole(member.name) })),
  };
}

function optimizerTeamPool() {
  const variants = buildGuideVariantTeams(character?.variants || []).map(enrichVariantTeam);
  return [...(character?.teams || []), ...variants];
}

function previewMemberCard(member) {
  const normalized = { ...member, role: member.role || inferredRole(member.name) };
  return memberCard(normalized);
}

function lineupPreviewMarkup(baseTeam, targetTeam, context = '') {
  const target = enrichVariantTeam(targetTeam);
  const account = teamHistoryStatus(target, ownership, overrides);
  const baseNames = new Set((baseTeam?.members || []).map((member) => canonicalCharacterName(member.name)));
  const targetNames = new Set((target?.members || []).map((member) => canonicalCharacterName(member.name)));
  const removed = [...baseNames].filter((name) => !targetNames.has(name));
  const added = [...targetNames].filter((name) => !baseNames.has(name));
  const changeText = removed.length || added.length
    ? `${removed.length ? `Remove ${removed.join(', ')}` : ''}${removed.length && added.length ? ' · ' : ''}${added.length ? `Add ${added.join(', ')}` : ''}`
    : 'Same four-character core with different source requirements.';
  const sourceLabel = target.isVariant
    ? 'Guide-backed variant · no comparable DPS assigned'
    : Number.isFinite(Number(target.dps))
      ? `${fmt.format(Number(target.dps))} published DPS for this exact source lineup`
      : `${target.tier ? `Tier ${target.tier} · ` : ''}source rank #${target.rank}`;
  const fit = account.fullyVerified ? 'Fully playable on this profile' : `${account.verified}/${target.members.length} verified · ${account.blockers.length} blocker${account.blockers.length === 1 ? '' : 's'}`;
  return `<div class="lineup-preview__head"><div><span>NEW TEAM PREVIEW</span><h4>${esc(target.name || context || 'Alternative lineup')}</h4><p>${esc(changeText)}</p></div><button type="button" class="lineup-preview__close" data-close-lineup-preview aria-label="Close preview">×</button></div>
    <div class="build-units lineup-preview__units">${(target.members || []).map(previewMemberCard).join('')}</div>
    <div class="lineup-preview__meta"><span>${esc(sourceLabel)}</span><b class="${account.fullyVerified ? 'lineup-preview__fit--yes' : ''}">${esc(fit)}</b></div>`;
}

function alternativeLineups(team) {
  const rows = suggestAlternativeLineups(
    team,
    character.teams || [],
    ownership,
    overrides,
    character.name,
    character.variants || [],
    4,
  );
  if (!rows.length) return '';
  return `<div class="alternative-lineups"><div class="alternative-lineups__head"><b>Alternative full teams</b><span>These can change more than one slot. Click any lineup to preview the exact four characters.</span></div><div class="alternative-lineups__grid">${rows.map((entry) => {
    const target = enrichVariantTeam(entry.team);
    const previewId = registerLineupPreview(team, target, 'Alternative lineup');
    const playable = entry.account.fullyVerified;
    const label = target.isVariant ? 'Guide variant' : Number.isFinite(Number(target.dps)) ? `${fmt.format(Number(target.dps))} DPS` : `${target.tier ? `Tier ${target.tier} · ` : ''}source #${target.rank}`;
    return `<button type="button" class="alternative-lineup ${playable ? 'alternative-lineup--playable' : ''}" data-lineup-preview="${esc(previewId)}">
      <span class="alternative-lineup__icons">${(target.members || []).map((member) => imageTile(member.name, 'Character', 'character', 'alternative-lineup__icon')).join('')}</span>
      <span class="alternative-lineup__copy"><b>${esc(target.name)}</b><small>${esc(label)}</small><em>${playable ? '✓ Playable on my roster' : `${entry.account.blockers.length} blocker${entry.account.blockers.length === 1 ? '' : 's'}`}</em></span>
    </button>`;
  }).join('')}</div></div>`;
}

function replacementSuggestions(team, account) {
  if (account.fullyVerified || !account.blockers.length) return '';
  const suggestions = suggestTeamSubstitutions(
    team,
    character.teams || [],
    ownership,
    overrides,
    character.name,
    character.variants || [],
    3,
  );

  const rows = suggestions.map((entry) => {
    const missingName = entry.member?.name || 'Missing slot';
    if (entry.coreCharacter) {
      return `<div class="replacement-row"><div class="replacement-missing"><span>Missing</span><b>${esc(missingName)}</b></div><div class="replacement-none"><b>Core character</b><span>This guide is centered on ${esc(character.name)}, so this slot is not replaced with a different carry.</span></div></div>`;
    }
    if (!entry.candidates.length) {
      return `<div class="replacement-row"><div class="replacement-missing"><span>Instead of</span><b>${esc(missingName)}</b></div><div class="replacement-none"><b>No exact one-slot source swap</b><span>Use the full-team alternatives below instead; they may change two or more members.</span></div></div>`;
    }
    return `<div class="replacement-row"><div class="replacement-missing"><span>Instead of</span><b>${esc(missingName)}</b></div><div class="replacement-options">${entry.candidates.map((candidate, index) => {
      const status = candidate.status || { state:'unknown', label:'Ownership unknown' };
      const target = enrichVariantTeam(candidate.targetTeam);
      const previewId = registerLineupPreview(team, target, `Replace ${missingName} with ${candidate.name}`);
      const requirement = Number(candidate.minConstellation || 0) > 0 ? ` · C${candidate.minConstellation}+ required` : '';
      return `<button type="button" class="replacement-option replacement-option--${esc(status.state)}" data-lineup-preview="${esc(previewId)}" title="Preview the complete team after this swap">
        ${imageTile(candidate.name, 'Character', 'character', 'replacement-option__icon')}
        <span class="replacement-option__copy"><b>${esc(candidate.name)}</b><small>Exact one-slot source swap${esc(requirement)}</small><span>${esc(status.label)} · click to preview team</span></span>
        ${index === 0 && status.state === 'verified' ? '<i class="replacement-best">BEST OWNED</i>' : ''}
      </button>`;
    }).join('')}</div></div>`;
  }).join('');

  const alternatives = alternativeLineups(team);
  if (!rows && !alternatives) return '';
  return `<div class="team-replacements"><div class="team-replacements__head"><b>Roster alternatives</b><span>“Instead of” now means an exact one-slot source swap. Full-team alternatives are kept separate so role changes are never hidden.</span></div>${rows}${alternatives}<div class="lineup-preview" hidden></div></div>`;
}

function metricForTeam(team, personalRank = null) {
  if (Number.isFinite(Number(team.dps))) return `<div class="build-dps"><strong>${fmt.format(Number(team.dps))}</strong><span>PUBLISHED DPS</span></div>`;
  if (team.isVariant) return `<div class="build-dps build-dps--tier"><strong>Guide variant</strong><span>${personalRank ? `YOUR #${personalRank} · ` : ''}NO INVENTED DPS</span></div>`;
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
      ${meter}${blockers}${replacementSuggestions(team, account)}
      <div class="build-team__foot"><span>${team.isVariant ? 'Guide-backed variant' : team.tier ? `Tier ${esc(team.tier)}` : Number.isFinite(Number(team.relative)) ? `${esc(team.relative)}% of source #1` : 'Source-ranked'}</span>${team.isVariant ? '' : `<span>Source rank #${esc(team.rank)}</span>`}<span class="account-fit ${account.fullyVerified ? 'account-fit--yes' : ''}">${esc(accountLabel)}</span></div>
    </div>
  </article>`;
}

function reactions() {
  return [...new Set([...(character.teams || []).map((team) => team.reaction), ...(character.variants || []).map((variant) => variant.reaction)].filter(Boolean))];
}

function filterTeams(list, reaction) { return reaction === 'all' ? list : list.filter((team) => team.reaction === reaction); }

function filterButtons(container, selected, includeBuildable = false) {
  const items = ['all', ...reactions()];
  container.innerHTML = items.map((item) => `<button class="team-filter ${selected === item ? 'team-filter--on' : ''}" data-filter-value="${esc(item)}">${item === 'all' ? 'All' : esc(item)}</button>`).join('') + (includeBuildable ? `<button class="team-filter team-filter--account ${buildableOnly ? 'team-filter--on' : ''}" id="buildable-filter">Buildable on my roster</button>` : '');
}

function renderOptimizer() {
  const all = filterTeams(optimizerTeamPool(), optimizerReaction);
  const ranked = rankBuildableTeams(all, ownership, overrides);
  filterButtons($('#optimizer-filters'), optimizerReaction, false);
  $('#optimizer-filters').querySelectorAll('[data-filter-value]').forEach((button) => button.addEventListener('click', () => { optimizerReaction = button.dataset.filterValue; renderOptimizer(); hydrateIcons($('#my-teams')); hydrateIcons($('#closest-teams')); }));

  $('#my-teams').innerHTML = ranked.length
    ? ranked.slice(0, 6).map((entry, index) => teamCard(entry.team, { personalRank:index + 1 })).join('')
    : `<div class="build-empty"><b>No source or guide team is fully verified yet.</b><span>Roster history can be incomplete. Check the closest teams below or open Roster corrections to confirm older/free characters.</span></div>`;

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
  resetLineupPreviews();
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
  resetLineupPreviews();
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
  if (currentView === 'roster') {
    renderProfilePicker();
    renderRosterHome();
  } else {
    renderAll();
  }
});

$('#character-select').addEventListener('change', (event) => {
  openCharacter(getCatalogCharacter(event.target.value));
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

$('#roster-search').addEventListener('input', renderRosterHome);
$('#roster-filters').querySelectorAll('[data-roster-filter]').forEach((button) => button.addEventListener('click', () => {
  rosterViewFilter = button.dataset.rosterFilter;
  renderRosterHome();
}));
$('#character-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-character-id]');
  if (!card) return;
  openCharacter(getCatalogCharacter(card.dataset.characterId));
});
$('#back-to-roster').addEventListener('click', () => openRoster());

document.addEventListener('click', (event) => {
  const close = event.target.closest('[data-close-lineup-preview]');
  if (close) {
    const preview = close.closest('.lineup-preview');
    if (preview) { preview.hidden = true; preview.innerHTML = ''; }
    return;
  }
  const trigger = event.target.closest('[data-lineup-preview]');
  if (!trigger) return;
  const data = lineupPreviewRegistry.get(trigger.dataset.lineupPreview);
  if (!data) return;
  const card = trigger.closest('.build-team');
  const preview = card?.querySelector('.lineup-preview');
  if (!preview) return;
  preview.innerHTML = lineupPreviewMarkup(data.baseTeam, data.targetTeam, data.context);
  preview.hidden = false;
  hydrateIcons(preview);
  preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

window.addEventListener('popstate', () => {
  const id = new URLSearchParams(location.search).get('character');
  if (!id) {
    openRoster('none');
    return;
  }
  openCharacter(getCatalogCharacter(id), 'none');
});

renderProfilePicker();
if (initialCharacterId) {
  showView('detail');
  loadCharacter(catalogEntry);
} else {
  openRoster('none');
}
