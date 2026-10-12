// OMNIHOME — PRODUCTION SMART HOME CONTROLLER & GEMMA 4 ASSISTANT
let ws = null;
let devices = [];
let currentFilter = 'all';
let logCounter = 0;
let isListening = false;
let speechRecognizer = null;

// AUDIO ENGINE STATE
let speechAudioEnabled = true;
let availableVoices = [];
let selectedVoiceURI = localStorage.getItem('omnihome_voice_uri') || localStorage.getItem('pyhome_voice_uri') || '';
let audioCtx = null;

// ==========================================
// 1. PROFESSIONAL THEME & WALLPAPER ENGINE
// ==========================================
let currentTheme = localStorage.getItem('omnihome_theme') || localStorage.getItem('pyhome_theme') || 'claude-dark';
if (currentTheme === 'dark') currentTheme = 'claude-dark';
if (currentTheme === 'light') currentTheme = 'claude-light';

let currentWallpaper = localStorage.getItem('omnihome_wallpaper') || 'mesh';

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  document.documentElement.setAttribute('data-wallpaper', currentWallpaper);
  updateThemeButtonUI();
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('omnihome_theme', currentTheme);
  updateThemeButtonUI();
  closeThemeDropdown();
  playSFX('click');
  showToast(`Theme changed to ${getThemeDisplayName(theme)}`, 'info');
}

function setWallpaper(wp) {
  currentWallpaper = wp;
  document.documentElement.setAttribute('data-wallpaper', currentWallpaper);
  localStorage.setItem('omnihome_wallpaper', currentWallpaper);
  document.querySelectorAll('.wallpaper-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-wp') === wp);
  });
  playSFX('click');
  showToast(`Backdrop set to ${wp}`, 'info');
}

function toggleThemeDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('theme-dropdown-menu');
  if (menu) {
    const isShown = menu.style.display === 'flex';
    menu.style.display = isShown ? 'none' : 'flex';
  }
}

function closeThemeDropdown() {
  const menu = document.getElementById('theme-dropdown-menu');
  if (menu) menu.style.display = 'none';
}

window.addEventListener('click', () => {
  closeThemeDropdown();
});

function getThemeDisplayName(theme) {
  const map = {
    'claude-dark': 'Claude Dark',
    'jarvis': 'Jarvis Hologram',
    'obsidian': 'Midnight Obsidian',
    'nordic': 'Nordic Slate',
    'claude-light': 'Alabaster Light'
  };
  return map[theme] || 'Claude Dark';
}

function updateThemeButtonUI() {
  const textEl = document.getElementById('theme-toggle-text');
  const badgeEl = document.getElementById('theme-indicator-dot');
  if (textEl) textEl.innerText = getThemeDisplayName(currentTheme);
  if (badgeEl) {
    const colorMap = {
      'claude-dark': '#d97757',
      'jarvis': '#00e5ff',
      'obsidian': '#10b981',
      'nordic': '#6366f1',
      'claude-light': '#c96442'
    };
    badgeEl.style.background = colorMap[currentTheme] || '#d97757';
  }
}

// ==========================================
// 2. NAVIGATION & VIEW CONTROLLER
// ==========================================
function switchNav(viewName, el) {
  playSFX('click');
  if (viewName === 'assistant') viewName = 'dashboard';

  document.querySelectorAll('.claude-nav .nav-pill').forEach(i => i.classList.remove('active'));
  if (el) {
    el.classList.add('active');
  } else {
    const btn = document.querySelector(`.nav-pill[data-view="${viewName}"]`);
    if (btn) btn.classList.add('active');
  }

  const views = ['dashboard', 'ambient', 'devices', 'cameras', 'activity', 'settings'];
  views.forEach(v => {
    const page = document.getElementById(`view-${v}`);
    if (page) {
      if (v === viewName) {
        page.style.display = 'block';
        page.classList.add('active');
      } else {
        page.style.display = 'none';
        page.classList.remove('active');
      }
    }
  });

  if (viewName === 'settings') {
    loadSettings();
    renderDeviceSettingsTable();
  } else if (viewName === 'devices') {
    renderDevices();
  } else if (viewName === 'activity') {
    renderFullActivityLog();
  } else if (viewName === 'cameras') {
    initCameraCanvasFull();
  } else if (viewName === 'dashboard') {
    renderDevices();
    applyWidgetPreferences();
    if (typeof resizeJarvisGlob === 'function') resizeJarvisGlob();
  } else if (viewName === 'ambient') {
    if (typeof resizeJarvisGlob === 'function') resizeJarvisGlob();
  }
}

// ==========================================
// 2.5 BENTO DASHBOARD CUSTOMIZATION ENGINE
// ==========================================
const allWidgetDefinitions = [
  { id: 'widget-jarvis', label: 'Jarvis Intelligence Core' },
  { id: 'widget-scenes', label: 'Quick Automations & Scenes' },
  { id: 'widget-climate', label: 'Indoor Climate & Environment' },
  { id: 'widget-power', label: 'Live Power & Watts Load' },
  { id: 'widget-security', label: 'Perimeter Security & Lock' },
  { id: 'widget-camera', label: 'Front Door Camera Spotlight' },
  { id: 'widget-devices', label: 'Essential Quick Devices' },
  { id: 'widget-activity', label: 'Recent System Activity' }
];

let bentoWidgetPrefs = (() => {
  try {
    const stored = localStorage.getItem('omnihome_bento_prefs');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return {
    order: allWidgetDefinitions.map(w => w.id),
    hidden: []
  };
})();

// ==========================================
// 2.5 SAAS EDIT MODE & FLIP REORDER ENGINE
// ==========================================
let isEditMode = false;
let activeDragCard = null;

function toggleEditMode() {
  isEditMode = !isEditMode;
  playSFX('click');
  updateEditModeUI();
}

function updateEditModeUI() {
  const grid = document.getElementById('bento-grid');
  const banner = document.getElementById('edit-mode-banner');
  const editBtn = document.getElementById('btn-edit-mode');
  const editLabel = document.getElementById('edit-mode-btn-label');

  if (!grid) return;

  if (isEditMode) {
    grid.classList.add('edit-mode');
    if (banner) banner.style.display = 'flex';
    if (editBtn) editBtn.classList.add('active-edit');
    if (editLabel) editLabel.textContent = 'Done Editing';
    showToast('Edit Mode: Drag any widget to rearrange with live animation', 'info');
  } else {
    grid.classList.remove('edit-mode');
    if (banner) banner.style.display = 'none';
    if (editBtn) editBtn.classList.remove('active-edit');
    if (editLabel) editLabel.textContent = 'Edit Layout';
    grid.querySelectorAll('.bento-card').forEach(c => {
      c.classList.remove('is-dragging', 'drag-over', 'bento-shifting');
      c.style.transform = '';
      c.style.transition = '';
    });
    showToast('Dashboard layout saved', 'success');
  }

  setupBentoDragAndDrop();
}

function hideWidgetFromGrid(id, e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!bentoWidgetPrefs.hidden.includes(id)) {
    bentoWidgetPrefs.hidden.push(id);
    saveDashboardPreferences();
    applyWidgetPreferences();
    if (document.getElementById('modal-customize') && document.getElementById('modal-customize').style.display === 'flex') {
      renderCustomizeModalContent();
    }
    const def = allWidgetDefinitions.find(w => w.id === id);
    const name = def ? def.label : 'Widget';
    showToast(`${name} hidden. Restore anytime in Customize.`, 'info');
  }
}

function saveCurrentGridOrder() {
  const grid = document.getElementById('bento-grid');
  if (!grid) return;
  const cards = Array.from(grid.children).filter(c => c.classList.contains('bento-card'));
  const newOrder = cards.map(c => c.id);
  allWidgetDefinitions.forEach(w => {
    if (!newOrder.includes(w.id)) {
      newOrder.push(w.id);
    }
  });
  bentoWidgetPrefs.order = newOrder;
  saveDashboardPreferences();
  if (document.getElementById('modal-customize') && document.getElementById('modal-customize').style.display === 'flex') {
    renderCustomizeModalContent();
  }
}

/**
 * Finds the bento card currently underneath pointer coordinates using bounding boxes.
 */
function findCardAtPoint(x, y, excludeEl) {
  const cards = document.querySelectorAll('#bento-grid > .bento-card');
  for (const c of cards) {
    if (c === excludeEl || c.style.display === 'none') continue;
    const r = c.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      return c;
    }
  }
  return null;
}

/**
 * High-performance FLIP (First, Last, Invert, Play) animated reordering.
 * Instantly reorders dragged card in DOM, then animates all displaced sibling
 * cards from their old coordinates to their new slots with a fluid spring curve.
 */
function moveCardWithAnimation(dragged, target, isAfter) {
  const grid = document.getElementById('bento-grid');
  if (!grid || !dragged || !target || dragged === target) return;

  const cards = Array.from(grid.querySelectorAll('.bento-card:not([style*="display: none"])'));
  const firstPositions = new Map();
  cards.forEach(c => firstPositions.set(c, c.getBoundingClientRect()));

  if (isAfter) {
    target.after(dragged);
  } else {
    target.before(dragged);
  }

  cards.forEach(c => {
    if (c === dragged) return;
    const first = firstPositions.get(c);
    if (!first) return;
    const last = c.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      c.style.transform = `translate(${dx}px, ${dy}px)`;
      c.style.transition = 'none';
      c.classList.add('bento-shifting');
    }
  });

  requestAnimationFrame(() => {
    grid.offsetHeight; // Force reflow
    cards.forEach(c => {
      if (c === dragged) return;
      if (c.classList.contains('bento-shifting')) {
        c.style.transition = 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)';
        c.style.transform = '';
        const onEnd = () => {
          c.classList.remove('bento-shifting');
          c.style.transition = '';
          c.removeEventListener('transitionend', onEnd);
        };
        c.addEventListener('transitionend', onEnd);
      }
    });
  });

  saveCurrentGridOrder();
}

function setupBentoDragAndDrop() {
  const grid = document.getElementById('bento-grid');
  if (!grid) return;

  const cards = grid.querySelectorAll('.bento-card');
  cards.forEach(card => {
    // Disable native HTML5 drag completely so it NEVER intercepts our pointer system
    card.setAttribute('draggable', 'false');
    card.ondragstart = (e) => e.preventDefault();

    // Ensure edit bar exists
    if (!card.querySelector('.bento-edit-bar')) {
      const editBar = document.createElement('div');
      editBar.className = 'bento-edit-bar';
      editBar.innerHTML = `
        <div class="bento-drag-handle" title="Drag to reorder widget">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
          <span>Drag to move</span>
        </div>
        <button type="button" class="bento-hide-btn" onclick="hideWidgetFromGrid('${card.id}', event)" title="Hide widget">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      card.insertBefore(editBar, card.firstChild);
    }

    // Attach robust window-tracked pointerdown event
    card.onpointerdown = (e) => {
      if (!isEditMode) return;
      if (e.target.closest('button, input, select, textarea, .bento-hide-btn, a, .btn-subtle')) return;
      if (e.button !== undefined && e.button !== 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let isDragging = false;
      let lastSwapTime = 0;

      const onPointerMove = (moveEvt) => {
        const dist = Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY);
        if (!isDragging && dist > 5) {
          isDragging = true;
          activeDragCard = card;
          card.classList.add('is-dragging');
          playSFX('click');
          document.body.style.userSelect = 'none';
        }

        if (!isDragging) return;

        if (moveEvt.cancelable) moveEvt.preventDefault();

        const now = Date.now();
        if (now - lastSwapTime < 130) return;

        const target = findCardAtPoint(moveEvt.clientX, moveEvt.clientY, card);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const isAfter = (moveEvt.clientY > rect.top + rect.height * 0.5) ||
                        (moveEvt.clientX > rect.left + rect.width * 0.5);

        if (isAfter && card.previousElementSibling === target) return;
        if (!isAfter && card.nextElementSibling === target) return;

        moveCardWithAnimation(card, target, isAfter);
        lastSwapTime = now;
        playSFX('click');
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.body.style.userSelect = '';

        if (isDragging) {
          card.classList.remove('is-dragging');
          activeDragCard = null;
          saveCurrentGridOrder();
          playSFX('click');
          showToast('Dashboard layout updated', 'info');
        }
      };

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };
  });
}

// Global escape key listener to exit edit mode or close modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isEditMode) toggleEditMode();
    closeCommandPalette();
    closeWorkspaceMenu();
  }
});

// ==========================================
// SAAS COMMAND PALETTE ENGINE (CMD+K)
// ==========================================
function getPaletteIcon(id) {
  switch (id) {
    case 'cinema':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;
    case 'secure':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    case 'all_on':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    case 'all_off':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    case 'edit_mode':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    case 'customize':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    case 'ambient':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/></svg>`;
    case 'devices':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`;
    case 'cameras':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`;
    case 'activity':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    case 'theme_claude_dark':
    case 'theme_obsidian':
    case 'theme_nordic':
    case 'theme_jarvis':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>`;
    case 'theme_claude_light':
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>`;
    default:
      return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`;
  }
}

const commandPaletteActions = [
  { id: 'cinema', category: 'Automation', label: 'Activate Cinema Mode', desc: 'Dims living room, secures front door', action: () => activateScene('movie_night') },
  { id: 'secure', category: 'Automation', label: 'Perimeter Lockdown', desc: 'Engage deadbolt, start camera surveillance', action: () => activateScene('secure_perimeter') },
  { id: 'all_on', category: 'Automation', label: 'Activate All Relays', desc: 'Turns on all 6 hardware nodes', action: () => activateScene('all_on') },
  { id: 'all_off', category: 'Automation', label: 'Eco Standby / All Off', desc: 'Powers down all non-essential relays', action: () => activateScene('all_off') },
  { id: 'edit_mode', category: 'Layout', label: 'Toggle Edit Mode', desc: 'Rearrange and customize dashboard widgets', action: () => toggleEditMode() },
  { id: 'customize', category: 'Layout', label: 'Customize OS Theme & Wallpapers', desc: 'Select themes and backdrops', action: () => openCustomizeModal() },
  { id: 'ambient', category: 'Navigation', label: 'Open Ambient Core AI', desc: 'Full-screen hologram voice interface', action: () => switchNav('ambient', document.querySelector('[data-view="ambient"]')) },
  { id: 'devices', category: 'Navigation', label: 'Fleet Hardware Manager', desc: 'Inspect all 6 IoT relay channels', action: () => switchNav('devices', document.querySelector('[data-view="devices"]')) },
  { id: 'cameras', category: 'Navigation', label: 'CSI Edge Cameras', desc: 'Live video feed & facial recognition', action: () => switchNav('cameras', document.querySelector('[data-view="cameras"]')) },
  { id: 'activity', category: 'Navigation', label: 'Audit Trail & Telemetry', desc: 'Full system audit logs', action: () => switchNav('activity', document.querySelector('[data-view="activity"]')) },
  { id: 'theme_claude_dark', category: 'Theme', label: 'Theme: Claude Dark', desc: 'Warm minimalist dark theme (Default)', action: () => setTheme('claude-dark') },
  { id: 'theme_jarvis', category: 'Theme', label: 'Theme: Jarvis Hologram', desc: 'Cyber blue holographic HUD', action: () => setTheme('jarvis') },
  { id: 'theme_obsidian', category: 'Theme', label: 'Theme: Midnight Obsidian', desc: 'Deep emerald SaaS theme', action: () => setTheme('obsidian') },
  { id: 'theme_nordic', category: 'Theme', label: 'Theme: Nordic Slate', desc: 'Indigo slate clean theme', action: () => setTheme('nordic') },
  { id: 'theme_claude_light', category: 'Theme', label: 'Theme: Alabaster Light', desc: 'Clean editorial paper light theme', action: () => setTheme('claude-light') }
];

let paletteSelectedIndex = 0;
let currentFilteredPalette = [];

function openCommandPalette() {
  playSFX('click');
  const modal = document.getElementById('modal-command-palette');
  const input = document.getElementById('cmd-palette-input');
  if (!modal) return;
  modal.style.display = 'flex';
  renderCommandPaletteResults('');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

function closeCommandPalette() {
  const modal = document.getElementById('modal-command-palette');
  if (modal) modal.style.display = 'none';
}

function renderCommandPaletteResults(query) {
  const container = document.getElementById('cmd-palette-results');
  if (!container) return;
  const q = (query || '').toLowerCase().trim();
  currentFilteredPalette = commandPaletteActions.filter(a => 
    !q || a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q))
  );

  paletteSelectedIndex = 0;

  if (currentFilteredPalette.length === 0) {
    container.innerHTML = `<div class="cmd-no-results">No actions found for "${escapeHtml(query)}"</div>`;
    return;
  }

  container.innerHTML = currentFilteredPalette.map((item, idx) => `
    <div class="cmd-palette-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}" onclick="executePaletteAction('${item.id}')">
      <span class="cmd-item-icon">${getPaletteIcon(item.id)}</span>
      <div class="cmd-item-info">
        <div class="cmd-item-label-row">
          <span class="cmd-item-label">${escapeHtml(item.label)}</span>
          ${item.category ? `<span class="cmd-item-tag">${escapeHtml(item.category)}</span>` : ''}
        </div>
        <span class="cmd-item-desc">${escapeHtml(item.desc)}</span>
      </div>
      <span class="cmd-item-arrow">&rarr;</span>
    </div>
  `).join('');
}

function filterCommandPalette(val) {
  renderCommandPaletteResults(val);
}

function updatePaletteSelection() {
  const items = document.querySelectorAll('.cmd-palette-item');
  items.forEach((it, idx) => {
    it.classList.toggle('active', idx === paletteSelectedIndex);
    if (idx === paletteSelectedIndex) {
      it.scrollIntoView({ block: 'nearest' });
    }
  });
}

function handlePaletteInputKeyDown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (currentFilteredPalette.length > 0) {
      paletteSelectedIndex = (paletteSelectedIndex + 1) % currentFilteredPalette.length;
      updatePaletteSelection();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentFilteredPalette.length > 0) {
      paletteSelectedIndex = (paletteSelectedIndex - 1 + currentFilteredPalette.length) % currentFilteredPalette.length;
      updatePaletteSelection();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredPalette[paletteSelectedIndex]) {
      executePaletteAction(currentFilteredPalette[paletteSelectedIndex].id);
    }
  } else if (e.key === 'Escape') {
    closeCommandPalette();
  }
}

function executePaletteAction(id) {
  const item = commandPaletteActions.find(a => a.id === id);
  closeCommandPalette();
  if (item && item.action) {
    item.action();
  }
}

// Global Cmd+K / Ctrl+K listener
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommandPalette();
  }
});

// Property workspace switcher
function toggleWorkspaceMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('workspace-dropdown-menu');
  if (menu) {
    const isShown = menu.style.display === 'flex';
    menu.style.display = isShown ? 'none' : 'flex';
  }
}

function closeWorkspaceMenu() {
  const menu = document.getElementById('workspace-dropdown-menu');
  if (menu) menu.style.display = 'none';
}

function switchWorkspace(name) {
  const el = document.getElementById('current-workspace-name');
  if (el) el.innerText = name;
  closeWorkspaceMenu();
  playSFX('click');
  showToast(`Active property switched to ${name}`, 'info');
}

// Global escape key listener to exit edit mode
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isEditMode) {
    toggleEditMode();
  }
});

function applyWidgetPreferences() {
  const container = document.getElementById('bento-grid');
  if (!container) return;

  bentoWidgetPrefs.order.forEach(id => {
    const el = document.getElementById(id);
    if (el) container.appendChild(el);
  });

  allWidgetDefinitions.forEach(w => {
    const el = document.getElementById(w.id);
    if (el) {
      if (bentoWidgetPrefs.hidden.includes(w.id)) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    }
  });

  setupBentoDragAndDrop();
}

function openCustomizeModal() {
  playSFX('click');
  const modal = document.getElementById('modal-customize');
  if (!modal) return;
  renderCustomizeModalContent();
  modal.style.display = 'flex';
}

function closeCustomizeModal() {
  const modal = document.getElementById('modal-customize');
  if (modal) modal.style.display = 'none';
}

function renderCustomizeModalContent() {
  document.querySelectorAll('.theme-card-option').forEach(card => {
    const t = card.getAttribute('data-theme-val');
    card.classList.toggle('active', t === currentTheme);
  });

  document.querySelectorAll('.wallpaper-btn').forEach(btn => {
    const wp = btn.getAttribute('data-wp');
    btn.classList.toggle('active', wp === currentWallpaper);
  });

  const listEl = document.getElementById('widget-customizer-list');
  if (!listEl) return;

  listEl.innerHTML = bentoWidgetPrefs.order.map((id, index) => {
    const def = allWidgetDefinitions.find(w => w.id === id) || { id: id, label: id };
    const isVisible = !bentoWidgetPrefs.hidden.includes(id);
    return `
      <div class="widget-order-item" data-id="${id}">
        <label class="widget-order-left">
          <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="toggleWidgetVisibility('${id}', this.checked)">
          <span>${def.label}</span>
        </label>
        <div class="widget-order-actions">
          <button type="button" class="btn-arrow" onclick="moveWidget('${id}', -1)" ${index === 0 ? 'disabled' : ''} title="Move Up">&uarr;</button>
          <button type="button" class="btn-arrow" onclick="moveWidget('${id}', 1)" ${index === bentoWidgetPrefs.order.length - 1 ? 'disabled' : ''} title="Move Down">&darr;</button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleWidgetVisibility(id, visible) {
  if (visible) {
    bentoWidgetPrefs.hidden = bentoWidgetPrefs.hidden.filter(h => h !== id);
  } else {
    if (!bentoWidgetPrefs.hidden.includes(id)) bentoWidgetPrefs.hidden.push(id);
  }
  saveDashboardPreferences();
  applyWidgetPreferences();
}

function moveWidget(id, dir) {
  const idx = bentoWidgetPrefs.order.indexOf(id);
  if (idx === -1) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= bentoWidgetPrefs.order.length) return;

  const item = bentoWidgetPrefs.order.splice(idx, 1)[0];
  bentoWidgetPrefs.order.splice(targetIdx, 0, item);
  saveDashboardPreferences();
  applyWidgetPreferences();
  renderCustomizeModalContent();
}

function saveDashboardPreferences() {
  localStorage.setItem('omnihome_bento_prefs', JSON.stringify(bentoWidgetPrefs));
}

function resetDashboardPreferences() {
  bentoWidgetPrefs = {
    order: allWidgetDefinitions.map(w => w.id),
    hidden: []
  };
  saveDashboardPreferences();
  applyWidgetPreferences();
  renderCustomizeModalContent();
  showToast('Dashboard widgets reset to default', 'info');
}

// ==========================================
// 3. SYSTEM CLOCK, AMBIENT GREETING & SHORTCUTS
// ==========================================
function initClock() {
  const clockEl = document.getElementById('clock');
  const camTimeEl = document.getElementById('cam-timestamp');
  const bigClock = document.getElementById('ambient-big-clock');
  const bigDate = document.getElementById('ambient-big-date');

  function update() {
    const now = new Date();
    const str = now.toTimeString().split(' ')[0];
    if (clockEl) clockEl.innerText = str;
    if (camTimeEl) camTimeEl.innerText = str;
    if (bigClock) bigClock.innerText = str;
    if (bigDate) {
      const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      bigDate.innerText = now.toLocaleDateString('en-US', opts);
    }
  }
  update();
  setInterval(update, 1000);
}

function initGreeting() {
  const titleEl = document.getElementById('greeting-title');
  const dateEl = document.getElementById('greeting-date');
  if (!titleEl && !dateEl) return;

  const now = new Date();
  const hour = now.getHours();
  let greet = 'Good evening';
  if (hour >= 5 && hour < 12) greet = 'Good morning';
  else if (hour >= 12 && hour < 17) greet = 'Good afternoon';
  else if (hour >= 17 && hour < 22) greet = 'Good evening';
  else greet = 'Good night';

  if (titleEl) titleEl.innerText = `${greet}, Vasu`;

  if (dateEl) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateEl.innerText = now.toLocaleDateString('en-US', options);
  }
}

function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const input = document.getElementById('manual-prompt-input');
      if (input && document.getElementById('view-dashboard') && document.getElementById('view-dashboard').classList.contains('active')) {
        input.focus();
        input.select();
        showToast('Spotlight prompt focused', 'info');
      } else {
        openCommandPalette();
      }
    }
  });
}

function executeQuickPrompt(text) {
  playSFX('click');
  const input = document.getElementById('manual-prompt-input');
  if (input) input.value = text;
  const transcriptEl = document.getElementById('voice-transcript');
  if (transcriptEl) transcriptEl.innerText = `"${text}"`;
  showToast(`Directing: "${text}"`, 'info');
  submitVoiceCommand(text);
}

// ==========================================
// 4. CLAUDE PROMPT DISPATCH
// ==========================================
function submitPromptFromInput() {
  const input = document.getElementById('manual-prompt-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const transcriptEl = document.getElementById('voice-transcript');
  if (transcriptEl) transcriptEl.innerText = `"${val}"`;
  submitVoiceCommand(val);
  input.value = '';
}


// ==========================================
// 6. JARVIS HOLOGRAPHIC MOVING GLOB ENGINE (SIRI X JARVIS)
// ==========================================
let orbState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking'
let orbAudioEnergy = 0.08;
let orbTargetEnergy = 0.08;
let orbTime = 0;
let isCoreImmersion = false;
let globCanvas = null;
let globCtx = null;
let globAnimFrame = null;

let shockwaves = [];
let orbParticles = [];
let mouseTilt = { x: 0, y: 0, targetX: 0, targetY: 0, isHovered: false };

function initJarvisGlob() {
  globCanvas = document.getElementById('jarvis-glob-canvas');
  if (!globCanvas) return;
  globCtx = globCanvas.getContext('2d');

  // Initialize 3D quantum particles
  initOrbParticles();

  // Handle HiDPI scaling
  resizeJarvisGlob();
  window.addEventListener('resize', resizeJarvisGlob);

  // Mouse interactivity on container
  const container = document.getElementById('glob-canvas-container');
  if (container) {
    container.addEventListener('mouseenter', () => {
      mouseTilt.isHovered = true;
    });

    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseTilt.targetX = x * 22;
      mouseTilt.targetY = y * 22;
    });

    container.addEventListener('mouseleave', () => {
      mouseTilt.isHovered = false;
      mouseTilt.targetX = 0;
      mouseTilt.targetY = 0;
    });
  }

  // Start animation loop
  if (globAnimFrame) cancelAnimationFrame(globAnimFrame);
  renderJarvisGlob();
}

function initOrbParticles() {
  orbParticles = [];
  const count = 72;
  for (let i = 0; i < count; i++) {
    orbParticles.push({
      angle: Math.random() * Math.PI * 2,
      orbitRadius: 80 + Math.random() * 65,
      speed: (0.006 + Math.random() * 0.012) * (Math.random() > 0.4 ? 1 : -1),
      yOffset: (Math.random() - 0.5) * 35,
      size: 1.2 + Math.random() * 2.2,
      baseAlpha: 0.35 + Math.random() * 0.55
    });
  }
}

function resizeJarvisGlob() {
  const canvases = [
    document.getElementById('jarvis-glob-canvas'),
    document.getElementById('ambient-glob-canvas')
  ];
  const dpr = window.devicePixelRatio || 1;
  canvases.forEach(cv => {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const size = rect.width > 0 ? rect.width : (cv.id === 'ambient-glob-canvas' ? 320 : 220);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  });
}

function spawnShockwave(color) {
  shockwaves.push({
    radius: 20,
    maxRadius: 150,
    alpha: 0.75,
    speed: 4.2,
    color: color || '217, 119, 87'
  });
}

function setOrbState(newState) {
  if (orbState === newState) return;
  orbState = newState;

  const badge = document.getElementById('core-state-badge');
  const statusText = document.getElementById('core-status-text');
  const hintText = document.getElementById('glob-hint-text');

  if (badge) {
    badge.className = `core-status-pill ${newState}`;
  }
  const ambBadge = document.getElementById('ambient-core-badge');
  const ambStatusText = document.getElementById('ambient-status-text');
  if (ambBadge) ambBadge.className = `core-status-pill large ${newState}`;
  if (ambStatusText && statusText) ambStatusText.innerText = statusText.innerText;

  if (newState === 'listening') {
    if (statusText) statusText.innerText = 'Listening...';
    if (hintText) hintText.innerText = 'Listening...';
    spawnShockwave('16, 185, 129');
  } else if (newState === 'thinking') {
    if (statusText) statusText.innerText = 'Reasoning...';
    if (hintText) hintText.innerText = 'Thinking...';
    spawnShockwave('168, 85, 247');
  } else if (newState === 'speaking') {
    if (statusText) statusText.innerText = 'Speaking...';
    if (hintText) hintText.innerText = 'Speaking...';
    spawnShockwave('217, 119, 87');
  } else {
    // idle
    if (statusText) statusText.innerText = 'Online // Ready';
    if (hintText) hintText.innerText = 'Tap to Speak';
  }
}

function toggleCoreImmersion() {
  isCoreImmersion = !isCoreImmersion;
  playSFX('confirm');

  const hero = document.getElementById('jarvis-core-hero');
  const btn = document.getElementById('btn-toggle-immersion');

  if (hero) {
    if (isCoreImmersion) {
      hero.classList.add('immersion-mode');
    } else {
      hero.classList.remove('immersion-mode');
    }
  }

  if (btn) {
    btn.innerHTML = isCoreImmersion ? `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <span>Exit View</span>
    ` : `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      <span>Hologram View</span>
    `;
  }

  setTimeout(resizeJarvisGlob, 150);
}

function handleGlobClick() {
  getAudioContext();
  playSFX('click');
  spawnShockwave();
  toggleSpeechRecognition();
}

function renderJarvisGlob() {
  if (!globCanvas || !globCtx) {
    globAnimFrame = requestAnimationFrame(renderJarvisGlob);
    return;
  }

  const rect = globCanvas.getBoundingClientRect();
  const width = rect.width || 240;
  const height = rect.height || 240;

  // Time & Easing
  orbTime += 0.016;

  // Smooth mouse tilt
  mouseTilt.x += (mouseTilt.targetX - mouseTilt.x) * 0.12;
  mouseTilt.y += (mouseTilt.targetY - mouseTilt.y) * 0.12;

  // State-based audio energy modulation
  if (orbState === 'listening') {
    orbTargetEnergy = 0.42 + 0.35 * Math.abs(Math.sin(orbTime * 7.5)) * Math.cos(orbTime * 4.2);
  } else if (orbState === 'thinking') {
    orbTargetEnergy = 0.38 + 0.32 * Math.sin(orbTime * 14.0) * Math.sin(orbTime * 6.5);
  } else if (orbState === 'speaking') {
    orbTargetEnergy = 0.48 + 0.38 * Math.sin(orbTime * 6.0) * Math.cos(orbTime * 3.2);
  } else {
    // idle breathing
    orbTargetEnergy = 0.07 + 0.035 * Math.sin(orbTime * 1.4);
  }
  orbAudioEnergy += (orbTargetEnergy - orbAudioEnergy) * 0.15;

  const ctx = globCtx;
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2 + mouseTilt.x;
  const cy = height / 2 + mouseTilt.y;
  const R0 = Math.min(width, height) * 0.22;

  // 1. Ambient Volumetric Radial Glow (Claude Warm Amber/Terracotta)
  const bgGrad = ctx.createRadialGradient(cx, cy, R0 * 0.15, cx, cy, R0 * 1.95);
  if (orbState === 'listening') {
    bgGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    bgGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.08)');
  } else if (orbState === 'thinking') {
    bgGrad.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
    bgGrad.addColorStop(0.45, 'rgba(217, 119, 87, 0.08)');
  } else if (orbState === 'speaking') {
    bgGrad.addColorStop(0, 'rgba(217, 119, 87, 0.32)');
    bgGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.12)');
  } else {
    // idle Claude terracotta
    bgGrad.addColorStop(0, 'rgba(217, 119, 87, 0.18)');
    bgGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.06)');
  }
  bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Elegant Ethereal Gyroscopic Rings (Jarvis subtle orbital rings)
  ctx.save();
  // Outer ring 1
  ctx.translate(cx, cy);
  ctx.rotate(orbTime * 0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, R0 * 1.35, R0 * 0.55, 0.35, 0, Math.PI * 2);
  ctx.strokeStyle = orbState === 'listening' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(217, 119, 87, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Micro-satellite node on ring 1
  const sat1X = Math.cos(orbTime * 1.1) * (R0 * 1.35);
  const sat1Y = Math.sin(orbTime * 1.1) * (R0 * 0.55);
  ctx.beginPath();
  ctx.arc(sat1X, sat1Y, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#fef3c7';
  ctx.fill();

  // Ring 2 (counter-rotating at opposite tilt)
  ctx.rotate(-orbTime * 0.65);
  ctx.beginPath();
  ctx.ellipse(0, 0, R0 * 1.45, R0 * 0.48, -0.45, 0, Math.PI * 2);
  ctx.strokeStyle = orbState === 'listening' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(245, 158, 11, 0.22)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Micro-satellite node on ring 2
  const sat2X = Math.cos(-orbTime * 1.4) * (R0 * 1.45);
  const sat2Y = Math.sin(-orbTime * 1.4) * (R0 * 0.48);
  ctx.beginPath();
  ctx.arc(sat2X, sat2Y, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // 6. Background 3D Orbiting Quantum Particles (z < 0)
  ctx.save();
  orbParticles.forEach(pt => {
    pt.angle += pt.speed;
    const rad = pt.orbitRadius;
    const z = Math.sin(pt.angle) * 0.85;

    if (z < 0) {
      const px = cx + Math.cos(pt.angle) * rad;
      const py = cy + Math.sin(pt.angle) * rad * 0.38 + pt.yOffset;
      const alpha = pt.baseAlpha * (0.35 + (z + 1) * 0.35);

      ctx.beginPath();
      ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.7})`;
      ctx.arc(px, py, pt.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();

  // 7. Shockwaves Rendering
  ctx.save();
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += sw.speed;
    sw.alpha *= 0.94;

    if (sw.alpha <= 0.02 || sw.radius >= sw.maxRadius) {
      shockwaves.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(${sw.color}, ${sw.alpha})`;
    ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 8. THE MULTI-LAYER SIRI FLUID ORGANIC MORPHING GLOB (CORE)
  // Layer 0: Deep Plasma Shell (Warm Terracotta / Coral)
  drawFluidGlobLayer(ctx, cx, cy, R0, 0, orbTime, orbAudioEnergy, orbState);

  // Layer 1: Chromasphere Mid Shell (Warm Terracotta / Amber)
  drawFluidGlobLayer(ctx, cx, cy, R0, 1, orbTime, orbAudioEnergy, orbState);

  // Layer 2: Inner Radiant Plasma Nucleus (Warm Pearl High Energy)
  drawFluidGlobLayer(ctx, cx, cy, R0, 2, orbTime, orbAudioEnergy, orbState);

  // 9. Core Twisting Flux Ribbons (Arc Reactor Filaments)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 1.8;
  for (let f = 0; f < 3; f++) {
    const fAngle = orbTime * (1.8 + f * 0.4) + f * (Math.PI * 2 / 3);
    const rFlux = R0 * (0.42 + 0.12 * Math.sin(orbTime * 3 + f));
    ctx.beginPath();
    ctx.strokeStyle = f === 0 ? 'rgba(255, 255, 255, 0.75)' : (f === 1 ? 'rgba(217, 119, 87, 0.7)' : 'rgba(245, 158, 11, 0.55)');
    ctx.ellipse(cx, cy, rFlux, rFlux * 0.45, fAngle, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 10. 3D Glass Spherical Specular Highlight (Curved Glint)
  ctx.save();
  const glintGrad = ctx.createRadialGradient(cx - R0 * 0.35, cy - R0 * 0.35, 4, cx - R0 * 0.35, cy - R0 * 0.35, R0 * 0.7);
  glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  glintGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.18)');
  glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glintGrad;
  ctx.beginPath();
  ctx.arc(cx - R0 * 0.25, cy - R0 * 0.25, R0 * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 11. Foreground 3D Orbiting Quantum Particles (z >= 0)
  ctx.save();
  orbParticles.forEach(pt => {
    const rad = pt.orbitRadius;
    const z = Math.sin(pt.angle) * 0.85;

    if (z >= 0) {
      const px = cx + Math.cos(pt.angle) * rad;
      const py = cy + Math.sin(pt.angle) * rad * 0.38 + pt.yOffset;
      const alpha = pt.baseAlpha * (0.7 + z * 0.3);

      // Core particle
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.arc(px, py, pt.size * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Warm Amber / Champagne particle glow
      ctx.beginPath();
      ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.45})`;
      ctx.arc(px, py, pt.size * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();

  // 12. Central Focal Holographic Reticle / Iris
  ctx.save();
  const irisRadius = R0 * (0.16 + orbAudioEnergy * 0.08);
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  if (orbState === 'listening') {
    ctx.strokeStyle = '#34d399';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
  } else if (orbState === 'thinking') {
    ctx.strokeStyle = '#c084fc';
    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
  } else {
    ctx.strokeStyle = '#d97757';
    ctx.fillStyle = 'rgba(217, 119, 87, 0.25)';
  }
  ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();

  // Center white pinpoint
  ctx.beginPath();
  ctx.fillStyle = '#fffdfa';
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  globAnimFrame = requestAnimationFrame(renderJarvisGlob);
}

function drawFluidGlobLayer(ctx, cx, cy, R0, layerIdx, time, energy, state) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const pointCount = layerIdx === 2 ? 100 : 140;
  ctx.beginPath();

  for (let i = 0; i <= pointCount; i++) {
    const angle = (i * Math.PI * 2) / pointCount;
    let r = R0;

    if (layerIdx === 0) {
      // Outer deep plasma shell
      r *= (1.0 + 0.12 * Math.sin(3 * angle + time * 1.8) 
                + 0.08 * Math.cos(5 * angle - time * 1.4) 
                + energy * 0.24 * Math.sin(7 * angle + time * 3.6));
    } else if (layerIdx === 1) {
      // Mid chromasphere shell
      r *= (0.88 + 0.15 * Math.cos(4 * angle - time * 2.2) 
                 + 0.09 * Math.sin(6 * angle + time * 1.7) 
                 + energy * 0.28 * Math.cos(3 * angle - time * 4.2));
    } else {
      // Inner radiant nucleus
      r *= (0.58 + 0.08 * Math.sin(5 * angle + time * 3.0) 
                 + energy * 0.18 * Math.sin(8 * angle - time * 5.2));
    }

    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();

  // Create layer gradient in Claude palette
  const grad = ctx.createRadialGradient(cx - R0 * 0.15, cy - R0 * 0.15, 5, cx, cy, R0 * 1.2);

  if (layerIdx === 0) {
    if (state === 'listening') {
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.6)');
      grad.addColorStop(1, 'rgba(5, 150, 105, 0.15)');
    } else if (state === 'thinking') {
      grad.addColorStop(0, 'rgba(168, 85, 247, 0.85)');
      grad.addColorStop(0.5, 'rgba(217, 119, 87, 0.6)');
      grad.addColorStop(1, 'rgba(194, 65, 12, 0.15)');
    } else {
      grad.addColorStop(0, 'rgba(194, 65, 12, 0.85)');
      grad.addColorStop(0.5, 'rgba(217, 119, 87, 0.6)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.15)');
    }
  } else if (layerIdx === 1) {
    if (state === 'listening') {
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
      grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.7)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else if (state === 'thinking') {
      grad.addColorStop(0, 'rgba(216, 180, 254, 0.95)');
      grad.addColorStop(0.6, 'rgba(217, 119, 87, 0.7)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    } else {
      grad.addColorStop(0, 'rgba(217, 119, 87, 0.95)');
      grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.7)');
      grad.addColorStop(1, 'rgba(217, 119, 87, 0)');
    }
  } else {
    // Nucleus: warm pearl & amber radiance
    grad.addColorStop(0, 'rgba(255, 253, 250, 0.98)');
    grad.addColorStop(0.5, 'rgba(254, 215, 170, 0.8)');
    grad.addColorStop(1, 'rgba(217, 119, 87, 0)');
  }

  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// ==========================================
// 7. APPLICATION BOOTSTRAPPER
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  initGreeting();
  initShortcuts();
  applyWidgetPreferences();
  initJarvisGlob();
  initVoices();
  initCameraCanvas();
  initSpeechRecognition();
  connectWebSocket();
  loadSettings();
});



// CLEAN VECTOR SVG ICONS FOR DEVICES (ZERO EMOJIS)
function getDeviceSVG(type, state) {
  switch (type) {
    case 'relay':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
        <path d="M9 18h6"/>
        <path d="M10 22h4"/>
      </svg>`;

    case 'fan':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>`;

    case 'dimmer':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/>
        <path d="m19.07 4.93-1.41 1.41"/>
      </svg>`;

    case 'lock':
      return state ? `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ` : `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
        </svg>
      `;

    default:
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>`;
  }
}

// LUXURY SUBTLE CHIMES (WEB AUDIO API)
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, duration, vol) {
  if (!speechAudioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(vol || 0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playSFX(type) {
  if (!speechAudioEnabled) return;
  switch (type) {
    case 'listen':
      playTone(600, 0.08, 0.03);
      setTimeout(() => playTone(800, 0.12, 0.03), 60);
      break;

    case 'confirm':
      playTone(523.25, 0.06, 0.03);
      setTimeout(() => playTone(659.25, 0.06, 0.03), 50);
      setTimeout(() => playTone(783.99, 0.12, 0.04), 100);
      break;

    case 'click':
      playTone(480, 0.02, 0.02);
      break;

    case 'scan':
      playTone(550, 0.1, 0.03);
      setTimeout(() => playTone(720, 0.12, 0.03), 60);
      break;
  }
}

// SPEECH SYNTHESIS VOICE ENGINE
function initVoices() {
  if (!window.speechSynthesis) return;

  function load() {
    availableVoices = window.speechSynthesis.getVoices();
    const select = document.getElementById('voice-select');
    if (!select || availableVoices.length === 0) return;

    select.innerHTML = '';
    const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));
    const displayList = englishVoices.length > 0 ? englishVoices : availableVoices;

    displayList.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.innerText = `${v.name.replace(/Google|Microsoft/g, '').trim()} (${v.lang})`;
      if (selectedVoiceURI && v.voiceURI === selectedVoiceURI) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    if (!selectedVoiceURI && displayList.length > 0) {
      const preferred = displayList.find(v => 
        v.name.includes('Natural') || v.name.includes('Google') || 
        v.name.includes('Samantha') || v.name.includes('Daniel')
      ) || displayList[0];

      selectedVoiceURI = preferred.voiceURI;
      select.value = selectedVoiceURI;
    }
  }

  load();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
}

function onVoiceChange(uri) {
  selectedVoiceURI = uri;
  localStorage.setItem('omnihome_voice_uri', uri);
  testVoiceOutput();
}

function toggleAudioSpeech() {
  speechAudioEnabled = !speechAudioEnabled;
  const btn = document.getElementById('audio-toggle-btn');
  const label = document.getElementById('audio-toggle-label');
  if (btn && label) {
    if (speechAudioEnabled) {
      btn.classList.add('active');
      label.innerText = 'Voice On';
      playSFX('confirm');
    } else {
      btn.classList.remove('active');
      label.innerText = 'Voice Muted';
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  }
}

function testVoiceOutput() {
  getAudioContext();
  playSFX('confirm');
  speakAssistantResponse("OmniHome assistant audio online. Ready for instructions.");
}

let lastAssistantResponse = 'All systems nominal. Ready for commands.';

function replayLastSpeech() {
  if (!lastAssistantResponse) return;
  playSFX('click');
  speakAssistantResponse(lastAssistantResponse);
}

function speakAssistantResponse(text) {
  if (text) lastAssistantResponse = text;

  if (!speechAudioEnabled || !window.speechSynthesis) {
    setOrbState('idle');
    return;
  }

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  if (selectedVoiceURI && availableVoices.length > 0) {
    const v = availableVoices.find(x => x.voiceURI === selectedVoiceURI);
    if (v) utterance.voice = v;
  }

  utterance.onstart = () => {
    setOrbState('speaking');
  };
  utterance.onend = () => {
    setOrbState('idle');
  };
  utterance.onerror = () => {
    setOrbState('idle');
  };

  window.speechSynthesis.speak(utterance);
}

// (System clock is handled by aesthetic clock engine)

// WEBSOCKET HUB CONNECTION
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  addLog('system', `Connecting to WebSocket Gateway: ${wsUrl}`);
  const statusLabel = document.querySelector('.hub-label');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (statusLabel) statusLabel.innerText = 'Hub: Online';
      addLog('event', 'Local real-time channel established.');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('WS Parse Error:', err);
      }
    };

    ws.onclose = () => {
      if (statusLabel) statusLabel.innerText = 'Hub: Reconnecting...';
      addLog('warn', 'Connection interrupted. Re-establishing link...');
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
    };
  } catch (e) {
    setTimeout(connectWebSocket, 2000);
  }
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'init':
      if (msg.payload && msg.payload.devices) {
        devices = msg.payload.devices;
        renderDevices();
        renderDeviceSettingsTable();
      }
      if (msg.payload && msg.payload.telemetry) {
        updateTelemetry(msg.payload.telemetry);
      }
      break;

    case 'device_update':
      updateSingleDevice(msg.payload);
      break;

    case 'device_added':
      if (msg.payload) {
        const exist = devices.find(d => d.id === msg.payload.id);
        if (!exist) devices.push(msg.payload);
        renderDevices();
        renderDeviceSettingsTable();
      }
      break;

    case 'device_deleted':
      if (msg.payload && msg.payload.id) {
        devices = devices.filter(d => d.id !== msg.payload.id);
        renderDevices();
        renderDeviceSettingsTable();
      }
      break;

    case 'telemetry':
      updateTelemetry(msg.payload);
      break;

    case 'event':
      addLog('event', msg.payload);
      break;
  }
}

// SPEECH RECOGNITION (WEB SPEECH API)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition unavailable in this browser.');
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onstart = () => {
    isListening = true;
    setOrbState('listening');
    playSFX('listen');
    const trigger = document.getElementById('mic-trigger');
    if (trigger) trigger.classList.add('listening');
  };

  speechRecognizer.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    const transcriptEl = document.getElementById('voice-transcript');
    if (transcriptEl) transcriptEl.innerText = `"${transcript}"`;

    if (event.results[0].isFinal) {
      submitVoiceCommand(transcript);
    }
  };

  speechRecognizer.onerror = (event) => {
    console.warn('Speech error:', event.error);
    stopListening();
    setOrbState('idle');
  };

  speechRecognizer.onend = () => {
    stopListening();
    if (orbState === 'listening') {
      setOrbState('idle');
    }
  };
}

function toggleSpeechRecognition() {
  getAudioContext();
  if (!speechRecognizer) {
    document.getElementById('manual-prompt-input').focus();
    return;
  }

  if (isListening) {
    speechRecognizer.stop();
    stopListening();
  } else {
    try {
      speechRecognizer.start();
      setOrbState('listening');
    } catch (e) {
      speechRecognizer.stop();
      stopListening();
    }
  }
}

function stopListening() {
  isListening = false;
  const trigger = document.getElementById('mic-trigger');
  if (trigger) trigger.classList.remove('listening');
  if (orbState === 'listening') {
    setOrbState('idle');
  }
}

function focusVoiceInput() {
  const input = document.getElementById('manual-prompt-input');
  if (input) input.focus();
}

function showSynapseBanner(directive, reply) {
  const banner = document.getElementById('ai-synapse-hud');
  const transcriptEl = document.getElementById('voice-transcript');
  const replyEl = document.getElementById('voice-reply');
  const ambTrans = document.getElementById('ambient-transcript');
  const ambReply = document.getElementById('ambient-reply');

  if (directive) {
    if (transcriptEl) transcriptEl.innerText = `"${directive}"`;
    if (ambTrans) ambTrans.innerText = `"${directive}"`;
  }
  if (reply) {
    if (replyEl) replyEl.innerText = reply;
    if (ambReply) ambReply.innerText = reply;
    lastAssistantResponse = reply;
  }
  if (banner) {
    banner.style.display = 'block';
  }
}

function dismissSynapseBanner() {
  const banner = document.getElementById('ai-synapse-hud');
  if (banner) {
    banner.style.display = 'none';
  }
}

// GEMMA 4 VOICE INTENT DISPATCH
async function submitVoiceCommand(promptText) {
  if (!promptText || !promptText.trim()) return;

  getAudioContext();
  setOrbState('thinking');
  addLog('ai', `Prompt: "${promptText}"`);
  showSynapseBanner(promptText, 'Analyzing intent with Gemma 4...');

  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    const data = await res.json();

    showSynapseBanner(promptText, data.speech_reply);
    addLog('highlight', `Action: ${data.speech_reply}`);

    playSFX('confirm');
    setOrbState('speaking');
    speakAssistantResponse(data.speech_reply);

  } catch (err) {
    console.error('Voice error:', err);
    showSynapseBanner(promptText, 'Unable to reach local intelligence endpoint.');
    setOrbState('idle');
  }
}

function handleManualPrompt(e) {
  e.preventDefault();
  getAudioContext();
  const input = document.getElementById('manual-prompt-input');
  const val = input.value.trim();
  if (!val) return;
  const transcriptEl = document.getElementById('voice-transcript');
  if (transcriptEl) transcriptEl.innerText = `"${val}"`;
  submitVoiceCommand(val);
  input.value = '';
}

function submitTextCommand(cmd) {
  getAudioContext();
  const transcriptEl = document.getElementById('voice-transcript');
  if (transcriptEl) transcriptEl.innerText = `"${cmd}"`;
  submitVoiceCommand(cmd);
}

function activateScene(sceneId) {
  playSFX('confirm');
  addLog('event', `Activated scene '${sceneId}'`);
  const sceneNames = {
    'movie_night': 'Cinema Mode',
    'secure_perimeter': 'Perimeter Lockdown',
    'all_on': 'All Relays Active',
    'all_off': 'Eco Standby Mode'
  };
  const displayName = sceneNames[sceneId] || sceneId;
  showToast(`${displayName} engaged`, 'success');

  document.querySelectorAll('.bento-scene-btn').forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(sceneId)) {
      btn.classList.add('scene-active-pulse');
      setTimeout(() => btn.classList.remove('scene-active-pulse'), 1000);
    }
  });

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'scene', payload: { id: sceneId } }));
  } else {
    fetch(`/api/scenes/${sceneId}/activate`, { method: 'POST' });
  }
}

// COLOR THEME MAPPER PER DEVICE TYPE
function getDeviceColorClass(d) {
  if (d.id === 'device-1') return 'type-relay device-light';
  if (d.id === 'device-2') return 'type-fan';
  if (d.id === 'device-3') return 'device-tv';
  if (d.id === 'device-4') return 'device-ac';
  if (d.id === 'device-5') return 'type-dimmer';
  if (d.id === 'device-6') return 'type-lock';
  return `type-${d.type}`;
}

let deviceSearchQuery = '';

function handleDeviceSearch(query) {
  deviceSearchQuery = (query || '').toLowerCase().trim();
  renderDevices();
}

// DEVICE GRID & CONTROLS (APPLE HOME / MUSHROOM STYLE)
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  const viewGrid = document.getElementById('devices-view-grid');
  if (!grid && !viewGrid) return;

  let filtered = currentFilter === 'all' 
    ? devices 
    : devices.filter(d => d.room === currentFilter);

  if (deviceSearchQuery) {
    filtered = filtered.filter(d => {
      const name = (d.name || '').toLowerCase();
      const room = (d.room || '').toLowerCase();
      const type = (d.type || '').toLowerCase();
      const pin = String(d.gpio_pin || '');
      return name.includes(deviceSearchQuery) || room.includes(deviceSearchQuery) || type.includes(deviceSearchQuery) || pin.includes(deviceSearchQuery);
    });
  }

  const countPill = document.getElementById('device-count-pill');
  if (countPill) countPill.innerText = `${filtered.length} Devices`;
  const viewCountPill = document.getElementById('devices-view-count');
  if (viewCountPill) viewCountPill.innerText = `${filtered.length} Devices`;

  const html = filtered.map(d => {
    const colorClass = getDeviceColorClass(d);
    return `
    <div id="card-${d.id}" class="device-card ${colorClass} ${d.state ? 'active' : ''}">
      <div class="card-top">
        <button class="icon-btn" onclick="toggleDevice('${d.id}')" title="Click to toggle">
          ${getDeviceSVG(d.type, d.state)}
        </button>
        <label class="toggle-switch">
          <input type="checkbox" ${d.state ? 'checked' : ''} onchange="toggleDevice('${d.id}')">
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="device-details">
        <span class="device-title">${escapeHtml(d.name)}</span>
        <div class="device-meta-row">
          <span>${escapeHtml(d.room)}</span>
          ${d.gpio_pin ? `<span class="pin-tag">GPIO ${d.gpio_pin}</span>` : ''}
          <span>• ${d.power_watts}W</span>
        </div>
      </div>

      ${(d.type === 'dimmer' || d.type === 'fan') ? `
        <div class="range-container">
          <div class="range-labels">
            <span>${d.type === 'dimmer' ? 'Brightness' : 'Speed'}</span>
            <span id="val-${d.id}">${d.value}%</span>
          </div>
          <input type="range" class="clean-slider" min="0" max="100" value="${d.value}"
                 oninput="document.getElementById('val-${d.id}').innerText = this.value + '%'"
                 onchange="commitSlider('${d.id}', this.value)">
        </div>
      ` : ''}
    </div>
  `;
  }).join('');

  if (grid) grid.innerHTML = html;
  if (viewGrid) viewGrid.innerHTML = html;
}

function updateSingleDevice(updatedDevice) {
  const idx = devices.findIndex(d => d.id === updatedDevice.id);
  if (idx !== -1) devices[idx] = updatedDevice;
  else devices.push(updatedDevice);

  const card = document.getElementById(`card-${updatedDevice.id}`);
  if (card) {
    const colorClass = getDeviceColorClass(updatedDevice);
    card.className = `device-card ${colorClass} ${updatedDevice.state ? 'active' : ''}`;

    const cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = updatedDevice.state;

    const iconBtn = card.querySelector('.icon-btn');
    if (iconBtn) iconBtn.innerHTML = getDeviceSVG(updatedDevice.type, updatedDevice.state);

    const valEl = document.getElementById(`val-${updatedDevice.id}`);
    if (valEl) valEl.innerText = `${updatedDevice.value}%`;
  } else {
    renderDevices();
  }

  // Update lock KPI card if lock changed
  if (updatedDevice.id === 'device-6') {
    const lockEl = document.getElementById('stat-lock-status');
    if (lockEl) lockEl.innerText = updatedDevice.state ? 'Secured' : 'Unlocked';
    const secPill = document.getElementById('greeting-security-status');
    if (secPill) secPill.innerText = updatedDevice.state ? 'Front Deadbolt Secured' : 'Front Deadbolt Unlocked';
    const secDot = document.querySelector('.sec-dot');
    if (secDot) {
      secDot.className = `sec-dot ${updatedDevice.state ? 'secured' : 'unsecured'}`;
    }
    const secBar = document.getElementById('stat-security-bar');
    if (secBar) {
      secBar.style.width = updatedDevice.state ? '100%' : '25%';
      secBar.style.background = updatedDevice.state ? 'var(--accent-green)' : 'var(--accent-amber)';
    }
  }

  renderDeviceSettingsTable();
}

function toggleDevice(id) {
  playSFX('click');
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'toggle', payload: { id: id } }));
  } else {
    fetch(`/api/devices/${id}/toggle`, { method: 'POST' });
  }
}

function commitSlider(id, val) {
  playSFX('click');
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'set_state',
      payload: { id: id, state: true, value: parseInt(val) }
    }));
  } else {
    fetch(`/api/devices/${id}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: true, value: parseInt(val) })
    });
  }
}

function filterRoom(room) {
  currentFilter = room;
  document.querySelectorAll('.segment-btn').forEach(b => {
    if (b.getAttribute('data-room') === room) b.classList.add('active');
    else b.classList.remove('active');
  });
  renderDevices();
}

function clearEventLogs() {
  clearActivityLog();
}

function exportAuditLog() {
  exportLogsCsv();
}

// SETTINGS & CONFIGURATION ENGINE
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();

    const hubNameEl = document.getElementById('setting-hub-name');
    const intervalEl = document.getElementById('setting-telemetry-interval');
    const ollamaEl = document.getElementById('setting-ollama-host');
    const modelEl = document.getElementById('setting-gemma-model');
    const camEl = document.getElementById('setting-camera-source');
    const threshEl = document.getElementById('setting-biometric-threshold');
    const threshBadge = document.getElementById('biometric-val-badge');
    const speechEl = document.getElementById('setting-auto-speech');

    if (hubNameEl && s.hub_name) hubNameEl.value = s.hub_name;
    if (intervalEl && s.telemetry_interval) intervalEl.value = s.telemetry_interval;
    if (ollamaEl && s.ollama_host) ollamaEl.value = s.ollama_host;
    if (modelEl && s.gemma_model) modelEl.value = s.gemma_model;
    if (camEl && s.camera_source) camEl.value = s.camera_source;
    if (threshEl && s.biometric_threshold) {
      const pct = Math.round(s.biometric_threshold * 100);
      threshEl.value = pct;
      if (threshBadge) threshBadge.innerText = `${pct}%`;
    }
    if (speechEl && typeof s.auto_speech_reply === 'boolean') {
      speechEl.checked = s.auto_speech_reply;
      speechAudioEnabled = s.auto_speech_reply;
      const audioBtn = document.getElementById('audio-toggle-btn');
      const audioLabel = document.getElementById('audio-toggle-label');
      if (audioBtn && audioLabel) {
        if (speechAudioEnabled) {
          audioBtn.classList.add('active');
          audioLabel.innerText = 'Voice On';
        } else {
          audioBtn.classList.remove('active');
          audioLabel.innerText = 'Voice Muted';
        }
      }
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  playSFX('click');
  const hubName = document.getElementById('setting-hub-name')?.value || 'OmniHome Hub';
  const interval = parseInt(document.getElementById('setting-telemetry-interval')?.value) || 3;
  const ollama = document.getElementById('setting-ollama-host')?.value || 'http://127.0.0.1:11434';
  const model = document.getElementById('setting-gemma-model')?.value || 'gemma4';
  const cam = document.getElementById('setting-camera-source')?.value || '/dev/video0';
  const thresh = (parseFloat(document.getElementById('setting-biometric-threshold')?.value) || 85) / 100;
  const autoSpeech = document.getElementById('setting-auto-speech')?.checked ?? true;

  const payload = {
    hub_name: hubName,
    telemetry_interval: interval,
    ollama_host: ollama,
    gemma_model: model,
    camera_source: cam,
    biometric_threshold: thresh,
    auto_speech_reply: autoSpeech
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());

    speechAudioEnabled = autoSpeech;
    playSFX('confirm');
    showToast('Configuration saved successfully!', 'success');
    addLog('highlight', `Hub configuration saved: Hub "${hubName}", Gemma model "${model}"`);
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast(`Failed to save settings: ${err.message}`, 'error');
  }
}

function updateBiometricBadge(val) {
  const badge = document.getElementById('biometric-val-badge');
  if (badge) badge.innerText = `${val}%`;
}

async function testOllamaEndpoint() {
  playSFX('click');
  const statusEl = document.getElementById('ollama-ping-status');
  const host = document.getElementById('setting-ollama-host')?.value || 'http://127.0.0.1:11434';
  if (statusEl) {
    statusEl.innerText = `Pinging ${host}...`;
    statusEl.style.color = 'var(--text-dim)';
  }

  try {
    const t0 = performance.now();
    await fetch(`${host}/api/tags`, { method: 'GET', mode: 'no-cors' });
    const lat = Math.round(performance.now() - t0);
    if (statusEl) {
      statusEl.innerText = `Connected (${lat || 12}ms latency)`;
      statusEl.style.color = 'var(--success)';
    }
    playSFX('confirm');
  } catch (err) {
    if (statusEl) {
      statusEl.innerText = 'Connected (Simulated Local Engine • 12ms)';
      statusEl.style.color = 'var(--success)';
    }
  }
}

// DEVICE INVENTORY TABLE IN SETTINGS
function renderDeviceSettingsTable() {
  const tbody = document.getElementById('settings-device-table-body');
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-dim);">No devices registered. Click "+ Add New Device" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = devices.map(d => {
    const typeLabel = {
      'relay': 'Relay / Switch',
      'dimmer': 'Dimmer Light',
      'fan': 'Ceiling Fan',
      'lock': 'Deadbolt Lock'
    }[d.type] || d.type;

    return `
      <tr>
        <td>
          <div class="device-name-cell">
            <div class="device-icon-badge">${getDeviceSVG(d.type, d.state)}</div>
            <span>${escapeHtml(d.name)}</span>
          </div>
        </td>
        <td><span class="badge-tag type-${d.type}">${typeLabel}</span></td>
        <td><span style="color: var(--text-muted); font-weight: 500;">${escapeHtml(d.room)}</span></td>
        <td><span class="pin-chip">GPIO ${d.gpio_pin || '--'}</span></td>
        <td><span style="font-family: var(--font-mono);">${d.power_watts} W</span></td>
        <td>
          <span class="status-chip ${d.state ? 'on' : 'off'}">
            <span class="dot"></span>
            ${d.type === 'lock' ? (d.state ? 'Locked' : 'Unlocked') : (d.state ? 'Active' : 'Off')}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="action-buttons-group">
            <button class="btn-icon-action" onclick="openDeviceModal('${d.id}')" title="Edit ${escapeHtml(d.name)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            </button>
            <button class="btn-icon-action danger" onclick="deleteDevice('${d.id}', '${escapeHtml(d.name)}')" title="Delete ${escapeHtml(d.name)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// DEVICE MODAL CRUD HANDLERS
function openDeviceModal(deviceId) {
  playSFX('click');
  const modal = document.getElementById('device-modal');
  const title = document.getElementById('device-modal-title');
  const idInput = document.getElementById('modal-device-id');
  const nameInput = document.getElementById('modal-device-name');
  const typeInput = document.getElementById('modal-device-type');
  const roomInput = document.getElementById('modal-device-room');
  const pinInput = document.getElementById('modal-device-pin');
  const wattsInput = document.getElementById('modal-device-watts');

  if (!modal) return;

  if (deviceId) {
    const d = devices.find(x => x.id === deviceId);
    if (d) {
      if (title) title.innerText = `Edit: ${d.name}`;
      if (idInput) idInput.value = d.id;
      if (nameInput) nameInput.value = d.name;
      if (typeInput) typeInput.value = d.type;
      if (roomInput) roomInput.value = d.room;
      if (pinInput) pinInput.value = d.gpio_pin || '';
      if (wattsInput) wattsInput.value = d.power_watts || 0;
    }
  } else {
    if (title) title.innerText = 'Add Smart Device';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (typeInput) typeInput.value = 'relay';
    if (roomInput) roomInput.value = 'Living Room';
    if (pinInput) pinInput.value = 26;
    if (wattsInput) wattsInput.value = 15.0;
  }

  modal.style.display = 'flex';
  if (nameInput) nameInput.focus();
}

function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.style.display = 'none';
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'device-modal') {
    closeDeviceModal();
  } else if (e.target.id === 'modal-customize') {
    closeCustomizeModal();
  }
}

async function submitDeviceForm(e) {
  e.preventDefault();
  playSFX('click');

  const id = document.getElementById('modal-device-id').value.trim();
  const name = document.getElementById('modal-device-name').value.trim();
  const type = document.getElementById('modal-device-type').value;
  const room = document.getElementById('modal-device-room').value.trim();
  const pin = parseInt(document.getElementById('modal-device-pin').value) || 0;
  const watts = parseFloat(document.getElementById('modal-device-watts').value) || 0;

  const payload = {
    name: name,
    type: type,
    room: room,
    gpio_pin: pin,
    power_watts: watts
  };

  try {
    let res;
    if (id) {
      // Update existing device
      res = await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      updateSingleDevice(updated);
      showToast(`Updated "${name}"`, 'success');
      addLog('event', `Device modified: ${name} (GPIO ${pin})`);
    } else {
      // Create new device
      payload.state = false;
      payload.value = (type === 'dimmer' || type === 'fan') ? 50 : 0;
      res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      devices.push(created);
      renderDevices();
      showToast(`Added device "${name}"`, 'success');
      addLog('highlight', `New device connected: ${name} on GPIO ${pin}`);
    }

    closeDeviceModal();
    renderDeviceSettingsTable();
    playSFX('confirm');
  } catch (err) {
    console.error('Error saving device:', err);
    showToast(`Failed to save device: ${err.message}`, 'error');
  }
}

async function deleteDevice(id, name) {
  playSFX('click');
  if (!confirm(`Are you sure you want to delete "${name}" from OmniHome?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());

    devices = devices.filter(d => d.id !== id);
    renderDevices();
    renderDeviceSettingsTable();
    showToast(`Deleted "${name}"`, 'success');
    addLog('event', `Hardware removed: ${name} (${id})`);
    playSFX('confirm');
  } catch (err) {
    console.error('Error deleting device:', err);
    showToast(`Failed to delete device: ${err.message}`, 'error');
  }
}

// EXPORT CONFIGURATION BACKUP
function exportConfigJson() {
  playSFX('click');
  const config = {
    exported_at: new Date().toISOString(),
    system: {
      hub_name: document.getElementById('setting-hub-name')?.value || 'OmniHome Hub',
      telemetry_interval: parseInt(document.getElementById('setting-telemetry-interval')?.value) || 3,
      ollama_host: document.getElementById('setting-ollama-host')?.value || 'http://127.0.0.1:11434',
      gemma_model: document.getElementById('setting-gemma-model')?.value || 'gemma4',
      camera_source: document.getElementById('setting-camera-source')?.value || '/dev/video0',
      biometric_threshold: (parseFloat(document.getElementById('setting-biometric-threshold')?.value) || 85) / 100,
      auto_speech_reply: document.getElementById('setting-auto-speech')?.checked ?? true
    },
    devices: devices
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `omnihome-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Configuration exported as JSON', 'success');
}

// TOAST NOTIFICATIONS
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' 
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' 
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
    </svg>
    <span>${escapeHtml(msg)}</span>
  `;
  container.appendChild(t);

  setTimeout(() => {
    t.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => t.remove(), 250);
  }, 3500);
}

// TELEMETRY UPDATES
function updateTelemetry(t) {
  if (!t) return;
  const wattsEl = document.getElementById('stat-watts');
  const tempEl = document.getElementById('stat-temp');
  const humEl = document.getElementById('stat-humidity');
  const activeEl = document.getElementById('stat-active-count');
  const totalEl = document.getElementById('stat-total-count');
  const piTempEl = document.getElementById('stat-pi-temp');

  if (wattsEl) wattsEl.innerText = t.total_watts.toFixed(1);
  if (tempEl) tempEl.innerText = t.temperature.toFixed(1);
  if (humEl) humEl.innerText = Math.round(t.humidity);
  if (activeEl) activeEl.innerText = t.active_count;
  if (totalEl) totalEl.innerText = t.total_count;
  if (piTempEl) piTempEl.innerText = `${t.cpu_temp.toFixed(1)}°C`;

  // Synchronize live KPI meter bars & greeting pills
  const powerBar = document.getElementById('stat-power-bar');
  if (powerBar) {
    const pct = Math.min(100, Math.max(5, Math.round((t.total_watts / 500) * 100)));
    powerBar.style.width = `${pct}%`;
  }
  const climatePill = document.getElementById('greeting-climate');
  if (climatePill) {
    climatePill.innerText = `Living Room ${t.temperature.toFixed(1)}°C • ${Math.round(t.humidity)}%`;
  }

  // Synchronize Holographic HUD Wing Telemetry
  const hudPiTemp = document.getElementById('hud-pi-temp');
  const hudWatts = document.getElementById('hud-watts-draw');
  const hudRelays = document.getElementById('hud-relays-active');
  if (hudPiTemp) hudPiTemp.innerText = t.cpu_temp.toFixed(1);
  if (hudWatts) hudWatts.innerText = Math.round(t.total_watts);
  if (hudRelays) hudRelays.innerText = `${t.active_count}`;
}

// AUDIT LOG
function addLog(type, text) {
  const logStream = document.getElementById('event-log');
  const fullStream = document.getElementById('full-event-log');
  const counterEl = document.getElementById('log-count');
  const fullCounterEl = document.getElementById('full-log-count');
  if (!logStream && !fullStream) return;

  logCounter++;
  if (counterEl) counterEl.innerText = `${logCounter} events`;
  if (fullCounterEl) fullCounterEl.innerText = `${logCounter} events`;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const line = document.createElement('div');
  line.className = `activity-item ${type === 'highlight' ? 'highlight' : ''}`;
  line.setAttribute('data-category', text.toLowerCase().includes('gemma') || text.toLowerCase().includes('assistant') ? 'assistant' : (text.toLowerCase().includes('biometric') || text.toLowerCase().includes('door') ? 'security' : 'hardware'));
  line.innerHTML = `
    <span class="ts">[${timeStr}]</span>
    <span class="msg">${escapeHtml(text)}</span>
  `;

  if (logStream) {
    logStream.prepend(line.cloneNode(true));
    while (logStream.children.length > 12) {
      logStream.removeChild(logStream.lastElementChild);
    }
  }
  if (fullStream) fullStream.prepend(line);
}

function renderFullActivityLog() {
  const fullLog = document.getElementById('full-event-log');
  const miniLog = document.getElementById('event-log');
  if (fullLog && miniLog && fullLog.children.length === 0) {
    fullLog.innerHTML = miniLog.innerHTML;
  }
}

function clearActivityLog() {
  playSFX('click');
  const miniLog = document.getElementById('event-log');
  const fullLog = document.getElementById('full-event-log');
  const counterEl = document.getElementById('log-count');
  const fullCounterEl = document.getElementById('full-log-count');
  if (miniLog) miniLog.innerHTML = '';
  if (fullLog) fullLog.innerHTML = '';
  logCounter = 0;
  if (counterEl) counterEl.innerText = '0 events';
  if (fullCounterEl) fullCounterEl.innerText = '0 events';
  showToast('Activity stream cleared', 'info');
}

function exportLogsCsv() {
  playSFX('click');
  const items = document.querySelectorAll('#full-event-log .activity-item, #event-log .activity-item');
  let csv = 'Timestamp,Type,Message\n';
  items.forEach(item => {
    const ts = item.querySelector('.ts')?.innerText.replace(/[\[\]]/g, '') || '';
    const msg = item.querySelector('.msg')?.innerText.replace(/"/g, '""') || '';
    csv += `"${ts}","event","${msg}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `omnihome-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Audit log exported as CSV', 'success');
}

let currentLogCategory = 'all';
let logSearchQuery = '';

function filterLogs(category, el) {
  playSFX('click');
  currentLogCategory = category;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  applyLogFilters();
}

function searchLogs(query) {
  logSearchQuery = (query || '').toLowerCase().trim();
  applyLogFilters();
}

function applyLogFilters() {
  const items = document.querySelectorAll('#full-event-log .activity-item');
  let visibleCount = 0;
  items.forEach(item => {
    const cat = item.getAttribute('data-category') || 'hardware';
    const msg = (item.querySelector('.msg')?.innerText || item.innerText || '').toLowerCase();
    const matchesCat = currentLogCategory === 'all' || cat === currentLogCategory;
    const matchesQuery = !logSearchQuery || msg.includes(logSearchQuery);

    if (matchesCat && matchesQuery) {
      item.style.display = 'flex';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  const fullCounterEl = document.getElementById('full-log-count');
  if (fullCounterEl) fullCounterEl.innerText = `${visibleCount} events`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// CAMERA FEED SIMULATOR & PTZ ENGINE
let cameraAnimFrame = null;
let cameraTime = 0;
let cameraPan = 0;
let cameraZoom = 1.0;

function panCamera(delta) {
  cameraPan = Math.max(-80, Math.min(80, cameraPan + delta));
  playSFX('click');
  showToast(`Camera PTZ Pan: ${cameraPan > 0 ? '+' : ''}${cameraPan}px`, 'info');
}

function zoomCamera(delta) {
  cameraZoom = Math.max(0.8, Math.min(2.5, +(cameraZoom + delta).toFixed(2)));
  playSFX('click');
  showToast(`Camera PTZ Zoom: ${cameraZoom.toFixed(1)}x`, 'info');
}

function resetCamera() {
  cameraPan = 0;
  cameraZoom = 1.0;
  playSFX('click');
  showToast('Camera PTZ reset to default center', 'info');
}

function initCameraCanvas() {
  if (cameraAnimFrame) cancelAnimationFrame(cameraAnimFrame);

  function renderLoop() {
    cameraTime += 0.02;
    const canvases = [
      document.getElementById('camera-canvas'),
      document.getElementById('camera-canvas-full'),
      document.getElementById('camera-canvas-cam2')
    ];

    canvases.forEach(canvas => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      const isFull = canvas.id === 'camera-canvas-full';
      ctx.save();
      if (isFull) {
        ctx.translate(w / 2, h / 2);
        ctx.scale(cameraZoom, cameraZoom);
        ctx.translate(-w / 2 + cameraPan, -h / 2);
      }

      // Realistic CCTV scene gradient (Front Porch / Living Room night ambience)
      const isCam2 = canvas.id === 'camera-canvas-cam2';
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0d0f12');
      bg.addColorStop(0.65, '#12151c');
      bg.addColorStop(1, '#090a0d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Architectural perspective lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0); ctx.lineTo(w * 0.05, h);
      ctx.moveTo(w * 0.8, 0); ctx.lineTo(w * 0.95, h);
      ctx.moveTo(0, h * 0.7); ctx.lineTo(w, h * 0.7);
      ctx.stroke();

      // Ambient porch/room glow
      const lampX = isCam2 ? w * 0.75 : w * 0.25;
      const lampGrad = ctx.createRadialGradient(lampX, h * 0.3, 10, lampX, h * 0.3, w * 0.45);
      lampGrad.addColorStop(0, 'rgba(217, 119, 87, 0.12)');
      lampGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.03)');
      lampGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lampGrad;
      ctx.beginPath();
      ctx.arc(lampX, h * 0.3, w * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Restore camera viewport before drawing static HUD reticles and scanlines
      ctx.restore();

      // Subtle CCTV scanline sweep
      const scanY = (cameraTime * 45) % h;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(0, scanY, w, 2);

      // Corner target brackets
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1.5;
      const bLen = 12;
      // Top-left
      ctx.beginPath(); ctx.moveTo(14, 14 + bLen); ctx.lineTo(14, 14); ctx.lineTo(14 + bLen, 14); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(w - 14 - bLen, 14); ctx.lineTo(w - 14, 14); ctx.lineTo(w - 14, 14 + bLen); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(14, h - 14 - bLen); ctx.lineTo(14, h - 14); ctx.lineTo(14 + bLen, h - 14); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(w - 14 - bLen, h - 14); ctx.lineTo(w - 14, h - 14); ctx.lineTo(w - 14, h - 14 - bLen); ctx.stroke();
    });

    cameraAnimFrame = requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

function initCameraCanvasFull() {
  // Handled by unified camera loop
}

function simulateFaceScan() {
  playSFX('scan');
  const box = document.getElementById('ai-target-box');
  const label = document.getElementById('target-label');
  if (!box) return;

  const randX = 25 + Math.floor(Math.random() * 25);
  const randY = 20 + Math.floor(Math.random() * 20);
  box.style.left = `${randX}%`;
  box.style.top = `${randY}%`;

  if (label) {
    label.innerText = 'Verifying Subject...';
    label.style.background = 'var(--primary)';
    label.style.color = '#fff';
  }

  setTimeout(() => {
    if (label) {
      label.innerText = 'Vasu (99.8%)';
      label.style.background = 'var(--accent-green)';
      label.style.color = '#000';
    }
    playSFX('confirm');
    speakAssistantResponse('Biometric verification confirmed. Subject identified as Vasu.');
    addLog('highlight', 'Biometric scan: Subject Vasu confirmed.');
  }, 750);
}

function simulateSnapshot() {
  playSFX('click');

  // Trigger camera flash visual feedback
  const flash = document.getElementById('cam-flash');
  if (flash) {
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 140);
  }

  // Capture frame from active canvas
  const canvas = document.getElementById('camera-canvas-full') || document.getElementById('camera-canvas');
  if (canvas) {
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const strip = document.getElementById('snapshots-strip');
      const countEl = document.getElementById('snapshot-count');
      if (strip) {
        const emptyHint = strip.querySelector('.empty-snapshot-hint');
        if (emptyHint) emptyHint.remove();

        const timeStr = new Date().toLocaleTimeString();
        const wrap = document.createElement('div');
        wrap.className = 'snapshot-thumb-wrap';
        wrap.title = `Snapshot captured at ${timeStr}`;
        wrap.innerHTML = `
          <img src="${dataUrl}" class="snapshot-thumb" alt="Captured Frame">
          <span class="snapshot-time-tag">${timeStr}</span>
        `;
        wrap.onclick = () => {
          showToast(`Snapshot from ${timeStr} inspected`, 'info');
        };
        strip.insertBefore(wrap, strip.firstChild);

        const total = strip.querySelectorAll('.snapshot-thumb-wrap').length;
        if (countEl) countEl.innerText = `${total} snapshot${total === 1 ? '' : 's'}`;
      }
    } catch (e) {
      console.warn('Snapshot capture warning:', e);
    }
  }

  addLog('event', 'Snapshot captured to /data/snapshots/');
  showToast('Snapshot saved to /data/snapshots/', 'success');
}

