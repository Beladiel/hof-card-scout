(() => {
  'use strict';

  const Core = window.SummonerScoutCore;
  const KEY = 'summoner-scout.review.v2';
  const LEGACY_KEY = 'summoner-scout.review.v1';
  const RECOVERY_KEY = `${KEY}.recovery`;
  const PAGE_NAMES = { home: 'Home', toa: 'ToA', dungeons: 'Dungeons', storage: 'Storage', find: 'Find It' };
  const GUIDES = [
    { id: 'summoners-way', title: "Summoner's Way", steps: ['Return to your island.', 'Tap the Summoner’s Way icon on the island interface.'], reviewed: '2026-11-15' },
    { id: 'monster-menu', title: 'Monster menu', steps: ['Return to your island.', 'Tap Monster in the main island menu.'], reviewed: '2026-11-15' },
    { id: 'sealed-shrine', title: 'Normal Monster Sealed Shrine', steps: ['On your island, tap the Sealed Shrine building.', 'Choose the Normal tab.'], reviewed: '2026-11-15' },
    { id: 'profile-records', title: 'Profile records', steps: ["On your island, open Summoner's Tower.", 'Choose Profile to view records.'], reviewed: '2026-11-15' },
    { id: 'dragons-lair', title: "Dragon's Lair", steps: ['Open Battle.', 'Choose Cairos Dungeon.', 'Choose Dragon’s Lair and select a difficulty.'], reviewed: '2026-11-15' },
    { id: 'toa', title: 'Trial of Ascension', steps: ['Open Battle.', 'Choose Trial of Ascension.', 'Select Normal or Hard.'], reviewed: '2026-11-15' },
  ];

  let page = 'home';
  let toaMode = 'Hard';
  let pendingImport = null;
  let loadWarning = '';
  let guideSearch = '';
  let guideDrafts = {};
  let dungeonFilter = { dungeon: '', difficulty: '', team: '' };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function readJson(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }

  function initialState() {
    try {
      const current = readJson(KEY);
      if (current) return Core.normalizeImport(current);
      const legacy = readJson(LEGACY_KEY);
      if (legacy) return Core.normalizeImport(legacy);
      return Core.createDemoState();
    } catch (error) {
      try {
        const recovery = readJson(RECOVERY_KEY);
        if (recovery) {
          loadWarning = `Stored data was invalid. A valid recovery copy was loaded instead. ${error.message}`;
          return Core.normalizeImport(recovery);
        }
      } catch (_) {}
      loadWarning = `Stored data was invalid and could not be loaded. Fictional demo data is shown. Your invalid record was not overwritten. ${error.message}`;
      return Core.createDemoState();
    }
  }

  let state = initialState();
  guideDrafts = { ...state.guideNotes };

  function showNotice(message, actionLabel, action) {
    const notice = document.querySelector('#notice');
    notice.replaceChildren();
    const text = document.createElement('span');
    text.textContent = message;
    notice.append(text);
    if (actionLabel && action) {
      const button = document.createElement('button');
      button.className = 'ghost';
      button.textContent = actionLabel;
      button.addEventListener('click', action);
      notice.append(' ', button);
    }
    notice.hidden = false;
  }

  function toast(message, isError = false) {
    const element = document.querySelector('#toast');
    element.textContent = message;
    element.style.background = isError ? '#f28b82' : '#7dd9ae';
    element.classList.add('show');
    window.setTimeout(() => element.classList.remove('show'), 2400);
  }

  function saveState(message = 'Saved locally') {
    const validation = Core.validateState(state);
    if (!validation.valid) {
      showNotice(`Save blocked because the data is inconsistent: ${validation.errors[0]}`, 'Open backup tools', () => document.querySelector('#backup-dialog').showModal());
      return false;
    }
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(state));
      toast(message);
      return true;
    } catch (error) {
      showNotice('This browser could not save your changes. Export a backup before closing the app.', 'Export backup', exportBackup);
      toast('Save failed', true);
      return false;
    }
  }

  function percent(value, total) {
    return total ? Math.min(100, Math.max(0, value / total * 100)) : 0;
  }

  function render() {
    document.querySelectorAll('[data-page]').forEach(button => {
      const active = button.dataset.page === page;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    document.querySelector('#page-title').textContent = PAGE_NAMES[page];
    const main = document.querySelector('#main');
    main.innerHTML = `<p class="warning review-banner"><strong>PUBLIC REVIEW BUILD</strong> — All visible records are fictional demonstration data. Changes stay only in this browser.</p>${({ home: renderHome, toa: renderToa, dungeons: renderDungeons, storage: renderStorage, find: renderFind })[page]()}`;
    bindPage();
    main.focus({ preventScroll: true });
    if (loadWarning) {
      showNotice(loadWarning, localStorage.getItem(RECOVERY_KEY) ? 'Open recovery tools' : 'Export current data', () => document.querySelector('#backup-dialog').showModal());
      loadWarning = '';
    }
  }

  function renderHome() {
    const totalFree = Object.values(state.storage).reduce((sum, item) => sum + item.capacity - item.count, 0);
    const regularFree = state.storage.regular.capacity - state.storage.regular.count;
    const mode = state.toa[toaMode];
    return `<div class="grid">
      <section class="card span8 hero"><div class="eyebrow">WHAT SHOULD I DO NEXT?</div><h2>${mode.current < mode.target ? `Push ToA ${toaMode} toward floor ${mode.target}` : 'Log a comparable dungeon farming set'}</h2><p>This suggestion comes from your saved targets, not live game data.</p><button class="primary" data-go="${mode.current < mode.target ? 'toa' : 'dungeons'}">Open tracker</button></section>
      <section class="card span4"><div class="eyebrow">PLAY STYLE</div><h2>PvE • Free to play</h2><p>Collecting, dungeons, ToA, Rift and achievements. PvP only when required.</p></section>
      <section class="card span4"><h3>ToA ${toaMode}</h3><div class="metric">Floor ${mode.current}</div><p>Historical best ${mode.best} · Target ${mode.target}</p><div class="progress"><span style="width:${percent(mode.current, mode.target)}%"></span></div></section>
      <section class="card span4"><h3>Regular inventory</h3><div class="metric">${regularFree} free</div><p>Available slots for immediately active monsters.</p></section>
      <section class="card span4"><h3>All tracked spaces</h3><div class="metric">${totalFree} free</div><p>Total free slots across inventory, storage and shrine.</p></section>
    </div>`;
  }

  function renderToa() {
    const record = state.toa[toaMode];
    return `<section class="card"><div class="row between"><div><div class="eyebrow">ROTATION PROGRESS</div><h2>Trial of Ascension</h2></div><label>Difficulty<select id="toa-mode">${Core.MODES.map(mode => `<option ${mode === toaMode ? 'selected' : ''}>${mode}</option>`).join('')}</select></label></div>
      <form id="toa-form" class="form-grid">
        <label>Current floor<input name="current" type="number" min="0" max="100" value="${record.current}"></label>
        <label>Historical best<input name="best" type="number" min="0" max="100" value="${record.best}"></label>
        <label>Next milestone<input name="target" type="number" min="1" max="100" value="${record.target}"></label>
        <label class="wide">Team notes<textarea name="notes" maxlength="2000">${escapeHtml(record.notes)}</textarea></label>
        <div class="wide"><div class="progress"><span style="width:${percent(record.current, record.target)}%"></span></div><p>${Math.max(0, record.target - record.current)} floors to the next milestone. Rotation resets never change historical best.</p><div class="row"><button class="primary">Save ${toaMode}</button><button type="button" id="reset-toa" class="ghost">Reset current rotation</button></div></div>
      </form></section>`;
  }

  function distinct(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function ensureDungeonFilter() {
    const dungeons = distinct(state.runs.map(run => run.dungeon));
    if (!dungeons.includes(dungeonFilter.dungeon)) dungeonFilter.dungeon = dungeons[0] || '';
    const difficulties = distinct(state.runs.filter(run => run.dungeon === dungeonFilter.dungeon).map(run => run.difficulty));
    if (!difficulties.includes(dungeonFilter.difficulty)) dungeonFilter.difficulty = difficulties[0] || '';
    const teams = distinct(state.runs.filter(run => run.dungeon === dungeonFilter.dungeon && run.difficulty === dungeonFilter.difficulty).map(run => run.team));
    if (dungeonFilter.team && !teams.includes(dungeonFilter.team)) dungeonFilter.team = '';
    return { dungeons, difficulties, teams };
  }

  function optionList(values, current, allLabel) {
    const all = allLabel ? `<option value="">${allLabel}</option>` : '';
    return all + values.map(value => `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function renderDungeons() {
    const { dungeons, difficulties, teams } = ensureDungeonFilter();
    const stats = Core.calculateStats(state.runs, dungeonFilter, state.historicalBest);
    const comparable = state.runs.filter(run => run.dungeon === dungeonFilter.dungeon && run.difficulty === dungeonFilter.difficulty && (!dungeonFilter.team || run.team === dungeonFilter.team));
    return `<section class="card"><div class="row between"><div><div class="eyebrow">COMPARABLE BATTLES</div><h2>Dungeon performance</h2></div><button id="add-run" class="primary">Log run</button></div>
      <div class="toolbar-grid"><label>Dungeon<select id="filter-dungeon">${optionList(dungeons, dungeonFilter.dungeon)}</select></label><label>Difficulty<select id="filter-difficulty">${optionList(difficulties, dungeonFilter.difficulty)}</select></label><label>Team comparison<select id="filter-team">${optionList(teams, dungeonFilter.team, 'All teams')}</select></label></div>
      <div class="stat-row stats-five"><div class="stat"><b>${stats.wins}/${stats.losses}</b><small>Wins / losses</small></div><div class="stat"><b>${stats.winPercent.toFixed(1)}%</b><small>Win rate</small></div><div class="stat"><b>${Core.formatTime(stats.fastest)}</b><small>Fastest recorded</small></div><div class="stat"><b>${Core.formatTime(stats.average)}</b><small>Average win</small></div><div class="stat"><b>${Core.formatTime(stats.historicalBest)}</b><small>Historical best</small></div></div>
      <p>${stats.preliminary ? `Preliminary reliability: only ${stats.comparable} comparable battle${stats.comparable === 1 ? '' : 's'}.` : `${stats.comparable} comparable battles provide an established sample.`}</p>
      <div class="list">${comparable.slice().reverse().map(run => `<article class="item row between"><span><b>${escapeHtml(run.dungeon)}</b> · ${escapeHtml(run.difficulty)}<br><small>${escapeHtml(run.team || 'No team label')} · ${escapeHtml(run.notes || 'No notes')}</small></span><span><span class="pill">${run.outcome} ${Core.formatTime(run.seconds)}</span><span class="run-actions"><button class="ghost" data-edit-run="${escapeHtml(run.id)}">Edit</button><button class="danger" data-delete-run="${escapeHtml(run.id)}">Delete</button></span></span></article>`).join('') || '<div class="empty-state">No comparable runs yet.</div>'}</div>
    </section>`;
  }

  function renderStorage() {
    const labels = { regular: 'Regular Monster Inventory', storage: 'Monster Storage', shrine: 'Normal Monster Sealed Shrine' };
    return `<section class="card"><div class="eyebrow">COUNTERS ONLY</div><h2>Monster space</h2><p>Editing these numbers does not move anything in the game.</p><form id="storage-form" class="grid">${Object.entries(labels).map(([key, label]) => { const item = state.storage[key]; return `<div class="card span4"><h3>${label}</h3><div class="metric">${item.capacity - item.count} free</div><div class="progress"><span style="width:${percent(item.count, item.capacity)}%"></span></div><div class="form-grid"><label>Used<input name="${key}-count" type="number" min="0" max="10000" value="${item.count}"></label><label>Capacity<input name="${key}-capacity" type="number" min="0" max="10000" value="${item.capacity}"></label></div></div>`; }).join('')}<button class="primary span12">Save all counters</button></form></section>`;
  }

  function renderFind() {
    const filtered = GUIDES.filter(guide => `${guide.title} ${guide.steps.join(' ')}`.toLowerCase().includes(guideSearch.toLowerCase()));
    return `<section class="card"><div class="eyebrow">CURRENT UI MAY VARY</div><h2>Where is it?</h2><label>Search navigation tips<input id="guide-search" type="search" value="${escapeHtml(guideSearch)}" placeholder="Dragon, storage, profile…"></label><p class="warning">Do not tap the decorative diamond beside a Storage count—it is not a button.</p><div id="guide-list" class="list">${filtered.map(guide => `<details class="item guide" open><summary class="guide-heading"><strong>${escapeHtml(guide.title)}</strong><span aria-hidden="true">⌄</span></summary><ol>${guide.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol><p>Last reviewed ${guide.reviewed}. May vary after updates.</p><label>Your correction or note<textarea data-guide-id="${guide.id}" maxlength="2000">${escapeHtml(guideDrafts[guide.id] ?? state.guideNotes[guide.id] ?? '')}</textarea></label><button class="ghost" data-save-guide="${guide.id}">Save note</button></details>`).join('') || '<div class="empty-state">No matching tips.</div>'}</div></section>`;
  }

  function bindPage() {
    document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
    if (page === 'toa') bindToa();
    if (page === 'dungeons') bindDungeons();
    if (page === 'storage') bindStorage();
    if (page === 'find') bindGuides();
  }

  function navigate(nextPage) {
    page = nextPage;
    render();
  }

  function bindToa() {
    document.querySelector('#toa-mode').addEventListener('change', event => { toaMode = event.target.value; render(); });
    document.querySelector('#toa-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const current = Number(form.get('current'));
      let best = Number(form.get('best'));
      const target = Number(form.get('target'));
      if (![current, best, target].every(Number.isInteger) || current < 0 || current > 100 || best < 0 || best > 100 || target < 1 || target > 100) return toast('Floors must be whole numbers from 0 to 100', true);
      if (current > best) {
        if (window.confirm(`Floor ${current} exceeds the historical best of ${best}. Update the historical best?`)) best = current;
        else return toast('Save cancelled; current floor cannot exceed historical best', true);
      }
      if (target < current) return toast('Next milestone cannot be below the current floor', true);
      state.toa[toaMode] = { current, best, target, notes: String(form.get('notes')).slice(0, 2000) };
      if (saveState(`${toaMode} progress saved`)) render();
    });
    document.querySelector('#reset-toa').addEventListener('click', () => {
      if (!window.confirm(`Reset the current ${toaMode} rotation to floor 0? Historical best will stay ${state.toa[toaMode].best}.`)) return;
      state.toa[toaMode].current = 0;
      if (state.toa[toaMode].target < 1) state.toa[toaMode].target = 10;
      if (saveState(`${toaMode} rotation reset`)) render();
    });
  }

  function bindDungeons() {
    document.querySelector('#filter-dungeon').addEventListener('change', event => { dungeonFilter = { dungeon: event.target.value, difficulty: '', team: '' }; render(); });
    document.querySelector('#filter-difficulty').addEventListener('change', event => { dungeonFilter.difficulty = event.target.value; dungeonFilter.team = ''; render(); });
    document.querySelector('#filter-team').addEventListener('change', event => { dungeonFilter.team = event.target.value; render(); });
    document.querySelector('#add-run').addEventListener('click', () => openRunDialog());
    document.querySelectorAll('[data-edit-run]').forEach(button => button.addEventListener('click', () => openRunDialog(button.dataset.editRun)));
    document.querySelectorAll('[data-delete-run]').forEach(button => button.addEventListener('click', () => deleteRun(button.dataset.deleteRun)));
  }

  function openRunDialog(id = '') {
    const dialog = document.querySelector('#run-dialog');
    const form = document.querySelector('#run-form');
    form.reset();
    const run = state.runs.find(item => item.id === id);
    document.querySelector('#run-dialog-title').textContent = run ? 'Edit dungeon run' : 'Log a dungeon run';
    form.elements.id.value = run ? run.id : '';
    form.elements.dungeon.value = run ? run.dungeon : dungeonFilter.dungeon;
    form.elements.difficulty.value = run ? run.difficulty : dungeonFilter.difficulty;
    form.elements.outcome.value = run ? run.outcome : 'Win';
    form.elements.time.value = run && run.seconds !== null ? Core.formatTime(run.seconds) : '';
    form.elements.team.value = run ? run.team : dungeonFilter.team;
    form.elements.notes.value = run ? run.notes : '';
    dialog.showModal();
  }

  function saveRun(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const seconds = Core.parseTime(form.get('time'));
    if (Number.isNaN(seconds)) return toast('Use a valid time such as 1:42.250; seconds must be below 60', true);
    const outcome = String(form.get('outcome'));
    if (!Core.OUTCOMES.includes(outcome)) return toast('Outcome must be Win or Loss', true);
    const id = String(form.get('id')) || (crypto.randomUUID ? crypto.randomUUID() : `run-${Date.now()}`);
    const existing = state.runs.findIndex(run => run.id === id);
    const run = { id, dungeon: String(form.get('dungeon')).trim().slice(0, 100), difficulty: String(form.get('difficulty')).trim().slice(0, 100), outcome, seconds, team: String(form.get('team')).trim().slice(0, 200), notes: String(form.get('notes')).trim().slice(0, 2000), createdAt: existing >= 0 ? state.runs[existing].createdAt : new Date().toISOString() };
    if (!run.dungeon || !run.difficulty) return toast('Dungeon and difficulty are required', true);
    if (existing >= 0) state.runs[existing] = run; else state.runs.push(run);
    if (outcome === 'Win' && seconds !== null) {
      const key = `${run.dungeon}|${run.difficulty}`;
      state.historicalBest[key] = state.historicalBest[key] === undefined ? seconds : Math.min(state.historicalBest[key], seconds);
    }
    dungeonFilter = { dungeon: run.dungeon, difficulty: run.difficulty, team: '' };
    if (saveState(existing >= 0 ? 'Run updated' : 'Run logged')) {
      document.querySelector('#run-dialog').close();
      render();
    }
  }

  function deleteRun(id) {
    const run = state.runs.find(item => item.id === id);
    if (!run || !window.confirm(`Delete this ${run.dungeon} ${run.outcome} record? Historical personal best will be preserved.`)) return;
    state.runs = state.runs.filter(item => item.id !== id);
    if (saveState('Run deleted')) render();
  }

  function bindStorage() {
    document.querySelector('#storage-form').addEventListener('submit', event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const next = {};
      for (const key of ['regular', 'storage', 'shrine']) {
        const count = Number(form.get(`${key}-count`));
        const capacity = Number(form.get(`${key}-capacity`));
        if (!Number.isInteger(count) || !Number.isInteger(capacity) || count < 0 || capacity < 0 || count > 10000 || capacity > 10000) return toast('Storage values must be whole numbers from 0 to 10000', true);
        if (count > capacity) return toast(`${key === 'regular' ? 'Regular inventory' : key === 'storage' ? 'Monster Storage' : 'Sealed Shrine'} used slots cannot exceed capacity`, true);
        next[key] = { count, capacity };
      }
      state.storage = next;
      if (saveState('Storage counters saved')) render();
    });
  }

  function bindGuides() {
    const search = document.querySelector('#guide-search');
    search.addEventListener('input', event => {
      document.querySelectorAll('[data-guide-id]').forEach(textarea => { guideDrafts[textarea.dataset.guideId] = textarea.value; });
      guideSearch = event.target.value;
      render();
      const replacement = document.querySelector('#guide-search');
      replacement.focus();
      replacement.setSelectionRange(guideSearch.length, guideSearch.length);
    });
    document.querySelectorAll('[data-guide-id]').forEach(textarea => textarea.addEventListener('input', () => { guideDrafts[textarea.dataset.guideId] = textarea.value; }));
    document.querySelectorAll('[data-save-guide]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.saveGuide;
      state.guideNotes[id] = String(guideDrafts[id] || '').slice(0, 2000);
      if (saveState('Guide note saved')) render();
    }));
  }

  function exportBackup() {
    const anchor = document.createElement('a');
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    anchor.href = url;
    anchor.download = `summoner-scout-review-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function buildImportPreview(imported) {
    const preview = document.querySelector('#import-preview');
    preview.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Validated import preview';
    const summary = document.createElement('p');
    summary.textContent = `ToA Normal ${imported.toa.Normal.current}, ToA Hard ${imported.toa.Hard.current}; ${imported.runs.length} dungeon runs; storage ${imported.storage.regular.count}/${imported.storage.regular.capacity}, ${imported.storage.storage.count}/${imported.storage.storage.capacity}, ${imported.storage.shrine.count}/${imported.storage.shrine.capacity}.`;
    preview.append(heading, summary);
    preview.hidden = false;
  }

  function importSelectedFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    file.text().then(text => {
      const parsed = JSON.parse(text);
      pendingImport = Core.normalizeImport(parsed);
      buildImportPreview(pendingImport);
      document.querySelector('#confirm-import').hidden = false;
      toast('Backup validated; review the preview before replacing data');
    }).catch(error => {
      pendingImport = null;
      document.querySelector('#import-preview').hidden = true;
      document.querySelector('#confirm-import').hidden = true;
      toast(`Import rejected: ${error.message}`, true);
    });
  }

  function confirmImport() {
    if (!pendingImport) return;
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
    } catch (error) {
      return showNotice('Import cancelled because a recovery copy could not be created. Export a backup and try again.', 'Export backup', exportBackup);
    }
    const previous = state;
    state = Core.safeClone(pendingImport);
    if (!saveState('Backup restored')) {
      state = previous;
      return;
    }
    pendingImport = null;
    document.querySelector('#backup-dialog').close();
    guideDrafts = { ...state.guideNotes };
    render();
  }

  function restoreRecovery() {
    try {
      const recovery = Core.normalizeImport(readJson(RECOVERY_KEY));
      const previous = state;
      state = recovery;
      if (!saveState('Recovery copy restored')) state = previous;
      else {
        guideDrafts = { ...state.guideNotes };
        document.querySelector('#backup-dialog').close();
        render();
      }
    } catch (error) {
      toast(`Recovery failed: ${error.message}`, true);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showNotice('A new Summoner Scout release is ready. Your saved data will be preserved.', 'Reload update', () => window.location.reload());
        });
      });
    }).catch(() => showNotice('Offline support could not be enabled. The app still works while online.'));
  }

  function initializeChrome() {
    const nav = document.querySelector('nav');
    nav.innerHTML = Object.entries(PAGE_NAMES).map(([id, label]) => `<button data-page="${id}">${label}</button>`).join('');
    nav.addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) navigate(button.dataset.page); });

    const backupDialog = document.querySelector('#backup-dialog');
    document.querySelector('#backup-btn').addEventListener('click', () => {
      document.querySelector('#recovery-btn').hidden = !localStorage.getItem(RECOVERY_KEY);
      backupDialog.showModal();
    });
    document.querySelector('#export-btn').addEventListener('click', exportBackup);
    document.querySelector('#recovery-btn').addEventListener('click', restoreRecovery);
    document.querySelector('#import-file').addEventListener('change', importSelectedFile);
    document.querySelector('#confirm-import').addEventListener('click', confirmImport);

    const runDialog = document.querySelector('#run-dialog');
    document.querySelector('#run-form').addEventListener('submit', saveRun);
    document.querySelectorAll('[data-close-run]').forEach(button => button.addEventListener('click', () => runDialog.close()));

    let installPrompt = null;
    const installButton = document.querySelector('#install-btn');
    const installHelp = document.querySelector('#install-help');
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; installButton.hidden = false; });
    installButton.addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); const result = await installPrompt.userChoice; if (result.outcome === 'accepted') toast('Summoner Scout installed'); installPrompt = null; installButton.hidden = true; });
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches && !localStorage.getItem('summoner-scout.review.install-dismissed')) installHelp.hidden = false;
    document.querySelector('#dismiss-install').addEventListener('click', () => { installHelp.hidden = true; localStorage.setItem('summoner-scout.review.install-dismissed', '1'); });
    window.addEventListener('appinstalled', () => { installButton.hidden = true; installHelp.hidden = true; toast('App installed'); });
  }

  initializeChrome();
  registerServiceWorker();
  render();
})();

