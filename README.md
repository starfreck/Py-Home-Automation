# PyHome 🏠⚡
### Modern, Local-First, Open-Source Smart Home Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Architecture: Local-First](https://img.shields.io/badge/Architecture-Local--First-success.svg)](#architecture)
[![MQTT: 5.0](https://img.shields.io/badge/IoT-MQTT%205.0-orange.svg)](#mqtt-message-flow)
[![Flutter](https://img.shields.io/badge/Client-Flutter%203-02569B?logo=flutter&logoColor=white)](#technology-stack)
[![Go](https://img.shields.io/badge/Gateway-Go-00ADD8?logo=go&logoColor=white)](#technology-stack)
[![Spring Boot](https://img.shields.io/badge/Core-Spring%20Boot%203-6DB33F?logo=springboot&logoColor=white)](#technology-stack)
[![Python](https://img.shields.io/badge/Edge-Python%203.12+-3776AB?logo=python&logoColor=white)](#technology-stack)

![PyHome Banner](main-screen.png)

> **PyHome** is an open-source, privacy-first home automation and edge-security ecosystem. Designed for self-hosting with zero required external cloud dependencies, offline-first reliability, and real-time device control across mobile, desktop, and web.

---

## 📑 Table of Contents

- [Key Pillars](#-key-pillars)
- [System Architecture Diagram](#-system-architecture-diagram)
- [Network & Discovery Flow](#-network--discovery-flow)
- [MQTT Message & Control Flow](#-mqtt-message--control-flow)
- [Technology Stack](#-technology-stack)
- [Edge Client Modernization (Python 3)](#-edge-client-modernization-python-3)
- [Self-Hosted Deployment](#-self-hosted-deployment)
- [Monorepo Structure](#-monorepo-structure)
- [Roadmap](#-roadmap)
- [Legacy Reference](#-legacy-reference)

---

## 🌟 Key Pillars

1. **Local-First & Offline Resilient:** If your internet goes down, your house keeps working. All device states, automations, and camera processing run directly on your local network.
2. **Zero Cloud Lock-in:** No mandatory subscriptions, no required AWS/Firebase dependencies. Open push notification support via [ntfy.sh](https://ntfy.sh) / [Gotify](https://gotify.net).
3. **Hardware Agnostic:** Controls Raspberry Pi GPIO relays, ESP32/ESP8266 boards, smart plugs, sensors, and RTSP/USB cameras.
4. **Lightweight Self-Hosting:** Runs seamlessly on a single Raspberry Pi 4/5, Intel NUC, or home NAS with a combined memory footprint under 1 GB RAM.

---

## 🏛️ System Architecture Diagram

```mermaid
graph TB
    subgraph Clients["📱 Client Layer (Cross-Platform)"]
        FLUTTER["Flutter App<br/>(iOS / Android / Desktop / Web)"]
        BROWSER["Web Dashboard<br/>(Local Web Browser)"]
    end

    subgraph Network["🌐 Discovery & Ingress"]
        MDNS["mDNS / Zeroconf<br/>(pyhome.local)"]
        PROXY["Reverse Proxy / Tunnel<br/>(Tailscale / WireGuard / Caddy)"]
    end

    subgraph Host["🖥️ PyHome Self-Hosted Server (Docker / Host)"]
        GW["Go Core Gateway & Event Hub<br/>• WebSocket Server<br/>• mDNS Broadcaster<br/>• JWT / Local Auth<br/>• Sub-5ms Command Dispatch"]
        
        API["Spring Boot 3 Core Engine<br/>• Automation & Rules Engine<br/>• Device & Room Registry<br/>• Schedules & Timers<br/>• User & Role Management"]
        
        AI["Python 3 Vision Service<br/>• MediaPipe / FaceNet<br/>• Local Face Recognition<br/>• Motion & Person Alerts"]
        
        MQTT["Mosquitto MQTT Broker<br/>(Topic Bus • QoS 1 • LWT)"]
        
        DB[("PostgreSQL / SQLite<br/>State & History")]
        DISK[("Local Storage<br/>Snapshots & Clips")]
    end

    subgraph Edge["🔌 Edge & IoT Hardware"]
        PI["PyHome Edge Agent (Python 3)<br/>• gpiozero HAL (Relays & Switches)<br/>• DHT22 / BME280 Sensor Reader<br/>• USB / CSI Camera Streamer"]
        ESP["ESP32 / ESP8266 Nodes<br/>• Tasmota / ESPHome / Native MQTT"]
        CAM["IP / RTSP Cameras"]
    end

    %% Client Interactions
    FLUTTER -->|LAN: http://pyhome.local:8080| MDNS
    MDNS --> GW
    FLUTTER -.->|Remote WAN| PROXY
    PROXY --> GW
    BROWSER --> GW

    %% Server Internal Routing
    GW <-->|Internal REST / gRPC| API
    GW <-->|WebSocket & Events| MQTT
    GW <-->|Async Event Hooks| AI
    
    API <-->|JPA / JDBC| DB
    AI --> DISK

    %% Edge Communications
    MQTT <-->|MQTT: pyhome/home/+/command| PI
    MQTT <-->|MQTT: pyhome/home/+/state| ESP
    CAM -.->|RTSP Stream| AI
    PI -.->|Local Camera Feed| AI
```

---

## 🌐 Network & Discovery Flow

PyHome prioritizes zero-configuration on your home network while providing secure remote access without risky port forwarding.

```mermaid
sequenceDiagram
    autonumber
    actor User as User with Flutter App
    participant LAN as Local Wi-Fi (mDNS)
    participant GW as Go Gateway (pyhome.local)
    participant MQTT as Mosquitto Broker
    participant Edge as Pi Edge Agent (Relays)

    Note over User, GW: Case A: Local Network (Zero Config)
    User->>LAN: Broadcast mDNS discovery query (_pyhome._tcp.local)
    LAN-->>User: Resolved: http://192.168.1.150:8080 (pyhome.local)
    User->>GW: Connect WebSocket (ws://pyhome.local:8080/ws)
    GW-->>User: Synced Device State Snapshot

    Note over User, Edge: Case B: Instant Command Execution (<5ms)
    User->>GW: Send toggle command: {"device_id": "relay-1", "state": true}
    GW->>MQTT: Publish topic: pyhome/home/pi-hub/devices/relay-1/command
    MQTT->>Edge: Deliver command (QoS 1)
    Edge->>Edge: gpiozero toggles GPIO pin 17 HIGH
    Edge->>MQTT: Publish state: pyhome/home/pi-hub/devices/relay-1/state
    MQTT->>GW: Receive updated state
    GW->>User: Push WebSocket update (Instant UI update)
```

---

## 📡 MQTT Message & Control Flow

Device communication uses a standardized MQTT 5.0 topic namespace:

```
pyhome/
└── {environment}/                     # e.g., "home"
    └── {hub_id}/                       # e.g., "pi-living-room"
        ├── status                      # Retained: {"status": "online"|"offline"} (LWT)
        ├── telemetry                   # {"cpu_temp": 42.1, "ram_used": 34.2, "uptime": 10240}
        ├── devices/
        │   └── {device_id}/
        │       ├── command             # Inbound:  {"command_id": "...", "state": true}
        │       └── state               # Outbound: {"device_id": "...", "state": true}
        └── events/
            └── vision                  # Alert:    {"type": "face_detected", "confidence": 0.96}
```

```mermaid
flowchart LR
    A[Flutter App] -->|WebSocket JSON| B(Go Gateway)
    B -->|MQTT Publish| C{Mosquitto Broker}
    C -->|QoS 1 Deliver| D[Python Edge Agent]
    D -->|gpiozero HAL| E[(Physical Relays)]
    E -.->|Hardware Response| D
    D -->|Publish State| C
    C -->|MQTT Subscribe| B
    B -->|WebSocket Push| A
```

---

## 💻 Technology Stack

| Layer | Component | Language / Framework | Key Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend** | Cross-Platform App | **Flutter 3** (Dart) | Single UI code for iOS, Android, Linux, macOS, Windows & Web. |
| **Edge Gateway** | Real-time Hub | **Go 1.23+** | mDNS discovery, WebSocket server, MQTT bridge (<25 MB RAM). |
| **Core Service** | Automations & Registry | **Spring Boot 3** (Java 21) | Device registry, complex rules engine, schedules, and RBAC. |
| **Edge Agent** | Pi IoT Client | **Python 3.12+** | Async MQTT, `gpiozero` HAL (with Mock Pin fallback), camera streams. |
| **Vision AI** | Edge Intelligence | **Python 3.12+** (FastAPI) | MediaPipe / FaceNet local face detection and motion analysis. |
| **Message Bus** | MQTT Broker | **Eclipse Mosquitto 2.0** | Ultra-lightweight pub/sub messaging engine (<10 MB RAM). |
| **Database** | Relational Store | **PostgreSQL 16 / SQLite** | Local configuration, schedules, state logs, and user metadata. |

---

## 🐍 Edge Client Modernization (Python 3)

The new Python Edge Agent replaces legacy Python 2 scripts with modern asynchronous Python:

- **Asynchronous Core (`asyncio` + `aiomqtt`):** Fully non-blocking event-driven loop.
- **Hardware Abstraction Layer (`gpiozero`):**
  - Native Raspberry Pi pin control for physical relays, switches, and sensors.
  - Built-in **Mock Pin Factory** (`GPIOZERO_PIN_FACTORY=mock`), enabling full local development and testing on macOS, Windows, and Linux without physical hardware.
- **Last Will and Testament (LWT):** Automatic edge disconnect detection.
- **Modern Face Detection:** Fast CPU inference via **MediaPipe** replacing legacy OpenCV Haar cascades.

---

## 🚀 Self-Hosted Deployment

Launch the entire self-hosted stack using a single `docker-compose.yml`:

```bash
# Clone the repository
git clone https://github.com/starfreck/Py-Home-Automation.git
cd Py-Home-Automation

# Launch all core services
docker compose up -d

# Verify services are healthy
docker compose ps
```

### Resource Profile
| Container | Role | Memory Footprint |
| :--- | :--- | :--- |
| `pyhome-gateway` | Go API Gateway & WebSocket Hub | ~20 MB |
| `pyhome-mosquitto`| MQTT Broker | ~10 MB |
| `pyhome-core` | Spring Boot Automations & Registry | ~250 MB |
| `pyhome-vision` | Python AI Vision Service | ~300 MB |
| `pyhome-postgres` | PostgreSQL Database | ~80 MB |
| **Total Stack** | **Entire Server Suite** | **< 700 MB RAM** |

---

## 📂 Monorepo Structure

```
Py-Home-Automation/
├── apps/
│   └── flutter_app/            # 📱 Flutter cross-platform mobile & desktop app
│
├── services/
│   ├── gateway/                # ⚡ Go API Gateway, WebSocket Hub & mDNS broadcaster
│   ├── core/                   # ☕ Spring Boot 3 automation & device registry service
│   └── vision/                 # 👁️ Python 3 FastAPI local face & motion recognition
│
├── edge/
│   └── pyhome_edge/            # 🐍 Python 3.12+ IoT Edge Agent (gpiozero + MQTT)
│       ├── hal/                # Hardware Abstraction Layer (Relays, Sensors, Mocks)
│       ├── transport/          # Async MQTT 5.0 client & protocol models
│       └── vision/             # Camera stream reader & MediaPipe detector
│
├── deploy/
│   ├── docker-compose.yml      # 🐳 One-command local stack runner
│   └── mosquitto/              # Mosquitto MQTT configuration
│
└── docs/                       # 📖 Technical architecture & API specifications
```

---

## 🗺️ Roadmap

- [x] Comprehensive architecture redesign & documentation
- [x] Python Edge Client technical plan and MQTT specification
- [ ] **Milestone 1:** Build modernized `pyhome_edge` Python 3 client with mock HAL
- [ ] **Milestone 2:** Implement Go Gateway with WebSocket hub and mDNS responder
- [ ] **Milestone 3:** Implement Spring Boot Core device registry & rules engine
- [ ] **Milestone 4:** Build Flutter mobile UI with local discovery
- [ ] **Milestone 5:** Package self-hosted single-node release with Docker

---

## 📜 Legacy Reference

The original prototype (PHP 7 web server, Java Android app, and Python 2 Pi-Client) is preserved on the [`master`](https://github.com/starfreck/Py-Home-Automation/tree/master) branch. Active modernization takes place on the [`future`](https://github.com/starfreck/Py-Home-Automation/tree/future) branch.

---

<p align="center">
  <b>Built with ❤️ for privacy, freedom, and local-first home automation.</b>
</p>
