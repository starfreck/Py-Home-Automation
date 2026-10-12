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

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  initVoices();
  initCameraCanvas();
  initSpeechRecognition();
  connectWebSocket();
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
      }
      if (msg.payload && msg.payload.telemetry) {
        updateTelemetry(msg.payload.telemetry);
      }
      break;

    case 'device_update':
      updateSingleDevice(msg.payload);
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

// DEVICE GRID & CONTROLS (APPLE HOME / MUSHROOM STYLE)
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  if (!grid) return;

  const filtered = currentFilter === 'all' 
    ? devices 
    : devices.filter(d => d.room === currentFilter);

  const countPill = document.getElementById('device-count-pill');
  if (countPill) countPill.innerText = `${filtered.length} Devices`;

  grid.innerHTML = filtered.map(d => `
    <div id="card-${d.id}" class="device-card ${d.state ? 'active' : ''}">
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
        <span class="device-title">${d.name}</span>
        <div class="device-meta-row">
          <span>${d.room}</span>
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
  `).join('');
}

function updateSingleDevice(updatedDevice) {
  const idx = devices.findIndex(d => d.id === updatedDevice.id);
  if (idx !== -1) devices[idx] = updatedDevice;
  else devices.push(updatedDevice);

  const card = document.getElementById(`card-${updatedDevice.id}`);
  if (card) {
    const cb = card.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = updatedDevice.state;
    if (updatedDevice.state) card.classList.add('active');
    else card.classList.remove('active');

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

function switchNav(view, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
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
  const counterEl = document.getElementById('log-count');
  if (!logStream) return;

  logCounter++;
  if (counterEl) counterEl.innerText = `${logCounter} events`;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const line = document.createElement('div');
  line.className = `activity-item ${type === 'highlight' ? 'highlight' : ''}`;
  line.innerHTML = `
    <span class="ts">[${timeStr}]</span>
    <span class="msg">${escapeHtml(text)}</span>
  `;

  logStream.prepend(line);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
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
}
