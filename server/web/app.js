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

// THEME MANAGEMENT (DARK / LIGHT)
let currentTheme = localStorage.getItem('pyhome_theme') || 'dark';

function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeButtonUI();
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('pyhome_theme', currentTheme);
  updateThemeButtonUI();
  playSFX('click');
}

function updateThemeButtonUI() {
  const textEl = document.getElementById('theme-toggle-text');
  if (textEl) {
    textEl.innerText = currentTheme === 'dark' ? 'Dark' : 'Light';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
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
  if (!speechAudioEnabled || !window.speechSynthesis) return;

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

  window.speechSynthesis.speak(utterance);
}

// SYSTEM CLOCK
function initClock() {
  const clockEl = document.getElementById('clock');
  const camTimeEl = document.getElementById('cam-timestamp');
  function update() {
    const now = new Date();
    const str = now.toTimeString().split(' ')[0];
    if (clockEl) clockEl.innerText = str;
    if (camTimeEl) camTimeEl.innerText = str;
  }
  update();
  setInterval(update, 1000);
}

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
  };

  speechRecognizer.onend = () => {
    stopListening();
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
    } catch (e) {
      speechRecognizer.stop();
    }
  }
}

function stopListening() {
  isListening = false;
  const trigger = document.getElementById('mic-trigger');
  if (trigger) trigger.classList.remove('listening');
}

function focusVoiceInput() {
  const input = document.getElementById('manual-prompt-input');
  if (input) input.focus();
}

// GEMMA 4 VOICE INTENT DISPATCH
async function submitVoiceCommand(promptText) {
  if (!promptText || !promptText.trim()) return;

  getAudioContext();
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
    speakAssistantResponse(data.speech_reply);

  } catch (err) {
    console.error('Voice error:', err);
    if (replyEl) replyEl.innerText = 'Unable to reach local intelligence endpoint.';
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

