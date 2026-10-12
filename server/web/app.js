// PYHOME DASHBOARD CLIENT APP
let ws = null;
let devices = [];
let currentFilter = 'all';
let logCounter = 0;

// INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
  initClock();
  initCameraCanvas();
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

// WEBSOCKET MANAGEMENT
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  addLog('system', `Connecting to WebSocket: ${wsUrl}`);
  const badge = document.getElementById('ws-badge');
  const statusText = document.getElementById('ws-status-text');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      badge.classList.remove('offline');
      statusText.innerText = 'Online • WebSocket';
      addLog('event', 'Connected to PyHome Go Realtime Gateway');
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
      badge.classList.add('offline');
      statusText.innerText = 'Reconnecting...';
      addLog('warn', 'WebSocket connection lost. Retrying in 2s...');
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      badge.classList.add('offline');
      console.error('WS Error:', err);
    };
  } catch (e) {
    setTimeout(connectWebSocket, 2000);
  }
}

// DISPATCH SERVER MESSAGES
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

    default:
      break;
  }
}

// DEVICE RENDERING
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  if (!grid) return;

  const filtered = currentFilter === 'all' 
    ? devices 
    : devices.filter(d => d.room === currentFilter);

  grid.innerHTML = filtered.map(d => createDeviceCardHTML(d)).join('');
}

function createDeviceCardHTML(d) {
  const activeClass = d.state ? 'active' : '';
  const isChecked = d.state ? 'checked' : '';
  const pinDisplay = d.gpio_pin ? `<span class="device-pin-tag">GPIO ${d.gpio_pin}</span>` : '';

  let controlHTML = '';
  if (d.type === 'dimmer' || d.type === 'fan') {
    const label = d.type === 'dimmer' ? 'Brightness' : 'Speed';
    controlHTML = `
      <div class="device-controls-slider">
        <div class="slider-label">
          <span>${label}</span>
          <span id="val-${d.id}">${d.value}%</span>
        </div>
        <input type="range" class="custom-range" min="0" max="100" value="${d.value}" 
               oninput="onSliderChange('${d.id}', this.value)" 
               onchange="commitSlider('${d.id}', this.value)">
      </div>
    `;
  }

  return `
    <div id="card-${d.id}" class="device-card ${activeClass}">
      <div class="device-card-header">
        <div class="device-icon-wrap">${d.icon}</div>
        <label class="toggle-switch">
          <input type="checkbox" ${isChecked} onchange="toggleDevice('${d.id}')">
          <span class="slider"></span>
        </label>
      </div>

      <div class="device-info">
        <span class="device-name">${d.name}</span>
        <div class="device-meta">
          <span>${d.room}</span>
          ${pinDisplay}
          <span>• ${d.power_watts}W</span>
        </div>
      </div>

      ${controlHTML}
    </div>
  `;
}

function updateSingleDevice(updatedDevice) {
  const idx = devices.findIndex(d => d.id === updatedDevice.id);
  if (idx !== -1) {
    devices[idx] = updatedDevice;
  } else {
    devices.push(updatedDevice);
  }

  const card = document.getElementById(`card-${updatedDevice.id}`);
  if (card) {
    const checkbox = card.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = updatedDevice.state;

    if (updatedDevice.state) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }

    const valEl = document.getElementById(`val-${updatedDevice.id}`);
    if (valEl) valEl.innerText = `${updatedDevice.value}%`;
  } else {
    renderDevices();
  }

  addLog('event', `[Device] ${updatedDevice.name} set to ${updatedDevice.state ? 'ON' : 'OFF'}`);
  recalculateLocalActiveCount();
}

// INTERACTIONS
function toggleDevice(id) {
  const d = devices.find(x => x.id === id);
  const targetState = d ? !d.state : true;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'toggle',
      payload: { id: id }
    }));
  } else {
    // REST API Fallback
    fetch(`/api/devices/${id}/toggle`, { method: 'POST' });
  }
}

function onSliderChange(id, val) {
  const valEl = document.getElementById(`val-${id}`);
  if (valEl) valEl.innerText = `${val}%`;
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

function activateScene(sceneId) {
  addLog('event', `Activating scene '${sceneId}'...`);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'scene',
      payload: { id: sceneId }
    }));
  } else {
    fetch(`/api/scenes/${sceneId}/activate`, { method: 'POST' });
  }
}

function filterRoom(room) {
  currentFilter = room;
  document.querySelectorAll('.filter-chip').forEach(btn => {
    if (btn.getAttribute('data-room') === room) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
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

  if (wattsEl) wattsEl.innerText = t.total_watts.toFixed(1);
  if (tempEl) tempEl.innerText = t.temperature.toFixed(1);
  if (humEl) humEl.innerText = Math.round(t.humidity);
  if (activeEl) activeEl.innerText = t.active_count;
  if (totalEl) totalEl.innerText = t.total_count;
  if (piTempEl) piTempEl.innerText = t.cpu_temp.toFixed(1);
  if (piRamEl) piRamEl.innerText = t.memory_usage.toFixed(0);
}

function recalculateLocalActiveCount() {
  const active = devices.filter(d => d.state).length;
  const activeEl = document.getElementById('stat-active-count');
  if (activeEl) activeEl.innerText = active;
}

// LOG SYSTEM
function addLog(type, text) {
  const logStream = document.getElementById('event-log');
  const counterEl = document.getElementById('log-count');
  if (!logStream) return;

  logCounter++;
  if (counterEl) counterEl.innerText = `${logCounter} events`;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

  const line = document.createElement('div');
  line.className = `log-entry ${type}`;
  line.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-text">${escapeHtml(text)}</span>
  `;

  logStream.prepend(line);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// CAMERA FEED SIMULATOR (CANVAS)
function initCameraCanvas() {
  const canvas = document.getElementById('camera-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let frame = 0;
  function drawStream() {
    frame++;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle animated grid / radar lines
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Camera silhouette & crosshair
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.strokeStyle = 'rgba(79, 172, 254, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, 50 + Math.sin(frame * 0.05) * 5, 0, Math.PI * 2);
    ctx.stroke();

    requestAnimationFrame(drawStream);
  }
  drawStream();
}

function simulateFaceScan() {
  const overlay = document.getElementById('ai-overlay-box');
  if (!overlay) return;

  // Move bounding box randomly to simulate tracking
  const randX = 20 + Math.floor(Math.random() * 40);
  const randY = 20 + Math.floor(Math.random() * 30);
  overlay.style.left = `${randX}%`;
  overlay.style.top = `${randY}%`;
  overlay.style.borderColor = '#10b981';

  addLog('event', 'AI Vision: Authorized Face Recognized — Vasu (99.2% match)');

  setTimeout(() => {
    overlay.style.borderColor = 'var(--primary)';
  }, 1200);
}

function simulateSnapshot() {
  addLog('event', 'Security Camera: Snapshot captured and saved to /data/snapshots/');
}
