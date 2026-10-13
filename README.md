# OmniHome 🏠⚡
### Multi-Tenant Cloud Architecture, Edge Reverse Tunneling & Multi-Platform Client

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloud: Go](https://img.shields.io/badge/Cloud%20Gateway-Go%201.22+-00ADD8?logo=go&logoColor=white)](#-cloud-backend-architecture)
[![Edge: Python 3](https://img.shields.io/badge/Edge%20CLI-Python%203.10+-3776AB?logo=python&logoColor=white)](#-edge-device-cli-omnihome-edge)
[![Client: Flutter 3](https://img.shields.io/badge/Client-Flutter%203-02569B?logo=flutter&logoColor=white)](#-multi-platform-flutter-app)
[![Security: JWT & Bcrypt](https://img.shields.io/badge/Security-JWT%20%2B%20Bcrypt%200600-success.svg)](#-security--multi-tenancy)

![OmniHome Banner](main-screen.png)

> **OmniHome** is an enterprise-grade smart home and edge automation platform designed around a secure cloud hub, zero-inbound-port edge reverse tunneling, and strict multi-tenancy. Hardware actuation is bridged from any browser or mobile device down to edge hardware (Raspberry Pi 3/4/5 or Linux nodes) in real time.

---

## 📑 Table of Contents

- [Key Architectural Highlights](#-key-architectural-highlights)
- [System Architecture Diagram](#-system-architecture-diagram)
- [Edge Reverse Tunneling & Command Flow](#-edge-reverse-tunneling--command-flow)
- [Security & Multi-Tenancy](#-security--multi-tenancy)
- [RustFS Cloud Object Storage & 24h Archival](#-rustfs-cloud-object-storage--24h-archival)
- [Biometric Face Recognition & Tagging Engine](#-biometric-face-recognition--tagging-engine)
- [Cloud Backend (`server/`)](#-cloud-backend-server)
- [Edge Device CLI (`edge/`)](#-edge-device-cli-edge)
- [Multi-Platform Flutter App (`app/`)](#-multi-platform-flutter-app-app)
- [Embedded Web Dashboard (`server/web/`)](#-embedded-web-dashboard-serverweb)
- [Configurable AI Directive Engine](#-configurable-ai-directive-engine)
- [Repository Structure](#-repository-structure)
- [Quick Start Guide](#-quick-start-guide)

---

## 🌟 Key Architectural Highlights

1. **Strict Multi-Tenancy & User Isolation:**
   - Every tenant's devices, automation presets, activities, and telemetry streams are partitioned strictly by `UserID`.
   - Cross-tenant device access is cryptographically blocked via stateless HMAC-SHA256 JWT tokens and bcrypt password hashing (`cost 12`).
2. **RustFS Cloud Object Storage Integration:**
   - Face detection snapshots and profiles are streamed directly into an S3-compatible **RustFS** cluster partitioned hierarchically by date (`users/{uid}/faces/YYYY/MM/DD/{snapshot_id}.jpg`).
   - Anti-MITM object level enforcement ensures cross-tenant access attempts immediately fail with HTTP 403 Forbidden.
   - Activities older than 24 hours are automatically migrated to date-partitioned JSON archives (`users/{uid}/activities/YYYY/MM/DD/activities.json`), preserving cloud RAM.
3. **Biometric Face Tagging & Automation Rules:**
   - Enroll household members from the App or Web Dashboard with profile pictures and associated automated actions (e.g., unlocking the front door, switching on specific lights, or activating scenes).
   - Real-time face recognition events trigger instantaneous local or cloud rule execution.
4. **NAT Traversal via Outbound Reverse Tunneling (`/ws/edge`):**
   - Edge hardware (Raspberry Pi behind home NAT/firewalls) opens an **outbound persistent WebSocket connection** to the Cloud.
   - No dynamic DNS, port forwarding, or public IP needed on the home edge network.
5. **Hardware Actuation & Telemetry Streaming:**
   - Commands initiated in the Flutter App or Web Dashboard flow to the Cloud, which routes `execute_action` frames down the active Edge WebSocket tunnel.
   - The Edge CLI physically actuates Raspberry Pi GPIO pins (or virtual mock pins on development machines) and continuously streams hardware telemetry (CPU temp, load, RAM, wattage) back to the cloud.
6. **Zero Broken TTS/STT Dependencies:**
   - Cloud AI processing operates purely on structured text/JSON synthesis (compatible with OpenAI, Gemini, Claude, Ollama, or local heuristics).
   - Audio recognition and voice synthesis are handled client-side via native OS speech engines or browser Web Speech APIs.

---

## 🏛️ System Architecture Diagram

```mermaid
flowchart TB
    subgraph Clients["📱 Client Layer - Multi-Platform"]
        FLUTTER["Flutter App<br/>(iOS / Android / Desktop / Web)"]
        WEB["SaaS Web Dashboard<br/>(Embedded HTML5 / JS / CSS)"]
    end

    subgraph Cloud["☁️ OmniHome Cloud Gateway - Go Native Core"]
        AUTH["Auth Service<br/>• Bcrypt Passwords<br/>• JWT Bearer Tokens<br/>• Anti-MITM Verification"]
        MGR["Device Manager - Multi-Tenant<br/>• Per-User Device Registry<br/>• Telemetry Aggregation<br/>• Activity Audit Ledger"]
        AI_SVC["AI Directive Engine<br/>• OpenAI / Gemini / Claude / Ollama<br/>• Structured JSON Directives<br/>• Zero Audio API Dependencies"]
        WS_HUB["WebSocket Hub & Reverse Tunnel<br/>• Client Channel: /ws?token=jwt<br/>• Edge Tunnel: /ws/edge?token=jwt"]
    end

    subgraph Storage["🗄️ Cloud Object Storage - RustFS"]
        RUSTFS["RustFS S3 Cluster<br/>• Tenant-Isolated (users/{uid}/)<br/>• Date-Partitioned Snapshots (YYYY/MM/DD)<br/>• 24h Activity Historical Archival"]
    end

    subgraph Edge["🔌 Edge Hardware Nodes - Raspberry Pi / Linux"]
        CLI["omnihome-edge CLI & Daemon<br/>(Python 3.10+)"]
        TUNNEL["Outbound Reverse Tunnel Client<br/>(Automatic Backoff & Reconnect)"]
        HAL["Hardware Abstraction Layer<br/>• RPi.GPIO Physical Driver<br/>• Virtual Emulation Fallback"]
        CAM["Vision & Biometrics Engine<br/>• Face Recognition & Matching<br/>• Tagging & Automation Triggers"]
        PINS["Physical Actuators & Sensors<br/>• Relay Channels (GPIO 17, 27, 22, 23, 24, 25)<br/>• CPU SoC Thermal Zone Reader"]
    end

    %% Client Interactions
    FLUTTER -->|HTTPS / WSS with Bearer JWT| AUTH
    WEB -->|HTTPS / WSS with Bearer JWT| AUTH
    AUTH --> MGR
    AUTH --> WS_HUB
    MGR <--> AI_SVC
    MGR <-->|S3 API (MinIO Client)| RUSTFS

    %% Edge Interactions
    TUNNEL -->|Outbound WSS to /ws/edge| WS_HUB
    CLI --> TUNNEL
    TUNNEL --> HAL
    TUNNEL --> CAM
    HAL --> PINS
    PINS -.->|Hardware Telemetry| HAL
    CAM -.->|Face Events & Snapshots| TUNNEL
    HAL -.->|Metrics JSON| TUNNEL
```

---

## 🔄 Edge Reverse Tunneling & Command Flow

Edge devices typically cannot receive direct inbound connections from a cloud server due to NAT firewalls. OmniHome solves this using persistent outbound reverse tunneling:

```mermaid
sequenceDiagram
    autonumber
    actor Tenant as User (App / Web)
    participant Cloud as OmniHome Cloud Gateway
    participant Edge as omnihome-edge CLI (Raspberry Pi)
    participant GPIO as Physical GPIO Pins

    Note over Edge, Cloud: 1. Edge Boots & Links Outbound
    Edge->>Cloud: Authenticate (POST /api/auth/login)
    Cloud-->>Edge: JWT Bearer Token (Stored in ~/.omnihome 0600)
    Edge->>Cloud: Connect Tunnel (WSS /ws/edge?token=jwt&hub_id=pi-01)
    Cloud-->>Edge: Tunnel Established (edge_status: online)
    
    loop Every 3 Seconds
        Edge->>Cloud: Stream Telemetry (CPU temp, RAM, load, wattage)
        Cloud-->>Tenant: Push Telemetry Update over Client WebSocket
    end

    Note over Tenant, GPIO: 2. Hardware Actuation Flow
    Tenant->>Cloud: Toggle Light (POST /api/devices/device-1/toggle)
    Cloud->>Cloud: Validate JWT & Tenant Ownership
    Cloud->>Edge: Push Tunnel Frame: execute_action (pin 17, state true)
    Edge->>GPIO: Actuate GPIO 17 HIGH / ON
    Edge-->>Cloud: Push Result: action_result (device-1, state true)
    Edge-->>Cloud: Push Audit Event: activity_event (GPIO 17 switched ON)
    Cloud-->>Tenant: Broadcast State & Activity Event to App & Web Dashboard
```

---

## 🔒 Security & Multi-Tenancy

- **Cryptographic User Isolation:** Every entity (Device, Telemetry, Scene, Activity Item, Camera Snapshot) includes a mandatory `UserID`. In-memory and persistent registries guarantee that User A cannot read, toggle, or affect User B's hardware.
- **Reverse Tunnel Verification:** Inbound `/ws/edge` connections require valid tenant JWT bearer tokens. Actuation signals are routed strictly down the tunnel matching the authenticated `claims.UserID`.
- **Anti-Tampering File Permissions:** Stored edge credentials in `~/.omnihome/edge_config.json` are written with strict `0600` permissions (owner read/write only) inside a `0700` directory.
- **MITM Resistance:** All HTTP and WebSocket endpoints validate standard Authorization headers (`Authorization: Bearer <token>`).
- **Object-Level Multi-Tenant Storage Guard:** Storage retrieval (`/api/storage/file?path=...`) verifies that object paths strictly start with `users/<claims.UserID>/`. Malicious or accidental requests for foreign paths are instantly rejected with HTTP 403 Forbidden.

---

## 🗄️ RustFS Cloud Object Storage & 24h Archival

OmniHome incorporates **RustFS**—a high-performance, S3-compatible cloud object storage engine written in Rust—to store high-volume surveillance imagery and historical audit records without bloating the core application server memory.

### 1. Hierarchical Storage Architecture
```
rustfs://omnihome-storage/
└── users/
    └── {user_id}/
        ├── profiles/
        │   └── {YYYY}/{MM}/{DD}/
        │       └── {profile_id}.jpg
        ├── faces/
        │   └── {YYYY}/{MM}/{DD}/
        │       └── {snapshot_id}.jpg
        └── activities/
            └── {YYYY}/{MM}/{DD}/
                └── activities.json
```

### 2. Multi-Tenant Date Partitioning
- **Face Detections & Snapshots:** Every camera event uploaded by an edge node or captured via live scan streams to `users/{user_id}/faces/YYYY/MM/DD/{snapshot_id}.jpg`.
- **Auditing & History:** Users can filter snapshots by specific dates or view chronological streams on both the Web Dashboard and Flutter mobile app.
- **24-Hour Activity Archival Engine:** An automated background worker periodically scans the in-memory activity ledger. Events older than 24 hours are compiled into daily JSON archives (`users/{user_id}/activities/YYYY/MM/DD/activities.json`), offloading cloud memory while keeping years of historical audit trails instantly queryable on demand.

### 3. Storage APIs
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/storage/files?type=faces&date=YYYY-MM-DD` | `GET` | Lists face detection snapshots for the authenticated tenant partitioned by date. |
| `/api/storage/dates?type=faces\|activities` | `GET` | Retrieves all available archival dates stored in RustFS for the tenant. |
| `/api/storage/file?path=...` | `GET` | Streams object data with strict tenant isolation (rejection with 403 on foreign access). |
| `/api/storage/activities?date=YYYY-MM-DD` | `GET` | Loads 24h+ historical audit ledger JSON records from RustFS storage. |
| `/api/storage/archive-activities?hours=24` | `POST` | Triggers immediate archival of activities older than specified cutoff into RustFS. |

---

## 👁️ Biometric Face Recognition & Tagging Engine

OmniHome features an integrated biometric computer vision pipeline:

1. **Member Enrollment & Tagging:** Household members can be enrolled from the Web Dashboard or Flutter App with a name, role (`Owner`, `Family Member`, `Guest`), photo, and linked automated action.
2. **Automated Routine Triggers:** When a familiar face is detected with >85% confidence:
   - **Unlock Door:** Automatically actuates the connected smart lock relay.
   - **Turn On Lights:** Illuminates entryway or living room lighting.
   - **Scene Execution:** Triggers custom multi-device ambient presets.
3. **Audit Trails & Security Alerts:** Every biometric event records recognized name, confidence score, camera ID, and timestamp into both the live timeline and RustFS cloud storage.

---

## ☁️ Cloud Backend (`server/`)

Written in idiomatic Go 1.22+ for high throughput and minimal memory consumption (<25 MB RAM):

- **Main Router (`server/main.go`):** HTTP REST APIs, `/ws` client socket, and `/ws/edge` hardware reverse tunnel.
- **Auth Service (`server/internal/auth/`):** Passwords hashed with bcrypt (`cost 12`), HMAC-SHA256 JWT tokens with 30-day expiry.
- **Device Manager (`server/internal/service/`):** Multi-tenant state manager, concurrent RWMutex locking, and optimistic actuation synchronization.
- **AI Service (`server/internal/ai/`):** Multi-provider natural language directive synthesis (OpenAI, Gemini, Claude, Ollama, custom HTTP endpoint, local heuristics).
- **Embedded Web Assets (`server/web/`):** HTML5, CSS3, and JavaScript dashboard embedded directly into the Go executable via `go:embed`.

---

## 🔌 Edge Device CLI (`edge/`)

The edge CLI daemon runs on Raspberry Pi 3/4/5 or Linux edge devices:

```bash
# Direct launcher
./bin/omnihome-edge <command>

# Or via Python module
python3 -m edge.cli <command>
```

### Supported CLI Commands

| Command | Description |
| :--- | :--- |
| `omnihome-edge login` | Authenticates edge with Cloud credentials and saves token to `~/.omnihome/edge_config.json` (`0600`). |
| `omnihome-edge logout` | Wipes saved credentials and clears local token. |
| `omnihome-edge status` | Inspects local GPIO driver, CPU SoC temperature, RAM, load, and pings the Cloud Gateway. |
| `omnihome-edge start` | Launches persistent reverse WebSocket tunnel to `/ws/edge`, streams telemetry, and listens for actuation. |
| `omnihome-edge devices` | Lists the tenant's registered devices and GPIO pin assignments from the cloud. |
| `omnihome-edge pin-test` | Directly toggles a physical GPIO pin for hardware diagnostics (`omnihome-edge pin-test 17 on`). |

---

## 📱 Multi-Platform Flutter App (`app/`)

Cross-platform client for iOS, Android, Linux desktop, macOS, Windows, and Web:

- **Authentication Flow (`app/lib/screens/login_screen.dart`):** Multi-tenant sign in and registration with configurable cloud gateway URLs.
- **Real-Time Gateway Service (`app/lib/services/gateway_service.dart`):** Authenticated REST requests, tokenized WebSocket (`/ws?token=<jwt>`), and edge online/offline callbacks.
- **Reactive State (`app/lib/providers/home_provider.dart`):** Live telemetry metrics, optimistic device toggles, automation scenes, and audit activity ledger.
- **Hardware & Hub Status (`app/lib/screens/settings_screen.dart`):** Shows authenticated tenant profile, active cloud URL, and a live Edge Reverse Tunnel link indicator (`🟢 Connected` / `🔴 Offline`).

---

## 🌐 Embedded Web Dashboard (`server/web/`)

- Modern dark theme with real-time responsive cards and live telemetry charts.
- Modal-based tenant login and registration.
- Header status pill showing Cloud ping latency and Edge Reverse Tunnel connectivity.
- Natural language spotlight prompt for text-based assistant directives.

---

## 🧠 Configurable AI Directive Engine

The Cloud AI Engine translates natural language requests (e.g. *"turn off living room light and lock front door"*) into structured actuation directives:

- **Supported Providers:**
  - `openai`: GPT-4o / GPT-4o-mini
  - `gemini`: Google Gemini 1.5 Pro / Flash
  - `anthropic`: Claude 3.5 Sonnet / Haiku
  - `ollama`: Self-hosted local LLMs (e.g., Llama 3, Mistral)
  - `custom`: Custom HTTP JSON endpoint
  - `local`: High-speed zero-dependency built-in NLP heuristics
- **Audio Independence:**
  - Operates purely on text prompts and JSON outputs.
  - Client devices utilize client-side speech recognition and synthesis (`window.speechSynthesis` in browser, native speech on mobile/desktop), avoiding broken external audio APIs.

---

## 📂 Repository Structure

```
Py-Home-Automation/
├── app/                        # 📱 Flutter cross-platform client (Mobile & Desktop)
│   ├── lib/
│   │   ├── models/             # Device, Telemetry, Scene, AuthUser models
│   │   ├── providers/          # HomeProvider reactive state
│   │   ├── screens/            # Dashboard, Devices, Cameras, Activity, Settings, Login
│   │   ├── services/           # GatewayService (Authenticated REST & WebSocket)
│   │   └── theme/              # AppTheme design tokens
│   └── test/                   # Flutter widget & unit tests
│
├── bin/
│   └── omnihome-edge           # ⚡ Edge CLI launcher script
│
├── edge/                       # 🔌 Python 3 Edge device CLI & hardware daemon
│   ├── cli.py                  # CLI command implementation (login, status, start, etc.)
│   ├── client.py               # Authenticated WebSocket reverse tunnel client
│   ├── config.py               # Credentials manager (0600 file permissions)
│   ├── hardware.py             # GPIO HAL (RPi.GPIO + Virtual emulation fallback)
│   └── requirements.txt        # Edge dependencies (websockets, requests, psutil)
│
├── server/                     # ☁️ Go multi-tenant cloud backend
│   ├── main.go                 # HTTP/WebSocket gateway entry point
│   ├── internal/
│   │   ├── ai/                 # Configurable AI directive processing
│   │   ├── auth/               # Bcrypt password hashing & JWT token service
│   │   ├── hub/                # Multi-tenant WebSocket client & edge tunnel hub
│   │   ├── model/              # Domain models (Device, User, HubNode, Settings)
│   │   └── service/            # DeviceManager with strict tenant isolation
│   └── web/                    # Embedded SaaS Web Dashboard (HTML/CSS/JS)
│
└── README.md                   # 📖 Platform architecture & documentation
```

---

## 🚀 Quick Start Guide

### 1. Launch RustFS Cloud Storage (Docker)

```bash
# Start Dockerized RustFS S3 object storage with persistent storage volume
docker compose up -d rustfs

# S3 API Endpoint: http://localhost:9000
# Web Console UI:  http://localhost:9001 (Credentials: rustfsadmin / rustfsadminpassword)
```

### 2. Build & Start the Cloud Backend

```bash
cd server
go build -o omnihome main.go
./omnihome
# Cloud Dashboard: http://localhost:8080
```

### 3. Connect the Edge Device CLI (Raspberry Pi or Linux)

```bash
# 1. Authenticate with the Cloud Gateway
./bin/omnihome-edge login --cloud http://localhost:8080

# 2. Check local hardware and cloud link
./bin/omnihome-edge status

# 3. Start the reverse tunnel & telemetry daemon
./bin/omnihome-edge start
```

### 4. Run the Flutter App

```bash
cd app
flutter run -d linux   # Run native desktop app (or -d chrome for web)
```

---

<p align="center">
  <b>OmniHome — Modern, Secure, Cloud-Connected Home Automation</b>
</p>
