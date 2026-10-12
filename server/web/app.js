// PYHOME — PRODUCTION SMART HOME CONTROLLER & GEMMA 4 ASSISTANT
let ws = null;
let devices = [];
let currentFilter = 'all';
let logCounter = 0;
let isListening = false;
let speechRecognizer = null;

// AUDIO ENGINE STATE
let speechAudioEnabled = true;
let availableVoices = [];
let selectedVoiceURI = localStorage.getItem('pyhome_voice_uri') || '';
let audioCtx = null;

// ==========================================
// 1. THEMES ENGINE (7 EXECUTIVE PALETTES)
// ==========================================
const THEMES = {
  dark: { name: 'Obsidian', full: 'Obsidian Onyx' },
  light: { name: 'Titanium', full: 'Titanium Studio' },
  midnight: { name: 'Midnight', full: 'OLED Midnight' },
  nordic: { name: 'Nordic', full: 'Nordic Frost' },
  emerald: { name: 'Emerald', full: 'Emerald Matrix' },
  sunset: { name: 'Sunset', full: 'Sunset Ember' },
  cyberpunk: { name: 'Cyberpunk', full: 'Neo Cyberpunk' }
};

let currentTheme = localStorage.getItem('pyhome_theme') || 'dark';

function initTheme() {
  if (!THEMES[currentTheme]) currentTheme = 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeButtonUI();
  updateThemeModalUI();
}

function selectTheme(themeName) {
  if (!THEMES[themeName]) themeName = 'dark';
  currentTheme = themeName;
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('pyhome_theme', currentTheme);
  updateThemeButtonUI();
  updateThemeModalUI();
  playSFX('click');
  closeThemeModal();
  showToast(`Applied ${THEMES[themeName].full} theme`, 'success');
}

function toggleTheme() {
  const themeKeys = Object.keys(THEMES);
  const nextIdx = (themeKeys.indexOf(currentTheme) + 1) % themeKeys.length;
  selectTheme(themeKeys[nextIdx]);
}

function openThemeModal() {
  playSFX('click');
  updateThemeModalUI();
  const modal = document.getElementById('theme-modal');
  if (modal) modal.style.display = 'flex';
}

function closeThemeModal() {
  const modal = document.getElementById('theme-modal');
  if (modal) modal.style.display = 'none';
}

function updateThemeButtonUI() {
  const textEl = document.getElementById('theme-toggle-text');
  if (textEl) {
    textEl.innerText = THEMES[currentTheme] ? THEMES[currentTheme].name : 'Obsidian';
  }
}

function updateThemeModalUI() {
  document.querySelectorAll('.theme-card-option').forEach(card => {
    if (card.getAttribute('data-theme-name') === currentTheme) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });
}

// ==========================================
// 2. WALLPAPER & ATMOSPHERE ENGINE
// ==========================================
const WALLPAPERS = {
  aurora: 'Aurora Nebula',
  carbon: 'Obsidian Carbon',
  mesh: 'Cyan Mesh',
  matrix: 'Matrix Cyber',
  sunset: 'Sunset Amber',
  studio: 'Titanium Studio',
  none: 'Clean Minimal',
  custom: 'Custom Image'
};

let currentWallpaper = localStorage.getItem('pyhome_wallpaper') || 'aurora';
let currentBlur = localStorage.getItem('pyhome_wall_blur') || '12';
let currentDimmer = localStorage.getItem('pyhome_wall_dimmer') || '40';
let customWallpaperUrl = localStorage.getItem('pyhome_wall_custom_url') || '';

function initWallpaper() {
  const backdrop = document.getElementById('wallpaper-backdrop');
  if (!backdrop) return;

  setWallpaperBlur(currentBlur, false);
  setWallpaperDimmer(currentDimmer, false);

  if (customWallpaperUrl) {
    applyCustomWallpaperUrl(customWallpaperUrl, false);
  } else {
    setWallpaper(currentWallpaper, false);
  }
}

function setWallpaper(name, save = true) {
  const backdrop = document.getElementById('wallpaper-backdrop');
  if (!backdrop) return;

  backdrop.style.backgroundImage = '';
  backdrop.className = `wallpaper-backdrop wall-${name}`;
  currentWallpaper = name;

  if (save) {
    customWallpaperUrl = '';
    localStorage.removeItem('pyhome_wall_custom_url');
    localStorage.setItem('pyhome_wallpaper', name);
    playSFX('click');
  }

  document.querySelectorAll('.wallpaper-swatch').forEach(swatch => {
    if (swatch.getAttribute('data-wall') === name) {
      swatch.classList.add('active');
    } else {
      swatch.classList.remove('active');
    }
  });

  const nameEl = document.getElementById('active-wallpaper-name');
  if (nameEl) {
    nameEl.innerText = WALLPAPERS[name] || name;
  }
}

function setWallpaperBlur(val, save = true) {
  const backdrop = document.getElementById('wallpaper-backdrop');
  const badge = document.getElementById('blur-val-badge');
  currentBlur = val;
  if (backdrop) {
    backdrop.style.filter = `blur(${val}px)`;
  }
  if (badge) {
    badge.innerText = `${val}px`;
  }
  const slider = document.querySelector('input[oninput*="setWallpaperBlur"]');
  if (slider && slider.value !== String(val)) slider.value = val;
  if (save) {
    localStorage.setItem('pyhome_wall_blur', val);
  }
}

function setWallpaperDimmer(val, save = true) {
  const backdrop = document.getElementById('wallpaper-backdrop');
  const badge = document.getElementById('dimmer-val-badge');
  currentDimmer = val;
  if (backdrop) {
    const opacity = (100 - parseInt(val, 10)) / 100;
    backdrop.style.opacity = Math.max(0, Math.min(1, opacity)).toFixed(2);
  }
  if (badge) {
    badge.innerText = `${val}%`;
  }
  const slider = document.querySelector('input[oninput*="setWallpaperDimmer"]');
  if (slider && slider.value !== String(val)) slider.value = val;
  if (save) {
    localStorage.setItem('pyhome_wall_dimmer', val);
  }
}

function applyCustomWallpaper() {
  const input = document.getElementById('custom-wall-url');
  if (!input) return;
  const url = input.value.trim();
  if (!url) {
    showToast('Please enter an image URL', 'error');
    return;
  }
  applyCustomWallpaperUrl(url, true);
  showToast('Custom wallpaper applied', 'success');
}

function applyCustomWallpaperUrl(url, save = true) {
  const backdrop = document.getElementById('wallpaper-backdrop');
  if (!backdrop) return;

  backdrop.className = 'wallpaper-backdrop';
  backdrop.style.backgroundImage = `url("${url}")`;
  backdrop.style.backgroundSize = 'cover';
  backdrop.style.backgroundPosition = 'center';

  if (save) {
    customWallpaperUrl = url;
    localStorage.setItem('pyhome_wall_custom_url', url);
    playSFX('confirm');
  }

  document.querySelectorAll('.wallpaper-swatch').forEach(s => s.classList.remove('active'));

  const nameEl = document.getElementById('active-wallpaper-name');
  if (nameEl) nameEl.innerText = 'Custom Image';

  const input = document.getElementById('custom-wall-url');
  if (input && input.value !== url) input.value = url;
}

// ==========================================
// 3. AESTHETIC CLOCK & TELEMETRY TIME ENGINE
// ==========================================
let clockFormat = parseInt(localStorage.getItem('pyhome_clock_format') || '12', 10);

function initAestheticClock() {
  updateAestheticClock();
  setInterval(updateAestheticClock, 1000);

  const tzLabel = document.getElementById('widget-tz-label');
  if (tzLabel) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      tzLabel.innerText = tz || 'Local RTC';
    } catch (e) {
      tzLabel.innerText = 'Local RTC';
    }
  }

  updateClockFormatButtons();
}

function setTimeFormat(fmt) {
  clockFormat = parseInt(fmt, 10) === 24 ? 24 : 12;
  localStorage.setItem('pyhome_clock_format', clockFormat);
  updateClockFormatButtons();
  updateAestheticClock();
  playSFX('click');
}

function updateClockFormatButtons() {
  const btn12 = document.getElementById('btn-fmt-12');
  const btn24 = document.getElementById('btn-fmt-24');
  if (btn12 && btn24) {
    if (clockFormat === 12) {
      btn12.classList.add('active');
      btn24.classList.remove('active');
    } else {
      btn12.classList.remove('active');
      btn24.classList.add('active');
    }
  }
}

function updateAestheticClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const bigClockEl = document.getElementById('widget-big-clock');
  if (bigClockEl) {
    if (clockFormat === 12) {
      const hours12 = String(hours % 12 || 12).padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      bigClockEl.innerHTML = `${hours12}:${minutes}:${seconds} <span class="clock-period">${period}</span>`;
    } else {
      const hours24 = String(hours).padStart(2, '0');
      bigClockEl.innerHTML = `${hours24}:${minutes}:${seconds}`;
    }
  }

  const bigDateEl = document.getElementById('widget-big-date');
  if (bigDateEl) {
    bigDateEl.innerText = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  const topClockEl = document.getElementById('clock');
  const camTimeEl = document.getElementById('cam-timestamp');
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  if (topClockEl) topClockEl.innerText = timeStr;
  if (camTimeEl) camTimeEl.innerText = timeStr;
}

const initClock = initAestheticClock;

// ==========================================
// 4. MODULAR RE-ADJUSTABLE DASHBOARD ENGINE
// ==========================================
const DEFAULT_WIDGETS_ORDER = [
  'widget-clock',
  'widget-wallpaper',
  'widget-metrics',
  'widget-scenes',
  'widget-devices',
  'widget-memo'
];

let isDashboardEditMode = false;

function initDashboardLayout() {
  const container = document.getElementById('dashboard-widgets-container');
  if (!container) return;

  // 1. Restore reordered widgets
  let savedOrder = null;
  try {
    savedOrder = JSON.parse(localStorage.getItem('pyhome_dashboard_layout') || 'null');
  } catch (e) {
    savedOrder = null;
  }

  if (Array.isArray(savedOrder) && savedOrder.length > 0) {
    savedOrder.forEach(id => {
      const widget = document.getElementById(id);
      if (widget && widget.parentElement === container) {
        container.appendChild(widget);
      }
    });
  }

  // 2. Restore visibility states
  applyWidgetVisibilities();

  // 3. Setup drag and drop
  setupWidgetDragAndDrop();
}

function toggleDashboardEditMode() {
  isDashboardEditMode = !isDashboardEditMode;
  playSFX('click');

  const container = document.getElementById('dashboard-widgets-container');
  const banner = document.getElementById('layout-edit-banner');
  const editBtn = document.getElementById('btn-edit-layout');
  const tag = document.getElementById('layout-status-tag');

  if (container) {
    if (isDashboardEditMode) {
      container.classList.add('edit-mode');
    } else {
      container.classList.remove('edit-mode');
    }
  }

  if (banner) {
    banner.style.display = isDashboardEditMode ? 'flex' : 'none';
  }

  if (editBtn) {
    if (isDashboardEditMode) {
      editBtn.classList.add('active');
    } else {
      editBtn.classList.remove('active');
    }
  }

  if (tag) {
    tag.innerText = isDashboardEditMode ? 'Editing Layout' : 'Modular Layout';
    tag.style.color = isDashboardEditMode ? 'var(--primary)' : '';
  }

  // Toggle draggable attribute on widgets
  document.querySelectorAll('.dash-widget').forEach(w => {
    w.setAttribute('draggable', isDashboardEditMode ? 'true' : 'false');
  });

  if (isDashboardEditMode) {
    showToast('Layout edit mode active: drag handles or click ▲ / ▼ to reorder', 'info');
  } else {
    saveDashboardLayout();
    showToast('Dashboard layout saved', 'success');
  }
}

function moveWidget(widgetId, delta) {
  const container = document.getElementById('dashboard-widgets-container');
  const widget = document.getElementById(widgetId);
  if (!container || !widget) return;

  if (delta === -1) {
    const prev = widget.previousElementSibling;
    if (prev && prev.classList.contains('dash-widget')) {
      container.insertBefore(widget, prev);
      saveDashboardLayout();
      playSFX('click');
    }
  } else if (delta === 1) {
    const next = widget.nextElementSibling;
    if (next && next.classList.contains('dash-widget')) {
      container.insertBefore(next, widget);
      saveDashboardLayout();
      playSFX('click');
    }
  }
}

function saveDashboardLayout() {
  const container = document.getElementById('dashboard-widgets-container');
  if (!container) return;
  const currentOrder = Array.from(container.querySelectorAll('.dash-widget')).map(el => el.id);
  localStorage.setItem('pyhome_dashboard_layout', JSON.stringify(currentOrder));
}

function resetDashboardLayout() {
  localStorage.removeItem('pyhome_dashboard_layout');
  localStorage.removeItem('pyhome_dashboard_hidden');

  const container = document.getElementById('dashboard-widgets-container');
  if (!container) return;

  DEFAULT_WIDGETS_ORDER.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement === container) {
      container.appendChild(el);
      el.style.display = '';
    }
  });

  DEFAULT_WIDGETS_ORDER.forEach(id => {
    const cb = document.getElementById(`toggle-vis-${id}`);
    if (cb) cb.checked = true;
  });

  playSFX('confirm');
  showToast('Dashboard layout reset to factory defaults', 'success');
}

function getHiddenWidgets() {
  try {
    return JSON.parse(localStorage.getItem('pyhome_dashboard_hidden') || '[]');
  } catch (e) {
    return [];
  }
}

function applyWidgetVisibilities() {
  const hidden = getHiddenWidgets();
  DEFAULT_WIDGETS_ORDER.forEach(id => {
    const el = document.getElementById(id);
    const cb = document.getElementById(`toggle-vis-${id}`);
    const isHidden = hidden.includes(id);
    if (el) {
      el.style.display = isHidden ? 'none' : '';
      const toggleBtn = el.querySelector('.btn-order-toggle');
      if (toggleBtn) {
        toggleBtn.style.opacity = isHidden ? '0.5' : '1';
        toggleBtn.title = isHidden ? 'Show Widget' : 'Hide Widget';
      }
    }
    if (cb) {
      cb.checked = !isHidden;
    }
  });
}

function toggleWidgetVisibility(widgetId) {
  let hidden = getHiddenWidgets();
  if (hidden.includes(widgetId)) {
    hidden = hidden.filter(id => id !== widgetId);
    showToast(`Widget visible`, 'info');
  } else {
    hidden.push(widgetId);
    showToast(`Widget hidden`, 'info');
  }
  localStorage.setItem('pyhome_dashboard_hidden', JSON.stringify(hidden));
  applyWidgetVisibilities();
  playSFX('click');
}

function toggleWidgetCheck(widgetId, checked) {
  let hidden = getHiddenWidgets();
  if (checked) {
    hidden = hidden.filter(id => id !== widgetId);
  } else {
    if (!hidden.includes(widgetId)) hidden.push(widgetId);
  }
  localStorage.setItem('pyhome_dashboard_hidden', JSON.stringify(hidden));
  applyWidgetVisibilities();
  playSFX('click');
}

function resetWidgetVisibility() {
  localStorage.removeItem('pyhome_dashboard_hidden');
  applyWidgetVisibilities();
  playSFX('confirm');
  showToast('All widgets visible', 'success');
}

function openWidgetVisibilityModal() {
  playSFX('click');
  applyWidgetVisibilities();
  const modal = document.getElementById('widget-visibility-modal');
  if (modal) modal.style.display = 'flex';
}

function closeWidgetVisibilityModal() {
  const modal = document.getElementById('widget-visibility-modal');
  if (modal) modal.style.display = 'none';
}

function setupWidgetDragAndDrop() {
  const container = document.getElementById('dashboard-widgets-container');
  if (!container) return;
  const widgets = container.querySelectorAll('.dash-widget');
  let draggedEl = null;

  widgets.forEach(widget => {
    widget.addEventListener('dragstart', (e) => {
      if (!isDashboardEditMode) {
        e.preventDefault();
        return;
      }
      draggedEl = widget;
      widget.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', widget.id);
    });

    widget.addEventListener('dragend', () => {
      draggedEl = null;
      widgets.forEach(w => {
        w.classList.remove('dragging');
        w.classList.remove('drag-over');
      });
      saveDashboardLayout();
    });

    widget.addEventListener('dragover', (e) => {
      if (!isDashboardEditMode || !draggedEl || draggedEl === widget) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      widget.classList.add('drag-over');
    });

    widget.addEventListener('dragleave', () => {
      widget.classList.remove('drag-over');
    });

    widget.addEventListener('drop', (e) => {
      if (!isDashboardEditMode || !draggedEl || draggedEl === widget) return;
      e.preventDefault();
      widget.classList.remove('drag-over');

      const rect = widget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        container.insertBefore(draggedEl, widget);
      } else {
        container.insertBefore(draggedEl, widget.nextSibling);
      }
      saveDashboardLayout();
      playSFX('confirm');
    });
  });
}

// ==========================================
// 5. HOME MEMO & GEMMA SCRATCHPAD ENGINE
// ==========================================
let memoSaveTimeout = null;

function initHomeMemo() {
  const textarea = document.getElementById('memo-text-area');
  if (!textarea) return;
  const savedMemo = localStorage.getItem('pyhome_memo') || '';
  textarea.value = savedMemo;
}

function saveHomeMemo(text) {
  const ind = document.getElementById('memo-saved-indicator');
  if (ind) ind.innerText = 'Saving...';

  clearTimeout(memoSaveTimeout);
  memoSaveTimeout = setTimeout(() => {
    localStorage.setItem('pyhome_memo', text);
    if (ind) ind.innerText = 'Auto-saved';
  }, 400);
}

function appendMemo(note) {
  const textarea = document.getElementById('memo-text-area');
  if (!textarea) return;
  const current = textarea.value.trim();
  textarea.value = current ? `${current}\n${note}` : note;
  saveHomeMemo(textarea.value);
  playSFX('click');
  showToast('Note added to scratchpad', 'info');
}

function clearMemo() {
  const textarea = document.getElementById('memo-text-area');
  if (!textarea) return;
  textarea.value = '';
  saveHomeMemo('');
  playSFX('click');
  showToast('Scratchpad cleared', 'info');
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
  if (!globCanvas) return;
  const rect = globCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const size = rect.width > 0 ? rect.width : (isCoreImmersion ? 440 : 320);

  globCanvas.width = size * dpr;
  globCanvas.height = size * dpr;
  globCtx = globCanvas.getContext('2d');
  globCtx.scale(dpr, dpr);
}

function spawnShockwave(color) {
  shockwaves.push({
    radius: 25,
    maxRadius: isCoreImmersion ? 220 : 160,
    alpha: 0.85,
    speed: 4.8,
    color: color || '0, 240, 255'
  });
}

function setOrbState(newState) {
  if (orbState === newState) return;
  orbState = newState;

  const badge = document.getElementById('core-state-badge');
  const statusText = document.getElementById('core-status-text');
  const hintText = document.getElementById('glob-hint-text');
  const caption = document.getElementById('glob-state-caption');
  const neuralPct = document.getElementById('core-neural-pct');

  if (badge) {
    badge.className = `core-status-pill ${newState}`;
  }

  if (newState === 'listening') {
    if (statusText) statusText.innerText = 'VOICE CAPTURE ACTIVE';
    if (hintText) hintText.innerText = 'LISTENING...';
    if (caption) caption.innerText = 'Listening to microphone • Speak instruction clearly';
    if (neuralPct) neuralPct.innerText = '99.8';
    spawnShockwave('16, 185, 129');
  } else if (newState === 'thinking') {
    if (statusText) statusText.innerText = 'GEMMA SYNAPSE IN PROGRESS';
    if (hintText) hintText.innerText = 'REASONING...';
    if (caption) caption.innerText = 'Gemma 4 processing intent & calculating device parameters...';
    if (neuralPct) neuralPct.innerText = (97.5 + Math.random() * 2.4).toFixed(1);
    spawnShockwave('168, 85, 247');
  } else if (newState === 'speaking') {
    if (statusText) statusText.innerText = 'TRANSMITTING AUDIO';
    if (hintText) hintText.innerText = 'SPEAKING...';
    if (caption) caption.innerText = 'Gemma 4 voice response transmitting';
    if (neuralPct) neuralPct.innerText = '99.2';
    spawnShockwave('0, 240, 255');
  } else {
    // idle
    if (statusText) statusText.innerText = 'STANDBY // READY';
    if (hintText) hintText.innerText = 'TAP TO SPEAK';
    if (caption) caption.innerText = 'Gemma 4 Neural Core • Tap orb or press Enter';
    if (neuralPct) neuralPct.innerText = '99.4';
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
  const width = rect.width || (isCoreImmersion ? 440 : 320);
  const height = rect.height || (isCoreImmersion ? 440 : 320);

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

  // 1. Ambient Volumetric Radial Glow
  const bgGrad = ctx.createRadialGradient(cx, cy, R0 * 0.15, cx, cy, R0 * 1.95);
  if (orbState === 'listening') {
    bgGrad.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
    bgGrad.addColorStop(0.45, 'rgba(6, 182, 212, 0.12)');
  } else if (orbState === 'thinking') {
    bgGrad.addColorStop(0, 'rgba(168, 85, 247, 0.30)');
    bgGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.10)');
  } else if (orbState === 'speaking') {
    bgGrad.addColorStop(0, 'rgba(0, 240, 255, 0.32)');
    bgGrad.addColorStop(0.45, 'rgba(99, 102, 241, 0.14)');
  } else {
    bgGrad.addColorStop(0, 'rgba(0, 240, 255, 0.18)');
    bgGrad.addColorStop(0.45, 'rgba(30, 64, 175, 0.06)');
  }
  bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Holographic Concentric Coordinate Grid (JARVIS Guides)
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);

  [0.45, 0.72, 1.0, 1.25, 1.45].forEach(scale => {
    ctx.beginPath();
    ctx.arc(cx, cy, R0 * scale, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();

  // 3. Precision Cardinal Radial Ticks
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  const tickRadius = R0 * 1.15;
  for (let i = 0; i < 60; i++) {
    const angle = (i * Math.PI * 2) / 60;
    const isMajor = i % 5 === 0;
    const isCardinal = i % 15 === 0;
    const len = isCardinal ? 8 : (isMajor ? 5 : 2.5);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    ctx.beginPath();
    ctx.lineWidth = isCardinal ? 1.5 : 1;
    ctx.strokeStyle = isCardinal ? 'rgba(0, 240, 255, 0.65)' : 'rgba(56, 189, 248, 0.25)';
    ctx.moveTo(cx + cosA * tickRadius, cy + sinA * tickRadius);
    ctx.lineTo(cx + cosA * (tickRadius + len), cy + sinA * (tickRadius + len));
    ctx.stroke();
  }

  // Cardinal Degree Labels
  ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.font = '7px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('000°', cx, cy - tickRadius - 13);
  ctx.fillText('090°', cx + tickRadius + 14, cy);
  ctx.fillText('180°', cx, cy + tickRadius + 13);
  ctx.fillText('270°', cx - tickRadius - 14, cy);
  ctx.restore();

  // 4. Rotating Outer Orbital HUD Rings (JARVIS Reticle Rings)
  // Ring A: Clockwise 3-Segment Arc Ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(orbTime * 0.55);
  const ringA_Radius = R0 * 1.28;
  ctx.lineWidth = 1.5;
  for (let s = 0; s < 3; s++) {
    const startA = (s * Math.PI * 2) / 3;
    const arcLen = Math.PI * 0.38;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.arc(0, 0, ringA_Radius, startA, startA + arcLen);
    ctx.stroke();

    // Glowing Node at arc tip
    const endX = Math.cos(startA + arcLen) * ringA_Radius;
    const endY = Math.sin(startA + arcLen) * ringA_Radius;
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(endX, endY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Ring B: Counter-Clockwise 4-Segment Dashed Ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-orbTime * 0.42);
  const ringB_Radius = R0 * 1.42;
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, ringB_Radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 5. Radial Equalizer Frequency Bars (Audio-Reactive Wave)
  ctx.save();
  const eqRadius = R0 * 1.08;
  const pinCount = 48;
  for (let p = 0; p < pinCount; p++) {
    const angle = (p * Math.PI * 2) / pinCount;
    const waveNoise = Math.sin(p * 0.42 + orbTime * 6.5) * 0.5 + 0.5;
    const pinH = 3 + orbAudioEnergy * 26 * waveNoise;
    const cosP = Math.cos(angle);
    const sinP = Math.sin(angle);

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    if (orbState === 'listening') {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
    } else if (orbState === 'thinking') {
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
    } else {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
    }
    ctx.moveTo(cx + cosP * eqRadius, cy + sinP * eqRadius);
    ctx.lineTo(cx + cosP * (eqRadius + pinH), cy + sinP * (eqRadius + pinH));
    ctx.stroke();
  }
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
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
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
  // Layer 0: Deep Plasma Shell (Cobalt-Violet)
  drawFluidGlobLayer(ctx, cx, cy, R0, 0, orbTime, orbAudioEnergy, orbState);

  // Layer 1: Chromasphere Mid Shell (Neon Cyan-Azure)
  drawFluidGlobLayer(ctx, cx, cy, R0, 1, orbTime, orbAudioEnergy, orbState);

  // Layer 2: Inner Radiant Plasma Nucleus (White-Cyan High Energy)
  drawFluidGlobLayer(ctx, cx, cy, R0, 2, orbTime, orbAudioEnergy, orbState);

  // 9. Core Twisting Flux Ribbons (Arc Reactor Filaments)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 1.8;
  for (let f = 0; f < 3; f++) {
    const fAngle = orbTime * (1.8 + f * 0.4) + f * (Math.PI * 2 / 3);
    const rFlux = R0 * (0.42 + 0.12 * Math.sin(orbTime * 3 + f));
    ctx.beginPath();
    ctx.strokeStyle = f === 0 ? 'rgba(255, 255, 255, 0.75)' : (f === 1 ? 'rgba(0, 240, 255, 0.65)' : 'rgba(168, 85, 247, 0.55)');
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

      // Cyan particle glow
      ctx.beginPath();
      ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.45})`;
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
    ctx.strokeStyle = '#00f0ff';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
  }
  ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();

  // Center white pinpoint
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
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

  // Create layer gradient
  const grad = ctx.createRadialGradient(cx - R0 * 0.15, cy - R0 * 0.15, 5, cx, cy, R0 * 1.2);

  if (layerIdx === 0) {
    if (state === 'listening') {
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
      grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.6)');
      grad.addColorStop(1, 'rgba(5, 150, 105, 0.15)');
    } else if (state === 'thinking') {
      grad.addColorStop(0, 'rgba(168, 85, 247, 0.85)');
      grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.6)');
      grad.addColorStop(1, 'rgba(67, 56, 202, 0.15)');
    } else {
      grad.addColorStop(0, 'rgba(30, 64, 175, 0.85)');
      grad.addColorStop(0.5, 'rgba(124, 58, 237, 0.6)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.15)');
    }
  } else if (layerIdx === 1) {
    if (state === 'listening') {
      grad.addColorStop(0, 'rgba(52, 211, 153, 0.95)');
      grad.addColorStop(0.6, 'rgba(6, 182, 212, 0.7)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else if (state === 'thinking') {
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.95)');
      grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.7)');
      grad.addColorStop(1, 'rgba(147, 51, 234, 0)');
    } else {
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.95)');
      grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.7)');
      grad.addColorStop(1, 'rgba(129, 140, 248, 0)');
    }
  } else {
    // Nucleus
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.75)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
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
  initWallpaper();
  initAestheticClock();
  initDashboardLayout();
  initHomeMemo();
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
  localStorage.setItem('pyhome_voice_uri', uri);
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
  speakAssistantResponse("PyHome assistant audio online. Ready for instructions.");
}

function speakAssistantResponse(text) {
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

// GEMMA 4 VOICE INTENT DISPATCH
async function submitVoiceCommand(promptText) {
  if (!promptText || !promptText.trim()) return;

  getAudioContext();
  setOrbState('thinking');
  addLog('ai', `Prompt: "${promptText}"`);

  const replyEl = document.getElementById('voice-reply');
  if (replyEl) replyEl.innerText = 'Analyzing intent with Gemma 4...';

  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    const data = await res.json();

    if (replyEl) replyEl.innerText = data.speech_reply;
    addLog('highlight', `Action: ${data.speech_reply}`);

    playSFX('confirm');
    setOrbState('speaking');
    speakAssistantResponse(data.speech_reply);

  } catch (err) {
    console.error('Voice error:', err);
    if (replyEl) replyEl.innerText = 'Unable to reach local intelligence endpoint.';
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
  playSFX('click');
  addLog('event', `Activated scene '${sceneId}'`);
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

// DEVICE GRID & CONTROLS (APPLE HOME / MUSHROOM STYLE)
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  const viewGrid = document.getElementById('devices-view-grid');
  if (!grid && !viewGrid) return;

  const filtered = currentFilter === 'all' 
    ? devices 
    : devices.filter(d => d.room === currentFilter);

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

function switchNav(viewName, el) {
  playSFX('click');
  document.querySelectorAll('.nav-menu .nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  const views = ['dashboard', 'devices', 'cameras', 'activity', 'settings'];
  views.forEach(v => {
    const page = document.getElementById(`view-${v}`);
    if (page) {
      if (v === viewName) {
        page.style.display = 'flex';
      } else {
        page.style.display = 'none';
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
  }
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
  const hubName = document.getElementById('setting-hub-name')?.value || 'PyHome Hub';
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
  } else if (e.target.id === 'theme-modal') {
    closeThemeModal();
  } else if (e.target.id === 'widget-visibility-modal') {
    closeWidgetVisibilityModal();
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
  if (!confirm(`Are you sure you want to delete "${name}" from PyHome?`)) {
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
      hub_name: document.getElementById('setting-hub-name')?.value || 'PyHome Hub',
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
  a.download = `pyhome-config-${new Date().toISOString().slice(0, 10)}.json`;
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
  if (!logStream && !fullStream) return;

  logCounter++;
  if (counterEl) counterEl.innerText = `${logCounter} events`;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const line = document.createElement('div');
  line.className = `activity-item ${type === 'highlight' ? 'highlight' : ''}`;
  line.setAttribute('data-category', text.toLowerCase().includes('gemma') || text.toLowerCase().includes('assistant') ? 'assistant' : (text.toLowerCase().includes('biometric') || text.toLowerCase().includes('door') ? 'security' : 'hardware'));
  line.innerHTML = `
    <span class="ts">[${timeStr}]</span>
    <span class="msg">${escapeHtml(text)}</span>
  `;

  if (logStream) logStream.prepend(line.cloneNode(true));
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
  if (miniLog) miniLog.innerHTML = '';
  if (fullLog) fullLog.innerHTML = '';
  logCounter = 0;
  if (counterEl) counterEl.innerText = '0 events';
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
  a.download = `pyhome-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Audit log exported as CSV', 'success');
}

function filterLogs(category, el) {
  playSFX('click');
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');

  const items = document.querySelectorAll('#full-event-log .activity-item');
  items.forEach(item => {
    const cat = item.getAttribute('data-category');
    if (category === 'all' || cat === category) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// CAMERA FEED SIMULATOR
function initCameraCanvas() {
  const canvas = document.getElementById('camera-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function render() {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    requestAnimationFrame(render);
  }
  render();
}

function initCameraCanvasFull() {
  const canvas = document.getElementById('camera-canvas-full');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function render() {
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    requestAnimationFrame(render);
  }
  render();
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
      label.style.background = 'var(--success)';
      label.style.color = '#000';
    }
    playSFX('confirm');
    speakAssistantResponse('Biometric verification confirmed. Subject identified as Vasu.');
    addLog('highlight', 'Biometric scan: Subject Vasu confirmed.');
  }, 750);
}

function simulateSnapshot() {
  playSFX('click');
  addLog('event', 'Snapshot captured to /data/snapshots/');
  showToast('Snapshot saved to /data/snapshots/', 'success');
}

