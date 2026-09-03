import { iconCandidates } from './config.js?v=20260903a';
import { getActiveProfile, getData, getProfiles, switchProfile } from './store.js?v=20260903a';
import { BUILD_CHARACTERS, getBuildCharacter } from './build-data.js?v=20260903a';
import { analyzeGenshinOwnership, characterHistoryStatus, teamHistoryStatus, weaponHistoryStatus } from './build-account.js?v=20260903a';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const fmt = new Intl.NumberFormat('en-US');

let reactionFilter = 'all';
let historyOnly = false;
let character = getBuildCharacter(new URLSearchParams(location.search).get('character') || 'odette');
let ownership = analyzeGenshinOwnership(getData());

function profileInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || 'P').slice(0, 2)).toUpperCase();
}

function imageTile(name, itemType = 'Character', poolKey = 'character', extraClass = '') {
  const candidates = iconCandidates('genshin', name, itemType, poolKey);
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const sources = esc(JSON.stringify(candidates));
  return `<span class="build-icon ${extraClass}" data-icon-sources="${sources}" data-icon-index="0"><span>${esc(initials)}</span></span>`;
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
    const next = () => {
      if (index >= urls.length) { img.remove(); return; }
      img.src = urls[index++];
    };
    img.addEventListener('error', next);
    tile.appendChild(img);
    next();
  });
}

function renderProfilePicker() {
  const active = getActiveProfile();
  $('#build-profile-select').innerHTML = getProfiles().map((profile) =>
    `<option value="${esc(profile.id)}" ${profile.id === active.id ? 'selected' : ''}>${esc(profile.name)} · ${profile.pullCount.toLocaleString()} pulls</option>`
  ).join('');
}

function renderCharacterPicker() {
  $('#character-select').innerHTML = BUILD_CHARACTERS.map((entry) =>
    `<option value="${esc(entry.id)}" ${entry.id === character.id ? 'selected' : ''}>${esc(entry.name)}</option>`
  ).join('');
}

function renderHero() {
  document.title = `${character.name} Best Teams, Weapons & Artifacts — Convene`;
  $('#character-name').textContent = character.name;
  $('#character-meta').textContent = `${character.rarity}★ ${character.element} · ${character.weaponType}`;
  $('#character-role').textContent = character.role;
  $('#character-summary').textContent = character.summary;
  $('#updated').textContent = `Patch ${character.patch} · checked ${character.updated}`;
  $('#quick-team').textContent = character.quick.bestTeam;
  $('#quick-team-dps').textContent = `${fmt.format(character.quick.bestTeamDps)} published DPS`;
  $('#quick-weapon').textContent = character.quick.bestWeapon;
  $('#quick-artifact').textContent = character.quick.bestArtifact;

  const own = characterHistoryStatus(character.name, ownership);
  $('#ownership-self').className = `history-chip history-chip--${own.state}`;
  $('#ownership-self').textContent = own.label;
  $('#character-portrait').innerHTML = `${imageTile(character.name, 'Character', 'character', 'build-icon--portrait')}<span class="portrait-fallback">${esc(character.name[0])}</span>`;
  hydrateIcons($('#character-portrait'));
}

function renderAccountInsight() {
  const active = getActiveProfile();
  $('#owned-count').textContent = ownership.characters.size.toLocaleString();
  $('#typed-pulls').textContent = ownership.typedPulls.toLocaleString();
  $('#account-title').textContent = `${active.name}: account-aware recommendations`;

  if (!ownership.hasTypedHistory) {
    $('#account-copy').textContent = 'No typed Genshin wish records were found in this profile yet. Import a live history link (or an export containing Item Type) and this page will automatically mark team members seen in your history.';
  } else {
    $('#account-copy').textContent = `Convene found ${ownership.characters.size} unique character names in this profile’s saved wish history. Team cards show the minimum constellation witnessed by those records and can be filtered to lineups fully verified by the imported history.`;
  }
  $('#history-filter').disabled = !ownership.hasTypedHistory;
  if (!ownership.hasTypedHistory) historyOnly = false;
  $('#history-filter').classList.toggle('team-filter--on', historyOnly);
}

function memberCard(member) {
  const status = characterHistoryStatus(member.name, ownership, member.minConstellation || 0);
  const requirement = member.minConstellation ? `C${member.minConstellation} required` : 'C0+';
  return `<div class="build-unit build-unit--${status.state}">
    ${imageTile(member.name)}
    <div class="build-unit__copy"><b>${esc(member.name)}</b><small>${esc(member.role || '')}</small></div>
    <span class="build-unit__req">${esc(requirement)}</span>
    <span class="history-dot history-dot--${status.state}" title="${esc(status.label)}"></span>
  </div>`;
}

function renderTeams() {
  let teams = character.teams.filter((team) => reactionFilter === 'all' || team.reaction === reactionFilter);
  if (historyOnly) teams = teams.filter((team) => teamHistoryStatus(team, ownership).fullyVerified);
  const maxDps = Math.max(...character.teams.map((team) => team.dps));

  if (!teams.length) {
    $('#teams').innerHTML = `<div class="build-empty"><b>No fully verified team matches this filter.</b><span>Try “All” or remember that missing wish-history records are treated as Unknown, not unowned.</span></div>`;
    return;
  }

  $('#teams').innerHTML = teams.map((team) => {
    const account = teamHistoryStatus(team, ownership);
    const accountLabel = account.fullyVerified
      ? 'All requirements seen in history'
      : `${account.verified}/${team.members.length} members verified${account.short ? ` · ${account.short} constellation short` : ''}`;
    return `<article class="build-team ${team.rank === 1 ? 'build-team--best' : ''}">
      <div class="build-team__rank"><b>#${team.rank}</b><span>${esc(team.reaction)}</span></div>
      <div class="build-team__body">
        <div class="build-team__title">
          <div><h3>${esc(team.name)}</h3><p>${esc(team.note)}</p></div>
          <div class="build-dps"><strong>${fmt.format(team.dps)}</strong><span>DPS</span></div>
        </div>
        <div class="build-units">${team.members.map(memberCard).join('')}</div>
        <div class="build-meter"><i style="width:${Math.max(8, team.dps / maxDps * 100)}%"></i></div>
        <div class="build-team__foot"><span>${team.relative}% of #1</span><span>Cost index ${team.cost}</span><span class="account-fit ${account.fullyVerified ? 'account-fit--yes' : ''}">${esc(accountLabel)}</span></div>
      </div>
    </article>`;
  }).join('');
  hydrateIcons($('#teams'));
}

function variantMember(name) {
  const status = characterHistoryStatus(name, ownership);
  return `<span class="variant-member variant-member--${status.state}">${esc(name)}<i title="${esc(status.label)}"></i></span>`;
}

function renderVariants() {
  $('#variants').innerHTML = character.variants.map((variant) => `
    <article class="build-variant">
      <span class="reaction-pill">${esc(variant.reaction)}</span>
      <h3>${variant.members.map(variantMember).join('<span class="member-sep">·</span>')}</h3>
      <p>${esc(variant.note)}</p>
      <small>Guide-backed variant · no comparable DPS number assigned</small>
    </article>`).join('');
}

function renderWeapons() {
  $('#weapons').innerHTML = character.weapons.map((weapon) => {
    const singleName = weapon.name.includes(' / ') ? null : weapon.name;
    const history = singleName ? weaponHistoryStatus(singleName, ownership) : null;
    return `<article class="build-list-row">
      <span class="build-list-rank">${weapon.rank}</span>
      ${imageTile(singleName || weapon.name.split(' / ')[0], 'Weapon', 'weapon')}
      <div class="build-list-copy"><h3>${esc(weapon.name)} <small>${esc(weapon.refinement)}</small></h3><p>${esc(weapon.note)}</p>${history?.state === 'verified' ? `<span class="equipment-owned">${esc(history.label)}</span>` : ''}</div>
      <div class="build-list-score"><strong>${esc(weapon.range)}</strong><span>${esc(weapon.tier)}</span></div>
    </article>`;
  }).join('');
  hydrateIcons($('#weapons'));
}

function renderArtifacts() {
  $('#artifacts').innerHTML = character.artifacts.map((artifact) => `
    <article class="artifact-card ${artifact.rank === 1 ? 'artifact-card--best' : ''}">
      <header><span>#${artifact.rank}</span><div><h3>${esc(artifact.name)}</h3><p>${esc(artifact.pieces)} · ${esc(artifact.label)}</p></div></header>
      ${artifact.relativeTeam != null ? `<div class="artifact-metrics"><span><b>${artifact.relativeTeam}%</b> team DPS</span><span><b>${artifact.relativePersonal}%</b> personal</span></div>` : ''}
      <p>${esc(artifact.note)}</p>
    </article>`).join('');

  $('#stats').innerHTML = `
    <h3>Recommended stats</h3>
    <div><b>Main stats</b><span>${character.stats.main.map(esc).join(' · ')}</span></div>
    <div><b>Substats</b><span>${character.stats.sub.map(esc).join(' > ')}</span></div>
    <p>${esc(character.stats.alternativeCirclet)}</p>
    ${character.stats.notes.map((note) => `<p>${esc(note)}</p>`).join('')}`;
}

function renderMethod() {
  $('#assumptions').innerHTML = character.assumptions.map((item) => `<li>${esc(item)}</li>`).join('');
  $('#sources').innerHTML = character.sources.map((source) => `
    <a class="build-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">
      <span><b>${esc(source.label)}</b><small>${esc(source.use)}</small></span><i aria-hidden="true">↗</i>
    </a>`).join('');
}

function renderAll() {
  ownership = analyzeGenshinOwnership(getData());
  renderProfilePicker();
  renderCharacterPicker();
  renderHero();
  renderAccountInsight();
  renderTeams();
  renderVariants();
  renderWeapons();
  renderArtifacts();
  renderMethod();
}

$('#build-profile-select').addEventListener('change', (event) => {
  switchProfile(event.target.value);
  renderAll();
});

$('#character-select').addEventListener('change', (event) => {
  character = getBuildCharacter(event.target.value);
  const url = new URL(location.href);
  url.searchParams.set('character', character.id);
  history.replaceState(null, '', url);
  reactionFilter = 'all';
  historyOnly = false;
  document.querySelectorAll('[data-reaction]').forEach((button) => button.classList.toggle('team-filter--on', button.dataset.reaction === 'all'));
  renderAll();
});

document.querySelectorAll('[data-reaction]').forEach((button) => {
  button.addEventListener('click', () => {
    reactionFilter = button.dataset.reaction;
    document.querySelectorAll('[data-reaction]').forEach((other) => other.classList.toggle('team-filter--on', other === button));
    renderTeams();
  });
});

$('#history-filter').addEventListener('click', () => {
  historyOnly = !historyOnly;
  $('#history-filter').classList.toggle('team-filter--on', historyOnly);
  renderTeams();
});

renderAll();
