// PYHOME CORTEX — NEURAL HUB CLIENT & GEMMA 4 VOICE CONTROLLER
let ws = null;
let devices = [];
let currentFilter = 'all';
let logCounter = 0;
let isListening = false;
let speechRecognizer = null;
let waveformMode = 'idle'; // 'idle', 'listening', 'processing', 'speaking'

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  initWaveformVisualizer();
  initCameraCanvas();
  initSpeechRecognition();
  connectWebSocket();
});

// CLOCK
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

// WEBSOCKET REALTIME CONNECTION
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  addAuditLog('system', `Handshaking with Go Realtime Gateway: ${wsUrl}`);
  const badge = document.getElementById('ws-badge');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      badge.innerHTML = '<span class="pulse-dot"></span> LIVE • WS';
      badge.style.color = 'var(--green-neon)';
      addAuditLog('event', 'Neural socket linked. Real-time telemetry active.');
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
      badge.innerHTML = '<span class="pulse-dot" style="background:var(--red-neon)"></span> RECONNECTING';
      badge.style.color = 'var(--red-neon)';
      addAuditLog('warn', 'Neural link interrupted. Retrying in 2000ms...');
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
      addAuditLog('event', msg.payload);
      break;
  }
}

// SPEECH RECOGNITION (WEB SPEECH API)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported in this browser. Fallback to manual text input.');
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onstart = () => {
    isListening = true;
    waveformMode = 'listening';
    document.getElementById('mic-trigger').classList.add('listening');
    document.getElementById('voice-state-tag').innerText = 'LISTENING // AUDIO STREAM';
    document.getElementById('voice-state-tag').style.color = 'var(--cyan-neon)';
  };

  speechRecognizer.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    document.getElementById('voice-transcript').innerText = `"${transcript}"`;

    if (event.results[0].isFinal) {
      submitVoiceCommand(transcript);
    }
  };

  speechRecognizer.onerror = (event) => {
    console.warn('Speech Recognition error:', event.error);
    stopListening();
  };

  speechRecognizer.onend = () => {
    stopListening();
  };
}

function toggleSpeechRecognition() {
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
  if (waveformMode !== 'speaking') {
    waveformMode = 'idle';
  }
  const trigger = document.getElementById('mic-trigger');
  if (trigger) trigger.classList.remove('listening');
  const stateTag = document.getElementById('voice-state-tag');
  if (stateTag) {
    stateTag.innerText = 'STANDBY // READY';
    stateTag.style.color = 'var(--cyan-neon)';
  }
}

// SEND VOICE PROMPT TO GEMMA 4 BACKEND
async function submitVoiceCommand(promptText) {
  if (!promptText || !promptText.trim()) return;

  waveformMode = 'processing';
  const stateTag = document.getElementById('voice-state-tag');
  stateTag.innerText = 'PROCESSING // GEMMA 4';
  stateTag.style.color = 'var(--purple-neon)';

  addAuditLog('ai', `Neural Voice Input: "${promptText}"`);

  try {
    const res = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    const data = await res.json();

    document.getElementById('voice-reply').innerText = data.speech_reply;
    addAuditLog('action', `Gemma 4: ${data.speech_reply}`);

    // Trigger Text-to-Speech synthesis response
    speakAssistantResponse(data.speech_reply);

  } catch (err) {
    console.error('Voice command error:', err);
    document.getElementById('voice-reply').innerText = 'Command dispatch error. Verify network link.';
    waveformMode = 'idle';
  }
}

function handleManualPrompt(e) {
  e.preventDefault();
  const input = document.getElementById('manual-prompt-input');
  const val = input.value.trim();
  if (!val) return;
  document.getElementById('voice-transcript').innerText = `"${val}"`;
  submitVoiceCommand(val);
  input.value = '';
}

function submitTextCommand(cmd) {
  document.getElementById('voice-transcript').innerText = `"${cmd}"`;
  submitVoiceCommand(cmd);
}

// TEXT TO SPEECH (SYNTHESIS)
function speakAssistantResponse(text) {
  if (!window.speechSynthesis) {
    waveformMode = 'idle';
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 0.95;

  waveformMode = 'speaking';
  const stateTag = document.getElementById('voice-state-tag');
  stateTag.innerText = 'TRANSMITTING // SPEECH';
  stateTag.style.color = 'var(--green-neon)';

  utterance.onend = () => {
    waveformMode = 'idle';
    stateTag.innerText = 'STANDBY // READY';
    stateTag.style.color = 'var(--cyan-neon)';
  };

  window.speechSynthesis.speak(utterance);
}

// ANIMATED NEURAL AUDIO VISUALIZER ORB (CANVAS)
function initWaveformVisualizer() {
  const canvas = document.getElementById('waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 64;

  let step = 0;
  function animate() {
    step += 0.04;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bars = 48;
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2;
      let amplitude = 4;

      if (waveformMode === 'listening') {
        amplitude = 12 + Math.sin(step * 4 + i) * 14;
      } else if (waveformMode === 'speaking') {
        amplitude = 16 + Math.cos(step * 5 + i * 1.5) * 18;
      } else if (waveformMode === 'processing') {
        amplitude = 8 + Math.sin(step * 8 + i * 2) * 8;
      } else {
        amplitude = 4 + Math.sin(step + i * 0.5) * 3;
      }

      const x1 = cx + Math.cos(angle) * (radius - 2);
      const y1 = cy + Math.sin(angle) * (radius - 2);
      const x2 = cx + Math.cos(angle) * (radius + amplitude);
      const y2 = cy + Math.sin(angle) * (radius + amplitude);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = waveformMode === 'listening' ? '#00f2fe' : 
                        waveformMode === 'speaking' ? '#10b981' : 
                        waveformMode === 'processing' ? '#9333ea' : 'rgba(0, 242, 254, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    requestAnimationFrame(animate);
  }
  animate();
}

// DEVICE GRID & CONTROLS
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  if (!grid) return;

  const filtered = currentFilter === 'all' 
    ? devices 
    : devices.filter(d => d.room === currentFilter);

  grid.innerHTML = filtered.map(d => `
    <div id="card-${d.id}" class="hud-device-card ${d.state ? 'active' : ''}">
      <div class="card-top">
        <div class="dev-icon-block">${d.icon}</div>
        <label class="hud-switch">
          <input type="checkbox" ${d.state ? 'checked' : ''} onchange="toggleDevice('${d.id}')">
          <span class="switch-track"></span>
        </label>
      </div>

      <div class="dev-label-group">
        <span class="dev-name">${d.name}</span>
        <div class="dev-subinfo">
          <span>${d.room}</span>
          ${d.gpio_pin ? `<span class="pin-badge">PIN ${d.gpio_pin}</span>` : ''}
          <span>• ${d.power_watts}W</span>
        </div>
      </div>

      ${(d.type === 'dimmer' || d.type === 'fan') ? `
        <div class="dev-slider-wrap">
          <div class="slider-top">
            <span>${d.type === 'dimmer' ? 'LEVEL' : 'SPEED'}</span>
            <span id="val-${d.id}">${d.value}%</span>
          </div>
          <input type="range" class="hud-slider" min="0" max="100" value="${d.value}"
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
    const valEl = document.getElementById(`val-${updatedDevice.id}`);
    if (valEl) valEl.innerText = `${updatedDevice.value}%`;
  } else {
    renderDevices();
  }
}

function toggleDevice(id) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'toggle', payload: { id: id } }));
  } else {
    fetch(`/api/devices/${id}/toggle`, { method: 'POST' });
  }
}

function commitSlider(id, val) {
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
  document.querySelectorAll('.filter-tab').forEach(b => {
    if (b.getAttribute('data-room') === room) b.classList.add('active');
    else b.classList.remove('active');
  });
  renderDevices();
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
  const piRamEl = document.getElementById('stat-pi-ram');
  const meterPower = document.getElementById('meter-power-fill');
  const meterActive = document.getElementById('meter-active-fill');

  if (wattsEl) wattsEl.innerText = t.total_watts.toFixed(1);
  if (tempEl) tempEl.innerText = t.temperature.toFixed(1);
  if (humEl) humEl.innerText = Math.round(t.humidity);
  if (activeEl) activeEl.innerText = t.active_count;
  if (totalEl) totalEl.innerText = t.total_count;
  if (piTempEl) piTempEl.innerText = t.cpu_temp.toFixed(1);
  if (piRamEl) piRamEl.innerText = t.memory_usage.toFixed(0);

  if (meterPower) meterPower.style.width = `${Math.min(100, (t.total_watts / 1000) * 100)}%`;
  if (meterActive) meterActive.style.width = `${(t.active_count / t.total_count) * 100}%`;
}

// AUDIT EVENT LOG
function addAuditLog(type, text) {
  const logStream = document.getElementById('event-log');
  const counterEl = document.getElementById('log-count');
  if (!logStream) return;

  logCounter++;
  if (counterEl) counterEl.innerText = `${logCounter} ENTRIES`;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const line = document.createElement('div');
  line.className = `audit-entry ${type}`;
  line.innerHTML = `
    <span class="audit-time">[${timeStr}]</span>
    <span class="audit-msg">${escapeHtml(text)}</span>
  `;

  logStream.prepend(line);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// SECURITY CAMERA SIMULATION
function initCameraCanvas() {
  const canvas = document.getElementById('camera-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let scanLine = 0;
  function render() {
    scanLine = (scanLine + 1.5) % canvas.height;
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid coordinates
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Moving horizontal scan beam
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    ctx.beginPath();
    ctx.moveTo(0, scanLine);
    ctx.lineTo(canvas.width, scanLine);
    ctx.stroke();

    requestAnimationFrame(render);
  }
  render();
}

function simulateFaceScan() {
  const box = document.getElementById('ai-target-box');
  const label = document.getElementById('target-label');
  if (!box) return;

  const randX = 20 + Math.floor(Math.random() * 35);
  const randY = 20 + Math.floor(Math.random() * 25);
  box.style.left = `${randX}%`;
  box.style.top = `${randY}%`;

  if (label) {
    label.innerText = 'VERIFYING...';
    label.style.background = 'var(--purple-neon)';
  }

  setTimeout(() => {
    if (label) {
      label.innerText = 'ID: VASU // CLEAR (99.8%)';
      label.style.background = 'var(--green-neon)';
    }
    addAuditLog('action', 'Biometric Optical Sensor: Subject Vasu confirmed. Perimeter safe.');
  }, 900);
}

function simulateSnapshot() {
  addAuditLog('event', 'Perimeter Capture: Snapshot written to /data/snapshots/20261011_2204.jpg');
}
