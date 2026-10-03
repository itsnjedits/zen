(() => {
  'use strict';

  const STORAGE_KEY = 'chronicle.v1.data';
  const DEFAULT_DATA = {
    version: 1,
    activeNotebookId: null,
    notebooks: [],
    settings: { theme:'mystic', clock:true, hour24:false, prompt:true }
  };

  const els = {
    body: document.body,
    shell: document.getElementById('appShell'),
    sidebar: document.getElementById('sidebar'),
    notebookList: document.getElementById('notebookList'),
    notebookTitle: document.getElementById('notebookTitle'),
    dateEyebrow: document.getElementById('dateEyebrow'),
    timeline: document.getElementById('timeline'),
    entryCount: document.getElementById('entryCount'),
    saveStatus: document.getElementById('saveStatus'),
    clockText: document.getElementById('clockText'),
    clockToggle: document.getElementById('clockToggle'),
    composerHint: document.getElementById('composerHint'),
    overlay: document.getElementById('overlay'),
    toast: document.getElementById('toast'),
    searchModal: document.getElementById('searchModal'),
    settingsModal: document.getElementById('settingsModal'),
    notebookModal: document.getElementById('notebookModal'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    notebookNameInput: document.getElementById('notebookNameInput'),
    settingClock: document.getElementById('settingClock'),
    setting24h: document.getElementById('setting24h'),
    settingPrompt: document.getElementById('settingPrompt'),
    themeGrid: document.getElementById('themeGrid'),
    contextMenu: document.getElementById('contextMenu'),
    importInput: document.getElementById('importInput')
  };

  let data = loadData();
  let saveTimer = null;
  let toastTimer = null;
  let editingNotebookId = null;
  let contextNotebookId = null;
  let lastClockKey = '';

  function uid(prefix='id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function defaultNotebook() {
    return { id: uid('nb'), name:'Daily Thoughts', createdAt: new Date().toISOString(), entries:[] };
  }

  function normalize(raw) {
    const safe = JSON.parse(JSON.stringify(DEFAULT_DATA));
    if (!raw || typeof raw !== 'object') return safe;
    safe.version = 1;
    safe.settings = { ...safe.settings, ...(raw.settings || {}) };
    safe.notebooks = Array.isArray(raw.notebooks) ? raw.notebooks.map(nb => ({
      id: String(nb.id || uid('nb')),
      name: String(nb.name || 'Untitled'),
      createdAt: nb.createdAt || new Date().toISOString(),
      entries: Array.isArray(nb.entries) ? nb.entries.map(e => ({
        id: String(e.id || uid('e')),
        timestamp: e.timestamp || new Date().toISOString(),
        text: String(e.text ?? '')
      })) : []
    })) : [];
    safe.activeNotebookId = safe.notebooks.some(n => n.id === raw.activeNotebookId) ? raw.activeNotebookId : (safe.notebooks[0]?.id || null);
    return safe;
  }

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const normalized = normalize(parsed);
      if (!normalized.notebooks.length) {
        const nb = defaultNotebook();
        normalized.notebooks.push(nb);
        normalized.activeNotebookId = nb.id;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (err) {
      const nb = defaultNotebook();
      return { ...DEFAULT_DATA, activeNotebookId: nb.id, notebooks:[nb] };
    }
  }

  function persist(immediate=false) {
    els.saveStatus.classList.add('saving');
    els.saveStatus.querySelector('span:last-child').textContent = 'Saving…';
    clearTimeout(saveTimer);
    const write = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        els.saveStatus.classList.remove('saving');
        els.saveStatus.querySelector('span:last-child').textContent = 'Saved';
      } catch (err) {
        els.saveStatus.classList.remove('saving');
        els.saveStatus.querySelector('span:last-child').textContent = 'Save failed';
        showToast('Local storage is full or unavailable.');
      }
    };
    if (immediate) write(); else saveTimer = setTimeout(write, 250);
  }

  function activeNotebook() { return data.notebooks.find(n => n.id === data.activeNotebookId) || null; }

  function formatClock(date) {
    const opt = { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:!data.settings.hour24 };
    return new Intl.DateTimeFormat(undefined, opt).format(date);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit', hour12:!data.settings.hour24 }).format(d);
  }

  function formatDateLong(date) {
    return new Intl.DateTimeFormat(undefined, { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(date);
  }

  function formatDayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const same = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    if (same(d,today)) return 'Today · ' + formatDateLong(d);
    if (same(d,yesterday)) return 'Yesterday · ' + formatDateLong(d);
    return formatDateLong(d);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function plainToHtml(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function renderAll() {
    applySettings();
    renderSidebar();
    renderNotebook();
    updateClock();
  }

  function applySettings() {
    els.body.dataset.theme = data.settings.theme || 'mystic';
    els.body.classList.toggle('prompt-off', !data.settings.prompt);
    els.clockToggle.style.display = data.settings.clock ? '' : 'none';
    els.settingClock.checked = !!data.settings.clock;
    els.setting24h.checked = !!data.settings.hour24;
    els.settingPrompt.checked = !!data.settings.prompt;
    [...els.themeGrid.querySelectorAll('.theme-chip')].forEach(b => b.classList.toggle('active', b.dataset.theme === data.settings.theme));
  }

  function renderSidebar() {
    els.notebookList.innerHTML = '';
    for (const nb of data.notebooks) {
      const item = document.createElement('div');
      item.className = `notebook-item ${nb.id === data.activeNotebookId ? 'active' : ''}`;
      item.dataset.id = nb.id;
      item.innerHTML = `
        <span class="notebook-icon">✦</span>
        <span class="notebook-meta"><span class="notebook-name"></span><span class="notebook-count">${nb.entries.length} ${nb.entries.length === 1 ? 'thought' : 'thoughts'}</span></span>
        <button class="more-notebook" title="Notebook actions" aria-label="Notebook actions">•••</button>`;
      item.querySelector('.notebook-name').textContent = nb.name;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.more-notebook')) return;
        data.activeNotebookId = nb.id;
        persist(true);
        closeSidebar();
        renderAll();
      });
      item.querySelector('.more-notebook').addEventListener('click', (e) => {
        e.stopPropagation();
        showContextMenu(e.currentTarget, nb.id);
      });
      els.notebookList.appendChild(item);
    }
  }

  function renderNotebook() {
    const nb = activeNotebook();
    if (!nb) return;
    els.notebookTitle.textContent = nb.name;
    const now = new Date();
    els.dateEyebrow.textContent = formatDateLong(now).toUpperCase();
    const count = nb.entries.length;
    els.entryCount.textContent = `${count} ${count === 1 ? 'thought' : 'thoughts'}`;

    els.timeline.innerHTML = '';
    if (!count) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.innerHTML = `<div class="empty-orbit"></div><h3>Nothing has been written yet.</h3><p>Let the first thought arrive without editing it. Press <strong>Enter</strong> after each thought to give the next one its own moment in time.</p>`;
      empty.addEventListener('click', () => createEntry(true));
      els.timeline.appendChild(empty);
      els.composerHint.style.marginTop = '18px';
      return;
    }
    let previousDay = null;
    nb.entries.forEach((entry, index) => {
      const dayKey = new Date(entry.timestamp).toLocaleDateString();
      if (dayKey !== previousDay) {
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.innerHTML = `<span>${escapeHtml(formatDayLabel(entry.timestamp))}</span>`;
        els.timeline.appendChild(divider);
        previousDay = dayKey;
      }
      els.timeline.appendChild(createEntryElement(entry, index));
    });
  }

  function createEntryElement(entry, index) {
    const wrap = document.createElement('article');
    wrap.className = 'entry';
    wrap.dataset.entryId = entry.id;
    wrap.innerHTML = `
      <span class="entry-pin" aria-hidden="true"></span>
      <div class="entry-time" title="${escapeHtml(entry.timestamp)}">${escapeHtml(formatTime(entry.timestamp))}</div>
      <div class="entry-card">
        <div class="entry-editor" contenteditable="true" spellcheck="true" data-placeholder="A thought, a task, a reminder…"></div>
        <div class="entry-actions">
          <button class="mini-button duplicate" title="Duplicate">↳</button>
          <button class="mini-button delete" title="Delete">×</button>
        </div>
      </div>`;
    const editor = wrap.querySelector('.entry-editor');
    editor.innerHTML = plainToHtml(entry.text);
    editor.addEventListener('keydown', onEntryKeydown);
    editor.addEventListener('input', () => {
      entry.text = editor.innerText.replace(/\u00a0/g, ' ');
      schedulePersist();
    });
    editor.addEventListener('blur', () => {
      entry.text = editor.innerText.replace(/\u00a0/g, ' ');
      persist(true);
    });
    wrap.querySelector('.delete').addEventListener('click', () => deleteEntry(entry.id));
    wrap.querySelector('.duplicate').addEventListener('click', () => duplicateEntry(entry.id));
    return wrap;
  }

  function focusEntry(id) {
    requestAnimationFrame(() => document.querySelector(`[data-entry-id="${CSS.escape(id)}"] .entry-editor`)?.focus());
  }

  function createEntry(focus=true, seedText='') {
    const nb = activeNotebook();
    if (!nb) return;
    const entry = { id:uid('e'), timestamp:new Date().toISOString(), text:seedText };
    nb.entries.push(entry);
    persist(true);
    renderSidebar();
    renderNotebook();
    if (focus) focusEntry(entry.id);
  }

  function onEntryKeydown(e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.shiftKey) return;
    e.preventDefault();
    const currentEl = e.currentTarget;
    const entryEl = currentEl.closest('.entry');
    const currentId = entryEl.dataset.entryId;
    const nb = activeNotebook();
    const idx = nb.entries.findIndex(x => x.id === currentId);
    if (idx === -1) return;
    nb.entries[idx].text = currentEl.innerText.replace(/\u00a0/g, ' ');
    const newEntry = { id:uid('e'), timestamp:new Date().toISOString(), text:'' };
    nb.entries.splice(idx + 1, 0, newEntry);
    persist(true);
    renderSidebar();
    renderNotebook();
    focusEntry(newEntry.id);
  }

  function deleteEntry(id) {
    const nb = activeNotebook();
    const idx = nb?.entries.findIndex(e => e.id === id) ?? -1;
    if (idx === -1) return;
    nb.entries.splice(idx,1);
    persist(true);
    renderSidebar(); renderNotebook();
    showToast('Thought deleted');
    const before = nb.entries[idx] || nb.entries[idx-1];
    if (before) focusEntry(before.id);
  }

  function duplicateEntry(id) {
    const nb = activeNotebook();
    const idx = nb?.entries.findIndex(e => e.id === id) ?? -1;
    if (idx === -1) return;
    const src = nb.entries[idx];
    const copy = { id:uid('e'), timestamp:new Date().toISOString(), text:src.text };
    nb.entries.splice(idx+1,0,copy);
    persist(true);
    renderSidebar(); renderNotebook(); focusEntry(copy.id);
  }

  function schedulePersist() { persist(false); }

  function openModal(id) {
    hideContextMenu();
    els.overlay.hidden = false;
    const modal = document.getElementById(id);
    modal.hidden = false;
    setTimeout(() => modal.querySelector('input')?.focus(), 40);
  }
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = true;
    const anyOpen = [els.searchModal,els.settingsModal,els.notebookModal].some(m => !m.hidden);
    els.overlay.hidden = !anyOpen;
  }
  function closeAllModals() {
    [els.searchModal,els.settingsModal,els.notebookModal].forEach(m => m.hidden = true);
    els.overlay.hidden = true;
    hideContextMenu();
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function showContextMenu(button, id) {
    contextNotebookId = id;
    const rect = button.getBoundingClientRect();
    els.contextMenu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
    els.contextMenu.style.top = `${Math.min(rect.bottom + 5, window.innerHeight - 160)}px`;
    els.contextMenu.hidden = false;
  }
  function hideContextMenu() { els.contextMenu.hidden = true; contextNotebookId = null; }

  function openNotebookModal(mode='create', nbId=null) {
    editingNotebookId = mode === 'rename' ? nbId : null;
    document.getElementById('notebookModalTitle').textContent = mode === 'rename' ? 'Rename notebook' : 'New notebook';
    document.getElementById('saveNotebookBtn').textContent = mode === 'rename' ? 'Save name' : 'Create notebook';
    const target = nbId ? data.notebooks.find(n=>n.id===nbId) : null;
    els.notebookNameInput.value = target?.name || '';
    openModal('notebookModal');
  }

  function saveNotebookFromModal() {
    const name = els.notebookNameInput.value.trim();
    if (!name) { showToast('Give the notebook a name.'); return; }
    if (editingNotebookId) {
      const nb = data.notebooks.find(n=>n.id===editingNotebookId);
      if (nb) nb.name = name;
      showToast('Notebook renamed');
    } else {
      const nb = { id:uid('nb'), name, createdAt:new Date().toISOString(), entries:[] };
      data.notebooks.push(nb); data.activeNotebookId = nb.id;
      showToast('Notebook created');
    }
    persist(true); closeModal('notebookModal'); renderAll();
  }

  function duplicateNotebook(id) {
    const src = data.notebooks.find(n=>n.id===id);
    if (!src) return;
    const clone = JSON.parse(JSON.stringify(src));
    clone.id = uid('nb'); clone.name = `${src.name} Copy`;
    clone.entries = clone.entries.map(e => ({...e, id:uid('e')}));
    data.notebooks.push(clone); data.activeNotebookId = clone.id;
    persist(true); renderAll(); showToast('Notebook duplicated');
  }

  function deleteNotebook(id) {
    if (data.notebooks.length === 1) { showToast('Keep at least one notebook.'); return; }
    const nb = data.notebooks.find(n=>n.id===id);
    if (!nb) return;
    if (!confirm(`Delete “${nb.name}” and all its thoughts?`)) return;
    data.notebooks = data.notebooks.filter(n=>n.id!==id);
    if (data.activeNotebookId === id) data.activeNotebookId = data.notebooks[0].id;
    persist(true); renderAll(); showToast('Notebook deleted');
  }

  function renderSearch(query='') {
    const q = query.trim().toLowerCase();
    const rows = [];
    data.notebooks.forEach(nb => nb.entries.forEach(entry => {
      if (!q || entry.text.toLowerCase().includes(q) || nb.name.toLowerCase().includes(q)) rows.push({nb,entry});
    }));
    rows.sort((a,b)=>new Date(b.entry.timestamp)-new Date(a.entry.timestamp));
    els.searchResults.innerHTML = '';
    if (!rows.length) {
      els.searchResults.innerHTML = '<div class="timeline-empty" style="padding:32px 18px"><h3>No matches</h3><p>Try a different word or phrase.</p></div>';
      return;
    }
    rows.slice(0,80).forEach(({nb,entry}) => {
      const item = document.createElement('button');
      item.className = 'search-result';
      item.innerHTML = `<div class="result-top"><span>${escapeHtml(nb.name)}</span><span>${escapeHtml(formatTime(entry.timestamp))}</span></div><div class="result-text">${highlight(entry.text,q)}</div>`;
      item.addEventListener('click', () => {
        data.activeNotebookId = nb.id; persist(true); closeModal('searchModal'); renderAll(); focusEntry(entry.id);
      });
      els.searchResults.appendChild(item);
    });
  }

  function highlight(text,q) {
    const safe = escapeHtml(text).replace(/\n/g,' ');
    if (!q) return safe;
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return safe.replace(new RegExp(escapedQ,'ig'), m => `<mark>${m}</mark>`);
  }

  function updateClock() {
    const now = new Date();
    const key = data.settings.hour24 ? '24' : '12';
    if (key !== lastClockKey) lastClockKey = key;
    els.clockText.textContent = formatClock(now);
    els.clockToggle.title = data.settings.clock ? 'Hide clock' : 'Show clock';
  }

  function setSetting(key, value) {
    data.settings[key] = value;
    persist(true); applySettings();
    if (key === 'hour24') { renderNotebook(); renderSearch(els.searchInput.value); }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`chronicle-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    showToast('Backup exported');
  }

  async function importData(file) {
    try {
      const text = await file.text();
      const parsed = normalize(JSON.parse(text));
      if (!parsed.notebooks.length) throw new Error('No notebooks found');
      data = parsed; persist(true); renderAll(); showToast('Backup imported');
    } catch (err) { showToast('Could not import that file.'); }
    els.importInput.value = '';
  }

  function clearAll() {
    if (!confirm('Clear every notebook and thought from this browser? This cannot be undone unless you exported a backup.')) return;
    localStorage.removeItem(STORAGE_KEY);
    data = loadData(); closeAllModals(); renderAll(); showToast('Local data cleared');
  }

  function toggleSidebar() { document.body.classList.toggle('sidebar-open'); }
  function closeSidebar() { document.body.classList.remove('sidebar-open'); }

  // Bind UI
  document.getElementById('newNotebookBtn').addEventListener('click', () => openNotebookModal('create'));
  document.getElementById('saveNotebookBtn').addEventListener('click', saveNotebookFromModal);
  els.notebookNameInput.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();saveNotebookFromModal();} });
  document.getElementById('searchBtn').addEventListener('click', () => { openModal('searchModal'); renderSearch(''); });
  document.getElementById('exportBtn').addEventListener('click', exportData);
  els.importInput.addEventListener('change', e => e.target.files[0] && importData(e.target.files[0]));
  document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
  document.getElementById('clockToggle').addEventListener('click', () => setSetting('clock', !data.settings.clock));
  document.getElementById('moreBtn').addEventListener('click', () => openModal('settingsModal'));
  document.getElementById('openSidebarBtn').addEventListener('click', toggleSidebar);
  document.getElementById('closeSidebarBtn').addEventListener('click', closeSidebar);
  document.getElementById('overlay').addEventListener('click', closeAllModals);
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.closeModal)));
  document.getElementById('settingClock').addEventListener('change', e => setSetting('clock', e.target.checked));
  document.getElementById('setting24h').addEventListener('change', e => setSetting('hour24', e.target.checked));
  document.getElementById('settingPrompt').addEventListener('change', e => setSetting('prompt', e.target.checked));
  els.themeGrid.addEventListener('click', e => { const btn = e.target.closest('[data-theme]'); if(btn) setSetting('theme',btn.dataset.theme); });
  document.getElementById('clearAllBtn').addEventListener('click', clearAll);
  els.searchInput.addEventListener('input', e => renderSearch(e.target.value));
  els.contextMenu.addEventListener('click', e => {
    const action = e.target.dataset.menuAction; if (!action || !contextNotebookId) return;
    const id = contextNotebookId; hideContextMenu();
    if(action==='rename') openNotebookModal('rename',id);
    else if(action==='duplicate') duplicateNotebook(id);
    else if(action==='delete') deleteNotebook(id);
  });
  document.addEventListener('click', e => { if(!e.target.closest('.context-menu') && !e.target.closest('.more-notebook')) hideContextMenu(); });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); openModal('searchModal'); renderSearch(''); }
    if (e.key==='Escape') { closeAllModals(); closeSidebar(); }
  });
  window.addEventListener('beforeunload', () => persist(true));

  setInterval(updateClock, 250);
  setSetting('theme', data.settings.theme || 'mystic');
  renderAll();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
})();
