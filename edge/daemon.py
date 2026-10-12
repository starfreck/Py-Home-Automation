#!/usr/bin/env python3
"""
OmniHome Edge Daemon (Python 3.10+)
===================================
Hardware abstraction daemon for Raspberry Pi 3/4/5 and GPIO-capable edge nodes.
Communicates bidirectionally with the OmniHome Go Core Gateway via WebSocket & REST.
Supports both real physical GPIO (RPi.GPIO / gpiozero) and Virtual Hardware Emulation.
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
import time
from typing import Dict, Any, Optional

try:
    import psutil
except ImportError:
    psutil = None

# Hardware GPIO setup with mock fallback
HAS_RPI_GPIO = False
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    HAS_RPI_GPIO = True
except (ImportError, RuntimeError):
    HAS_RPI_GPIO = False

try:
    import websockets
except ImportError:
    websockets = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] (EdgeDaemon) %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("OmniHomeEdge")


class EdgeHardwareManager:
    """Manages GPIO channels and hardware telemetry."""

    def __init__(self, mock_mode: bool = False):
        self.mock_mode = mock_mode or (not HAS_RPI_GPIO)
        self.pins_state: Dict[int, bool] = {}
        if self.mock_mode:
            logger.info("Initializing in VIRTUAL HARDWARE EMULATION mode (No physical GPIO).")
        else:
            logger.info("Physical RPi.GPIO hardware detected and initialized.")

    def configure_pin(self, pin: int, initial_state: bool = False):
        self.pins_state[pin] = initial_state
        if not self.mock_mode and HAS_RPI_GPIO:
            try:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH if initial_state else GPIO.LOW)
            except Exception as e:
                logger.error(f"Failed to setup physical GPIO pin {pin}: {e}")
        logger.info(f"GPIO Pin {pin} configured -> State: {'HIGH/ON' if initial_state else 'LOW/OFF'}")

    def write_pin(self, pin: int, state: bool) -> bool:
        self.pins_state[pin] = state
        if not self.mock_mode and HAS_RPI_GPIO:
            try:
                GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)
            except Exception as e:
                logger.error(f"Error actuating GPIO {pin}: {e}")
                return False
        logger.info(f"Actuated GPIO {pin} -> {'ON' if state else 'OFF'}")
        return True

    def read_cpu_temp(self) -> float:
        # Check Raspberry Pi thermal zone
        thermal_path = "/sys/class/thermal/thermal_zone0/temp"
        if os.path.exists(thermal_path):
            try:
                with open(thermal_path, "r") as f:
                    return round(float(f.read().strip()) / 1000.0, 1)
            except Exception:
                pass

        if psutil and hasattr(psutil, "sensors_temperatures"):
            try:
                temps = psutil.sensors_temperatures()
                if temps:
                    for name, entries in temps.items():
                        if entries:
                            return round(entries[0].current, 1)
            except Exception:
                pass
        return 38.5

    def get_telemetry(self) -> Dict[str, Any]:
        cpu_usage = psutil.cpu_percent(interval=0.1) if psutil else 4.5
        mem_usage = psutil.virtual_memory().percent if psutil else 22.0
        cpu_temp = self.read_cpu_temp()
        active_relays = sum(1 for s in self.pins_state.values() if s)

        return {
            "temperature": 22.4,
            "humidity": 48.0,
            "total_watts": round(active_relays * 45.0 + 12.0, 1),
            "cpu_usage": round(cpu_usage, 1),
            "memory_usage": round(mem_usage, 1),
            "cpu_temp": round(cpu_temp, 1),
            "active_count": active_relays,
            "total_count": len(self.pins_state) if self.pins_state else 6,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def cleanup(self):
        if not self.mock_mode and HAS_RPI_GPIO:
            try:
                GPIO.cleanup()
                logger.info("Physical GPIO pins reset and cleaned up.")
            except Exception as e:
                logger.error(f"Cleanup error: {e}")


class OmniHomeEdgeDaemon:
    """Connects edge hardware to OmniHome Go Core Gateway."""

    def __init__(self, gateway_url: str, mock_mode: bool = False, telemetry_interval: int = 5):
        self.gateway_url = gateway_url.rstrip("/")
        ws_scheme = "wss" if self.gateway_url.startswith("https") else "ws"
        host_part = self.gateway_url.split("://")[-1]
        self.ws_url = f"{ws_scheme}://{host_part}/ws"
        self.interval = telemetry_interval
        self.hw = EdgeHardwareManager(mock_mode=mock_mode)
        self.running = True

        # Pre-configure default Raspberry Pi relay pins
        default_pins = [17, 27, 22, 23, 24, 25]
        for p in default_pins:
            self.hw.configure_pin(p, initial_state=False)

    def stop(self):
        self.running = False
        self.hw.cleanup()
        logger.info("Daemon stopped gracefully.")

    async def telemetry_loop(self, ws):
        """Streams hardware telemetry to Go gateway."""
        while self.running:
            try:
                telemetry = self.hw.get_telemetry()
                packet = {
                    "type": "telemetry",
                    "payload": telemetry
                }
                await ws.send(json.dumps(packet))
            except Exception as e:
                logger.warning(f"Telemetry transmit error: {e}")
                break
            await asyncio.sleep(self.interval)

    async def receive_loop(self, ws):
        """Receives device control instructions from Go gateway."""
        async for message in ws:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                payload = data.get("payload", {})

                if msg_type in ("device_update", "set_state", "toggle"):
                    pin = payload.get("gpio_pin")
                    state = payload.get("state", False)
                    if pin is not None:
                        self.hw.write_pin(int(pin), bool(state))
                        # Broadcast confirmation
                        ack = {
                            "type": "activity_event",
                            "payload": {
                                "id": f"evt-{int(time.time()*1000)}",
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                "category": "hardware",
                                "message": f"Hardware GPIO {pin} switched {'ON' if state else 'OFF'}",
                                "source": "edge-daemon"
                            }
                        }
                        await ws.send(json.dumps(ack))
            except Exception as e:
                logger.error(f"Error handling inbound message: {e}")

    async def rest_fallback_loop(self):
        """Zero-dependency HTTP polling loop using standard library urllib."""
        import urllib.request
        logger.info(f"Running REST heartbeat mode against {self.gateway_url} (standard library urllib)...")
        while self.running:
            try:
                telemetry = self.hw.get_telemetry()
                req = urllib.request.Request(
                    f"{self.gateway_url}/api/telemetry",
                    data=json.dumps(telemetry).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=3) as resp:
                    pass
                logger.info(f"Reported hardware telemetry -> CPU: {telemetry['cpu_usage']}% | Temp: {telemetry['cpu_temp']}°C | Power: {telemetry['total_watts']}W")
            except Exception:
                try:
                    with urllib.request.urlopen(f"{self.gateway_url}/api/status", timeout=3) as resp:
                        pass
                    logger.info("Gateway connection: Online (HTTP 200 OK)")
                except Exception as ex:
                    logger.warning(f"Gateway connection ping failed: {ex}")
            await asyncio.sleep(self.interval)

    async def run(self):
        if websockets is None:
            logger.info("Note: 'websockets' package not installed; falling back to standard-library REST polling mode.")
            await self.rest_fallback_loop()
            return

        logger.info(f"Connecting to OmniHome Gateway at {self.ws_url}...")
        while self.running:
            try:
                async with websockets.connect(self.ws_url) as ws:
                    logger.info("Connected to OmniHome Gateway WebSocket successfully.")
                    # Announce edge node presence
                    init_packet = {
                        "type": "edge_online",
                        "payload": {
                            "node": "Raspberry Pi Edge Controller",
                            "mock": self.hw.mock_mode,
                            "pins": list(self.hw.pins_state.keys())
                        }
                    }
                    await ws.send(json.dumps(init_packet))

                    await asyncio.gather(
                        self.telemetry_loop(ws),
                        self.receive_loop(ws),
                    )
            except (ConnectionRefusedError, OSError) as e:
                logger.warning(f"Gateway connection refused: {e}. Retrying in 5 seconds...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"WebSocket session terminated: {e}. Reconnecting in 3 seconds...")
                await asyncio.sleep(3)


def main():
    parser = argparse.ArgumentParser(description="OmniHome Python 3 Edge Hardware Daemon")
    parser.add_argument("--gateway", default="http://localhost:8080", help="Gateway HTTP URL (default: http://localhost:8080)")
    parser.add_argument("--mock", action="store_true", help="Force virtual hardware simulation mode")
    parser.add_argument("--interval", type=int, default=4, help="Telemetry reporting interval in seconds (default: 4)")
    args = parser.parse_args()

    daemon = OmniHomeEdgeDaemon(
        gateway_url=args.gateway,
        mock_mode=args.mock,
        telemetry_interval=args.interval
    )

    def handle_signal(sig, frame):
        logger.info("Received termination signal.")
        daemon.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        asyncio.run(daemon.run())
    except (KeyboardInterrupt, SystemExit):
        daemon.stop()


if __name__ == "__main__":
    main()
