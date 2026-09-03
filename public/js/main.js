// js/main.js
import { GAMES, GENSHIN_BANNERS, wuwaBanner, wuwaBannersFor, iconCandidates, setManifest, LINK_GUIDES } from './config.js?v=20260903a';
import {
  analyze,
  clearAll,
  createProfile,
  deleteProfile,
  exportProfilesBackup,
  getActiveProfile,
  getData,
  getProfiles,
  renameProfile,
  replaceAll,
  replaceProfilesBackup,
  switchProfile,
} from './store.js?v=20260824f';
import { importGenshin, importWuwa } from './import.js?v=20260824f';
import { driveEnabled, driveSave, driveLoad } from './drive.js?v=20260824f';
import { exportGenshinXlsx, exportWuwaJson, exportFullBackup, importFromFile } from './files.js?v=20260824f';
import { filterHighlights } from './highlight-view.js?v=20260824g';

let currentGame = 'genshin';
const selectedBanner = { genshin: null, wuwa: null };

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const viewState = {
  recentRarity: 5,
  recentOrder: 'newest',
  historyPage: 1,
  historyPageSize: 10,
  historySearch: '',
  historyRarityFilter: 0,
};
let profileEditorMode = 'create';
let profileActionsLocked = false;

function profileInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'P';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

function pullLabel(count) {
  return `${Number(count || 0).toLocaleString()} ${count === 1 ? 'pull' : 'pulls'}`;
}

function renderProfiles() {
  const active = getActiveProfile();
  const profiles = getProfiles();
  const initials = profileInitials(active.name);
  $('#profile-name').textContent = active.name;
  $('#profile-avatar').textContent = initials;
  $('#panel-profile-name').textContent = active.name;
  $('#panel-profile-avatar').textContent = initials;
  $('#panel-profile-count').textContent = pullLabel(active.pullCount);
  $('#profile-btn').disabled = profileActionsLocked;
  $('#profile-new').disabled = profileActionsLocked;
  $('#profile-create').disabled = profileActionsLocked;
  $('#profile-rename').disabled = profileActionsLocked;
  $('#profile-delete').disabled = profileActionsLocked || profiles.length <= 1;

  $('#profile-list').innerHTML = profiles.map((profile) => `
    <button class="profile-row ${profile.id === active.id ? 'profile-row--on' : ''}" type="button" role="menuitem" data-profile-id="${esc(profile.id)}">
      <span class="profile-avatar" aria-hidden="true">${esc(profileInitials(profile.name))}</span>
      <span class="profile-row__copy"><b>${esc(profile.name)}</b><small>${esc(pullLabel(profile.pullCount))}</small></span>
      <span class="profile-row__check" aria-hidden="true">✓</span>
    </button>`).join('');

  $('#profile-list').querySelectorAll('[data-profile-id]').forEach((button) => {
    button.addEventListener('click', () => selectProfile(button.dataset.profileId));
  });
}

function lockProfileActions(locked) {
  profileActionsLocked = locked;
  if (locked) closeProfileMenu();
  renderProfiles();
}

function resetProfileView() {
  selectedBanner.genshin = null;
  selectedBanner.wuwa = null;
  viewState.historyPage = 1;
  viewState.historySearch = '';
  viewState.historyRarityFilter = 0;
  $('#url-input').value = '';
}

function closeProfileMenu() {
  $('#profile-menu').classList.remove('profile-menu--on');
  $('#profile-btn').setAttribute('aria-expanded', 'false');
}

function toggleProfileMenu() {
  const open = !$('#profile-menu').classList.contains('profile-menu--on');
  $('#profile-menu').classList.toggle('profile-menu--on', open);
  $('#profile-btn').setAttribute('aria-expanded', String(open));
}

function selectProfile(id) {
  const profile = switchProfile(id);
  resetProfileView();
  renderProfiles();
  renderBanners();
  closeProfileMenu();
  setStatus(`Switched to ${profile.name}.`, 'ok');
}

function openProfileEditor(mode) {
  profileEditorMode = mode;
  const editing = mode === 'rename';
  const active = getActiveProfile();
  $('#profile-editor-title').textContent = editing ? 'Rename profile' : 'New profile';
  $('#profile-editor-lead').textContent = editing
    ? 'Change the label shown in your profile switcher.'
    : 'Create a separate space for another account’s pulls.';
  $('#profile-editor-save').textContent = editing ? 'Save name' : 'Create profile';
  $('#profile-name-input').value = editing ? active.name : '';
  $('#profile-editor').classList.add('panel--on');
  closeProfileMenu();
  requestAnimationFrame(() => $('#profile-name-input').focus());
}

function closeProfileEditor() {
  $('#profile-editor').classList.remove('panel--on');
}

function saveProfileEditor(event) {
  event.preventDefault();
  const name = $('#profile-name-input').value.trim();
  if (!name) return;

  if (profileEditorMode === 'rename') {
    const profile = renameProfile(getActiveProfile().id, name);
    renderProfiles();
    setPanelMsg(`Renamed profile to ${profile.name}.`, 'ok');
  } else {
    const profile = createProfile(name);
    resetProfileView();
    renderProfiles();
    renderBanners();
    setStatus(`${profile.name} is ready for imports.`, 'ok');
    setPanelMsg(`Created ${profile.name}.`, 'ok');
  }
  closeProfileEditor();
}

function deleteCurrentProfile() {
  const active = getActiveProfile();
  if (!confirm(`Delete “${active.name}” and all ${pullLabel(active.pullCount)} stored in it? This cannot be undone.`)) return;
  const next = deleteProfile(active.id);
  resetProfileView();
  renderProfiles();
  renderBanners();
  closeProfileMenu();
  setPanelMsg(`Deleted ${active.name}. Switched to ${next.name}.`, 'ok');
}

function setGame(game) {
  currentGame = game;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab--on', t.dataset.game === game));
  document.body.dataset.game = game;
  $('#url-input').value = '';
  $('#url-input').placeholder =
    game === 'genshin'
      ? 'Paste your Genshin wish-history URL (https://public-operation-hk4e...)'
      : 'Paste your Wuthering Waves convene URL (https://aki-gm-resources...)';
  renderBanners();
}

function gameBanners() {
  if (currentGame === 'genshin') return GENSHIN_BANNERS;
  const data = getData().wuwa || {};
  const withPulls = wuwaBannersFor(data);
  return withPulls.length ? withPulls : ['1', '2', '3', '4'].map(wuwaBanner);
}

function renderBanners() {
  const wrap = $('#banners');
  const game = GAMES[currentGame];
  const data = getData()[currentGame];
  const banners = gameBanners();
  const firstWithPulls = banners.find((b) => (data[b.key] || []).length);
  const selectedExists = banners.some((b) => String(b.key) === String(selectedBanner[currentGame]));

  if (!selectedExists) selectedBanner[currentGame] = (firstWithPulls || banners[0]).key;
  const selected = banners.find((b) => String(b.key) === String(selectedBanner[currentGame])) || banners[0];
  const selectedPulls = data[selected.key] || [];

  wrap.innerHTML = `
    <section class="tracker-shell">
      <aside class="banner-rail" aria-label="${esc(game.label)} banners">
        <div class="banner-rail__head"><span>Banners</span><small>${banners.length} tracked</small></div>
        ${banners.map((b) => bannerOption(b, data[b.key] || [], String(b.key) === String(selected.key))).join('')}
      </aside>
      <section class="tracker-view">
        ${selectedPulls.length ? selectedDashboard(selected, selectedPulls) : emptyDashboard(game, selected)}
      </section>
    </section>
  `;

  wrap.querySelectorAll('.banner-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedBanner[currentGame] = btn.dataset.banner;
      viewState.historyPage = 1;
      renderBanners();
    });
  });

  bindDashboardControls(selected.key, selectedPulls);
}

function emptyDashboard(game, banner) {
  return `
    <div class="empty tracker-empty">
      <div class="empty__star">&#10022;</div>
      <p>No ${game.currency} imported yet for ${esc(banner.name)}.</p>
      <p class="empty__hint">Paste your link above and hit <b>Import new pulls</b>, or drop a file in <b>Data</b>.</p>
    </div>`;
}

function bannerOption(banner, pulls, active) {
  const a = analyze(pulls);
  const pct = Math.min(100, Math.round((a.currentPity / banner.hardPity) * 100));
  return `
    <button class="banner-option ${active ? 'banner-option--on' : ''}" data-banner="${esc(banner.key)}" aria-pressed="${active}">
      <span class="banner-option__pity">${a.currentPity}/${banner.hardPity}</span>
      <span class="banner-option__label">5&#9733; Pity</span>
      <span class="banner-option__pity banner-option__pity--four">${a.current4Pity}/10</span>
      <span class="banner-option__label banner-option__label--four">4&#9733; Pity</span>
      <span class="banner-option__name">${esc(banner.name)}</span>
      <span class="banner-option__bar"><span style="width:${pct}%"></span></span>
      ${bannerHero(pulls, banner.key)}
    </button>`;
}

function bannerHero(pulls, bannerKey) {
  const featured = pulls.slice().reverse().find((p) => p.rarity >= 5) || pulls[pulls.length - 1];
  if (!featured) return '<span class="banner-option__ghost">&#10022;</span>';
  const cands = iconCandidates(currentGame, featured.name, featured.itemType, bannerKey);
  if (!cands.length) return `<span class="banner-option__ghost">${esc(monogram(featured.name))}</span>`;
  return `<img class="banner-option__art" alt="" loading="lazy" src="${esc(cands[0])}" data-cands="${esc(cands.join('|'))}" data-i="0" onerror="window.__iconFail(this)" />`;
}

function selectedDashboard(banner, pulls) {
  const a = analyze(pulls);
  const rows = pullRows(pulls);
  const fourRatio = pulls.length ? (a.count4 / pulls.length) * 100 : 0;
  const fiveRatio = pulls.length ? (a.count5 / pulls.length) * 100 : 0;
  const currencyName = currentGame === 'wuwa' ? 'Total Astrites' : 'Total Primogems';
  const recentTitle = currentGame === 'wuwa' ? 'Recent Convenes' : 'Recent Wishes';

  return `
    <div class="tracker-main">
      <div class="tracker-top">
        <article class="tracker-panel tracker-summary">
          <span class="panel-kicker">Banner overview</span>
          <h2>${esc(banner.name)}</h2>
          ${metricRow('Total Pulls', pulls.length.toLocaleString())}
          ${metricRow(currencyName, (pulls.length * 160).toLocaleString())}
          ${metricRow('5&#9733; Pulls', a.count5, 'gold')}
          ${metricRow('4&#9733; Pulls', a.count4, 'purple')}
        </article>

        <article class="tracker-panel luck-panel">
          <header><div><span class="panel-kicker">Your statistics</span><h2>5&#9733; Luck rating</h2></div><span class="luck-panel__spark">✦</span></header>
          ${luckRow('Average Pity', a.count5 ? a.avgPity.toFixed(2) : '-', a.count5 ? Math.max(8, 100 - a.avgPity) : 0)}
          ${luckRow('Pull Ratio', fiveRatio.toFixed(2) + '%', Math.min(100, fiveRatio * 30))}
          ${luckRow('4&#9733; Ratio', fourRatio.toFixed(2) + '%', Math.min(100, fourRatio * 4))}
        </article>
      </div>

      <article class="tracker-panel recent-panel">
        <header class="section-head">
          <div><span class="panel-kicker">Latest highlights</span><h2>${recentTitle}</h2></div>
          <div class="highlight-controls">
            <button class="order-toggle" data-recent-order type="button">${viewState.recentOrder === 'oldest' ? 'Oldest first ↑' : 'Newest first ↓'}</button>
            <div class="star-toggle">
              <button data-recent-rarity="4" class="${viewState.recentRarity === 4 ? 'star-toggle--on' : ''}">4 &#10022;</button>
              <button data-recent-rarity="5" class="${viewState.recentRarity === 5 ? 'star-toggle--on' : ''}">5 &#10022;</button>
            </div>
          </div>
        </header>
        <div class="recent-list" data-banner-key="${esc(banner.key)}">${renderRecentList(rows, banner.key)}</div>
      </article>
    </div>

    <article class="tracker-panel history-panel">
      <header class="section-head">
        <div><span class="panel-kicker">Complete archive</span><h2>Pull history</h2></div>
      </header>
      <div class="history-tools">
        <input class="history-search" type="text" placeholder="Search by name..." value="${esc(viewState.historySearch)}" autocomplete="off" spellcheck="false" />
        <div class="history-filters">
          <button data-rarity-filter="0" class="filter-btn ${viewState.historyRarityFilter === 0 ? 'filter-btn--on' : ''}">All</button>
          <button data-rarity-filter="5" class="filter-btn ${viewState.historyRarityFilter === 5 ? 'filter-btn--on' : ''}">5 &#10022;</button>
          <button data-rarity-filter="4" class="filter-btn ${viewState.historyRarityFilter === 4 ? 'filter-btn--on' : ''}">4 &#10022;</button>
          <button data-rarity-filter="3" class="filter-btn ${viewState.historyRarityFilter === 3 ? 'filter-btn--on' : ''}">3 &#10022;</button>
        </div>
      </div>
      <div class="history-table">
        <div class="history-row history-row--head">
          <span>Pull No.</span><span>Item Name</span><span>Pity</span><span>Date Received</span>
        </div>
        ${historyPageRows(filteredHistoryRows(rows)).map((r) => historyRow(r, banner.key)).join('')}
      </div>
      <footer class="panel-pager history-pager">
        ${renderHistoryPager(filteredHistoryRows(rows))}
      </footer>
    </article>`;
}

function bindDashboardControls(bannerKey, pulls) {
  const rows = pullRows(pulls);

  document.querySelectorAll('[data-recent-rarity]').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.recentRarity = Number(btn.dataset.recentRarity);
      document.querySelectorAll('[data-recent-rarity]').forEach((b) => {
        b.classList.toggle('star-toggle--on', Number(b.dataset.recentRarity) === viewState.recentRarity);
      });
      renderRecentSection(rows, bannerKey);
    });
  });

  const orderButton = $('[data-recent-order]');
  if (orderButton) {
    orderButton.addEventListener('click', () => {
      viewState.recentOrder = viewState.recentOrder === 'newest' ? 'oldest' : 'newest';
      orderButton.textContent = viewState.recentOrder === 'oldest' ? 'Oldest first ↑' : 'Newest first ↓';
      renderRecentSection(rows, bannerKey);
    });
  }

  document.querySelectorAll('[data-history-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fRows = filteredHistoryRows(rows);
      const max = historyMaxPage(fRows);
      const action = btn.dataset.historyPage;
      if (action === 'first') viewState.historyPage = 1;
      else if (action === 'prev') viewState.historyPage = Math.max(1, viewState.historyPage - 1);
      else if (action === 'next') viewState.historyPage = Math.min(max, viewState.historyPage + 1);
      else if (action === 'last') viewState.historyPage = max;
      renderHistoryPage(rows, bannerKey);
    });
  });

  const searchInput = $('.history-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      viewState.historySearch = searchInput.value;
      viewState.historyPage = 1;
      renderHistoryPage(rows, bannerKey);
    });
  }

  document.querySelectorAll('[data-rarity-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.historyRarityFilter = Number(btn.dataset.rarityFilter);
      document.querySelectorAll('[data-rarity-filter]').forEach((b) => {
        b.classList.toggle('filter-btn--on', Number(b.dataset.rarityFilter) === viewState.historyRarityFilter);
      });
      viewState.historyPage = 1;
      renderHistoryPage(rows, bannerKey);
    });
  });
}

function metricRow(label, value, tone = '') {
  return `<div class="metric-row metric-row--${tone}"><span>${label}</span><b>${esc(value)}</b></div>`;
}

function luckRow(label, value, pct) {
  return `
    <div class="luck-row">
      <div><span>${label}</span><b>${esc(value)}</b></div>
      <div class="luck-bar"><span style="width:${Math.min(100, Math.max(0, pct))}%"></span></div>
    </div>`;
}

function pullRows(pulls) {
  let since5 = 0;
  let since4 = 0;
  return pulls.map((p, i) => {
    since5++;
    since4++;
    const sourcePity = Number(p.sourcePity);
    const pity = p.rarity === 5 ? (sourcePity > 0 ? sourcePity : since5) : p.rarity === 4 ? (sourcePity > 0 ? sourcePity : since4) : '';
    const row = { ...p, pullNo: i + 1, pity };
    if (p.rarity === 5) {
      since5 = 0;
      since4 = 0;
    } else if (p.rarity === 4) {
      since4 = 0;
    }
    return row;
  }).reverse();
}

function filteredHistoryRows(rows) {
  let r = rows;
  if (viewState.historyRarityFilter) {
    r = r.filter((row) => Number(row.rarity) === viewState.historyRarityFilter);
  }
  const q = viewState.historySearch.trim().toLowerCase();
  if (q) r = r.filter((row) => String(row.name).toLowerCase().includes(q));
  return r;
}

function recentRows(rows) {
  return filterHighlights(rows, {
    rarity: viewState.recentRarity,
    order: viewState.recentOrder,
  });
}

function renderRecentList(rows, bannerKey) {
  const highlights = recentRows(rows);
  if (!highlights.length) return `<p class="muted empty-inline">No ${viewState.recentRarity}-star pulls on this banner yet.</p>`;
  return highlights.map((r) => recentBubble(r, bannerKey)).join('');
}

function renderRecentSection(rows, bannerKey) {
  const list = $('.recent-list');
  if (list) list.innerHTML = renderRecentList(rows, bannerKey);
}

function historyMaxPage(rows) {
  return Math.max(1, Math.ceil(rows.length / viewState.historyPageSize));
}

function historyPageRows(rows) {
  viewState.historyPage = Math.min(Math.max(1, viewState.historyPage), historyMaxPage(rows));
  const start = (viewState.historyPage - 1) * viewState.historyPageSize;
  return rows.slice(start, start + viewState.historyPageSize);
}

function renderHistoryPager(rows) {
  const total = rows.length;
  const max = historyMaxPage(rows);
  const start = total ? (viewState.historyPage - 1) * viewState.historyPageSize + 1 : 0;
  const end = Math.min(total, viewState.historyPage * viewState.historyPageSize);
  return `
    <span>Rows per page <b>${viewState.historyPageSize}</b></span>
    <span class="history-range">${start}-${end} of ${total}</span>
    <span class="pager-buttons">
      <button data-history-page="first" ${viewState.historyPage <= 1 ? 'disabled' : ''}>|&lt;</button>
      <button data-history-page="prev" ${viewState.historyPage <= 1 ? 'disabled' : ''}>&lt;</button>
      <button data-history-page="next" ${viewState.historyPage >= max ? 'disabled' : ''}>&gt;</button>
      <button data-history-page="last" ${viewState.historyPage >= max ? 'disabled' : ''}>&gt;|</button>
    </span>`;
}

function renderHistoryPage(rows, bannerKey) {
  const table = $('.history-table');
  const pager = $('.history-pager');
  const fRows = filteredHistoryRows(rows);
  if (table) {
    table.innerHTML = `
      <div class="history-row history-row--head">
        <span>Pull No.</span><span>Item Name</span><span>Pity</span><span>Date Received</span>
      </div>
      ${historyPageRows(fRows).map((r) => historyRow(r, bannerKey)).join('')}`;
  }
  if (pager) pager.innerHTML = renderHistoryPager(fRows);
  document.querySelectorAll('[data-history-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fr = filteredHistoryRows(rows);
      const max = historyMaxPage(fr);
      const action = btn.dataset.historyPage;
      if (action === 'first') viewState.historyPage = 1;
      else if (action === 'prev') viewState.historyPage = Math.max(1, viewState.historyPage - 1);
      else if (action === 'next') viewState.historyPage = Math.min(max, viewState.historyPage + 1);
      else if (action === 'last') viewState.historyPage = max;
      renderHistoryPage(rows, bannerKey);
    });
  });
}

function recentBubble(row, bannerKey) {
  const cands = iconCandidates(currentGame, row.name, row.itemType, bannerKey);
  const img = cands.length
    ? `<img alt="" loading="lazy" src="${esc(cands[0])}" data-cands="${esc(cands.join('|'))}" data-i="0" onerror="window.__iconFail(this)" />`
    : `<span>${esc(monogram(row.name))}</span>`;
  return `
    <figure class="recent-pull recent-pull--r${row.rarity}" title="${esc(row.name)}">
      ${img}
      <figcaption>${esc(row.pity || '')}</figcaption>
    </figure>`;
}

function historyRow(row, bannerKey) {
  const cands = iconCandidates(currentGame, row.name, row.itemType, bannerKey);
  const img = cands.length
    ? `<img alt="" loading="lazy" src="${esc(cands[0])}" data-cands="${esc(cands.join('|'))}" data-i="0" onerror="window.__iconFail(this)" />`
    : `<span class="history-mono">${esc(monogram(row.name))}</span>`;
  const tone = row.rarity === 5 ? 'gold' : row.rarity === 4 ? 'purple' : '';
  return `
    <div class="history-row">
      <span>${row.pullNo}</span>
      <span class="history-name history-name--${tone}">${img}<b>${esc(row.name)}</b></span>
      <span>${esc(row.pity || '')}</span>
      <span>${esc(row.time || '')}</span>
    </div>`;
}

function tile(f, rarity, bannerKey = '') {
  const game = currentGame;
  const lucky = rarity === 5 && f.pity <= 50 ? 'lucky' : rarity === 5 && f.pity >= 75 ? 'late' : '';
  const isWuwaWeaponPool = game === 'wuwa' && ['2', '4', '11', '13'].includes(String(bannerKey));
  const isWeapon = game === 'wuwa'
    ? (/^(weapon|sword|broadblade|pistols|gauntlets|rectifier)$/i.test(f.itemType || '') || isWuwaWeaponPool)
    : /weapon/i.test(f.itemType || '');
  const cands = iconCandidates(game, f.name, f.itemType, bannerKey);
  const mono = monogram(f.name);
  const mark = isWeapon ? SVG_SWORD : SVG_STAR;
  const imgAttrs = cands.length
    ? `src="${esc(cands[0])}" data-cands="${esc(cands.join('|'))}" data-i="0"
       onload="this.classList.add('is-on');var m=this.previousElementSibling;if(m)m.style.visibility='hidden'"
       onerror="window.__iconFail(this)"`
    : 'style="display:none"';
  return `
    <figure class="tile tile--r${rarity}" title="${esc(f.name)}${f.time ? ' - ' + esc(f.time) : ''}">
      <div class="tile__art">
        <span class="tile__mono">${esc(mono)}</span>
        <img class="tile__img" alt="" loading="lazy" ${imgAttrs} />
        <span class="tile__type">${mark}</span>
        <span class="tile__pity tile__pity--${lucky}">${f.pity}</span>
      </div>
      <figcaption class="tile__name">${esc(f.name)}</figcaption>
    </figure>`;
}

window.__iconFail = function (img) {
  const cands = (img.dataset.cands || '').split('|').filter(Boolean);
  const next = (parseInt(img.dataset.i, 10) || 0) + 1;
  if (next < cands.length) {
    img.dataset.i = String(next);
    img.src = cands[next];
  } else {
    img.remove();
  }
};

const SVG_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.2 7.2L21.5 12l-7.3 2.8L12 22l-2.2-7.2L2.5 12l7.3-2.8z"/></svg>';
const SVG_SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 3h-4.5l-7.2 7.2 4.5 4.5L20 7.5V3zM8.4 13.1l-1.5-1.5-2.4 2.4 1 1-1.8 1.8 1.4 1.4 1.8-1.8 1 1 2.4-2.4-1.5-1.5z"/></svg>';

function monogram(name) {
  const words = String(name).trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return String(name).trim().slice(0, 2).toUpperCase();
}

async function runImport() {
  const btn = $('#import-btn');
  const url = $('#url-input').value.trim();
  if (!url) return setStatus('Paste your link first.', 'warn');

  btn.disabled = true;
  lockProfileActions(true);
  setStatus('Starting...', 'busy');
  try {
    const fn = currentGame === 'genshin' ? importGenshin : importWuwa;
    const { totalNew, perBanner } = await fn(url, (msg) => setStatus(msg, 'busy'));
    renderProfiles();
    renderBanners();
    if (totalNew === 0) {
      setStatus('Up to date - no new pulls found.', 'ok');
    } else {
      const parts = Object.entries(perBanner).filter(([, n]) => n > 0)
        .map(([, n]) => `${n} new`).join(' - ');
      setStatus(`Imported ${totalNew} new ${totalNew === 1 ? 'pull' : 'pulls'}. ${parts ? '(' + parts + ')' : ''}`, 'ok');
    }
  } catch (err) {
    // WuWa commits each successful pool as it arrives, so show partial progress even
    // if a later pool request fails.
    renderProfiles();
    renderBanners();
    setStatus(err.message || String(err), 'err');
  } finally {
    btn.disabled = false;
    lockProfileActions(false);
  }
}

function setStatus(msg, kind = '') {
  const s = $('#status');
  s.textContent = msg;
  s.className = 'status' + (kind ? ' status--' + kind : '');
}

function openPanel() { renderProfiles(); $('#panel').classList.add('panel--on'); }
function closePanel() { $('#panel').classList.remove('panel--on'); }

function doExport(fn, okMsg) {
  try {
    const n = fn();
    setPanelMsg(typeof n === 'number' ? `${okMsg} (${n} pulls).` : okMsg, 'ok');
  } catch (e) {
    setPanelMsg(e.message, 'err');
  }
}

async function handleFile(file) {
  setPanelMsg(`Reading ${file.name}...`, 'busy');
  lockProfileActions(true);
  try {
    const res = await importFromFile(file);
    if (res.restoredProfiles) resetProfileView();
    renderProfiles();
    renderBanners();
    if (res.restoredProfiles) {
      setPanelMsg(`Restored ${res.restoredProfiles} ${res.restoredProfiles === 1 ? 'profile' : 'profiles'}.`, 'ok');
    } else if (res.restored) {
      setPanelMsg('Full backup restored.', 'ok');
    } else if (res.added === 0) {
      setPanelMsg(`${res.source || res.game}: no pulls found in that file.`, 'warn');
    } else {
      setPanelMsg(`${res.source || res.game}: loaded ${res.added} ${res.added === 1 ? 'pull' : 'pulls'} from the file.`, 'ok');
    }
  } catch (e) {
    setPanelMsg(e.message, 'err');
  } finally {
    lockProfileActions(false);
  }
}

async function driveBackup() {
  setPanelMsg('Connecting to Google Drive...', 'busy');
  try {
    const res = await driveSave(exportProfilesBackup());
    setPanelMsg(`Backed up every profile to Google Drive (${res}).`, 'ok');
  } catch (e) {
    setPanelMsg('Drive error: ' + e.message, 'err');
  }
}

async function driveRestore() {
  setPanelMsg('Reading from Google Drive...', 'busy');
  try {
    const obj = await driveLoad();
    if (!obj) return setPanelMsg('No backup found in your Drive yet.', 'warn');
    let message = 'Restored the current profile from Google Drive.';
    if (obj.type === 'gacha-tracker-profiles-backup' && obj.profiles) {
      const count = replaceProfilesBackup(obj);
      message = `Restored ${count} ${count === 1 ? 'profile' : 'profiles'} from Google Drive.`;
    } else {
      replaceAll(obj);
    }
    resetProfileView();
    renderProfiles();
    renderBanners();
    setPanelMsg(message, 'ok');
  } catch (e) {
    setPanelMsg('Drive error: ' + e.message, 'err');
  }
}

function setPanelMsg(msg, kind = '') {
  const m = $('#panel-msg');
  m.textContent = msg;
  m.className = 'status' + (kind ? ' status--' + kind : '');
}

function setupPageDrop() {
  const overlay = $('#drop-overlay');
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.classList.add('drop-overlay--on');
  });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) overlay.classList.remove('drop-overlay--on');
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    overlay.classList.remove('drop-overlay--on');
    const f = e.dataTransfer.files[0];
    if (f) { openPanel(); handleFile(f); }
  });
}

function renderHelp() {
  const order = currentGame === 'wuwa' ? ['wuwa', 'genshin'] : ['genshin', 'wuwa'];
  $('#help-body').innerHTML = order.map((g) => {
    const h = LINK_GUIDES[g];
    const steps = h.steps.map((s) => `<li>${esc(s)}</li>`).join('');
    return `
      <section class="guide ${g === currentGame ? 'guide--on' : ''}">
        <h3>${esc(h.label)}</h3>
        <ol class="guide__steps">${steps}</ol>
        <div class="code">
          <pre><code id="code-${g}">${esc(h.script)}</code></pre>
          <button class="btn btn--line code__copy" data-copy="${g}">Copy</button>
        </div>
        <p class="guide__after">${esc(h.after)}</p>
        <p class="muted guide__credit">${esc(h.credit)}</p>
      </section>`;
  }).join('');

  $('#help-body').querySelectorAll('.code__copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = LINK_GUIDES[btn.dataset.copy].script;
      try {
        await navigator.clipboard.writeText(text);
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => (btn.textContent = old), 1400);
      } catch {
        const range = document.createRange();
        range.selectNodeContents($(`#code-${btn.dataset.copy}`));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Press Ctrl+C';
      }
    });
  });
}

function openHelp() { renderHelp(); $('#help-panel').classList.add('panel--on'); }
function closeHelp() { $('#help-panel').classList.remove('panel--on'); }

function init() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setGame(t.dataset.game)));
  $('#import-btn').addEventListener('click', runImport);
  $('#url-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') runImport(); });

  $('#help-btn').addEventListener('click', openHelp);
  $('#help-close').addEventListener('click', closeHelp);
  $('#help-panel').addEventListener('click', (e) => { if (e.target.id === 'help-panel') closeHelp(); });

  $('#profile-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
  $('#profile-menu').addEventListener('click', (e) => e.stopPropagation());
  $('#profile-new').addEventListener('click', () => openProfileEditor('create'));
  $('#profile-create').addEventListener('click', () => openProfileEditor('create'));
  $('#profile-rename').addEventListener('click', () => openProfileEditor('rename'));
  $('#profile-delete').addEventListener('click', deleteCurrentProfile);
  $('#profile-form').addEventListener('submit', saveProfileEditor);
  $('#profile-editor-close').addEventListener('click', closeProfileEditor);
  $('#profile-editor-cancel').addEventListener('click', closeProfileEditor);
  $('#profile-editor').addEventListener('click', (e) => { if (e.target.id === 'profile-editor') closeProfileEditor(); });
  document.addEventListener('click', closeProfileMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeProfileMenu(); closeProfileEditor(); } });

  $('#data-btn').addEventListener('click', openPanel);
  $('#panel-close').addEventListener('click', closePanel);
  $('#panel').addEventListener('click', (e) => { if (e.target.id === 'panel') closePanel(); });

  $('#export-genshin').addEventListener('click', () => doExport(exportGenshinXlsx, 'Genshin .xlsx downloaded'));
  $('#export-wuwa').addEventListener('click', () => doExport(exportWuwaJson, 'Wuthering Waves .json downloaded'));
  $('#export-all').addEventListener('click', () => doExport(() => { exportFullBackup(); }, 'Full backup downloaded'));

  const fileInput = $('#file-input');
  $('#pick-file').addEventListener('click', () => fileInput.click());
  $('#dropzone').addEventListener('click', (e) => { if (e.target.closest('#pick-file')) return; });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; });

  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dropzone--over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('dropzone--over')));
  dz.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { openPanel(); handleFile(f); } });

  setupPageDrop();

  const driveOk = driveEnabled();
  $('#drive-save').disabled = !driveOk;
  $('#drive-load').disabled = !driveOk;
  if (!driveOk) $('#drive-note').textContent = 'Add a Google OAuth client ID in js/config.js to enable Drive sync.';
  $('#drive-save').addEventListener('click', driveBackup);
  $('#drive-load').addEventListener('click', driveRestore);

  $('#clear-data').addEventListener('click', () => {
    const profile = getActiveProfile();
    if (confirm(`Delete all pulls stored in “${profile.name}”? Other profiles will not be affected.`)) {
      clearAll();
      renderProfiles();
      renderBanners();
      setPanelMsg(`Cleared all pulls from ${profile.name}.`, 'ok');
    }
  });

  renderProfiles();
  loadIconSources().finally(() => setGame('genshin'));
}

async function loadIconSources() {
  await Promise.all(['genshin', 'wuwa'].map(async (g) => {
    try {
      const res = await fetch(`icons/${g}/manifest.json`, { cache: 'no-cache' });
      if (res.ok) setManifest(g, await res.json());
    } catch {
      // Optional local manifests are allowed to be missing.
    }
  }));
}

document.addEventListener('DOMContentLoaded', init);
