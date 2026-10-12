"""OmniHome Edge Reverse Tunnel WebSocket Client.

Maintains an outbound persistent WebSocket connection to the OmniHome Cloud:
  /ws/edge?token=<jwt>&hub_id=<hub_id>

Since edge devices (e.g. Raspberry Pi) are typically behind NATs and firewalls,
outbound reverse tunneling allows the Cloud to dispatch real-time actuation
commands without requiring port forwarding or opening edge firewall ports.
"""

import asyncio
import json
import logging
import socket
import time
from typing import Any, Dict, List, Optional
import websockets

from edge.hardware import EdgeHardware

logger = logging.getLogger("OmniHomeEdge.Tunnel")


class EdgeTunnelClient:
    """Manages the persistent authenticated WebSocket tunnel to the Cloud Gateway."""

    def __init__(
        self,
        cloud_url: str,
        token: str,
        hub_id: Optional[str] = None,
        mock_mode: bool = False,
        telemetry_interval: int = 3,
    ):
        self.cloud_url = cloud_url.rstrip("/")
        self.token = token
        self.hub_id = hub_id or f"pi-{socket.gethostname()}"
        self.interval = telemetry_interval
        self.hw = EdgeHardware(mock_mode=mock_mode)
        self.running = True

        # Determine WebSocket URL
        ws_scheme = "wss" if self.cloud_url.startswith("https") else "ws"
        host_part = self.cloud_url.split("://")[-1]
        self.ws_url = f"{ws_scheme}://{host_part}/ws/edge?token={self.token}&hub_id={self.hub_id}"

        # Initialize standard Raspberry Pi relay pins
        default_pins = [17, 27, 22, 23, 24, 25]
        for pin in default_pins:
            self.hw.setup_pin(pin, initial_state=False)

    def stop(self):
        """Signal client to stop and clean up hardware."""
        self.running = False
        self.hw.cleanup()
        logger.info("Edge tunnel client stopped.")

    async def telemetry_loop(self, ws):
        """Continuously streams hardware metrics to the Cloud."""
        logger.info(f"Telemetry stream started (interval: {self.interval}s).")
        while self.running:
            try:
                metrics = self.hw.get_telemetry()
                packet = {
                    "type": "telemetry",
                    "payload": metrics,
                }
                await ws.send(json.dumps(packet))
            except Exception as e:
                logger.warning(f"Telemetry send error: {e}")
                break
            await asyncio.sleep(self.interval)

    async def receive_loop(self, ws):
        """Processes incoming hardware instructions dispatched by the Cloud."""
        logger.info("Command receiver ready for cloud directives.")
        async for raw_msg in ws:
            try:
                msg = json.loads(raw_msg)
                msg_type = msg.get("type")
                payload = msg.get("payload", {})

                if msg_type == "execute_action":
                    await self._handle_execute_action(ws, payload)
                elif msg_type in ("sync_devices", "init_config"):
                    await self._handle_sync_devices(ws, payload)
                elif msg_type == "ping":
                    await ws.send(json.dumps({"type": "pong", "payload": {}}))
                else:
                    logger.debug(f"Received unhandled message type: {msg_type}")

            except json.JSONDecodeError:
                logger.error("Failed to parse incoming message JSON from cloud.")
            except Exception as e:
                logger.error(f"Error handling cloud message: {e}", exc_info=True)

    async def _handle_execute_action(self, ws, payload: Dict[str, Any]):
        """Executes hardware actuation dispatched from Cloud."""
        device_id = payload.get("device_id")
        pin = payload.get("gpio_pin")
        action = payload.get("action")
        state = payload.get("state", False)
        value = payload.get("value", 0)

        logger.info(f"[Actuation] Device '{device_id}' -> Action: {action}, GPIO: {pin}, State: {state}")

        if pin is not None and int(pin) > 0:
            pin_num = int(pin)
            self.hw.write_pin(pin_num, bool(state))

            # Send action result back to cloud
            result_packet = {
                "type": "action_result",
                "payload": {
                    "device_id": device_id,
                    "state": state,
                    "value": value,
                },
            }
            await ws.send(json.dumps(result_packet))

            # Emit activity event
            event_packet = {
                "type": "activity_event",
                "payload": {
                    "id": f"act-hw-{int(time.time()*1000)}",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "category": "hardware",
                    "message": f"Hardware GPIO {pin_num} switched {'ON' if state else 'OFF'}",
                    "source": "edge-cli",
                },
            }
            await ws.send(json.dumps(event_packet))

    async def _handle_sync_devices(self, ws, payload: Any):
        """Synchronizes local GPIO states with Cloud device registry."""
        devices = []
        if isinstance(payload, list):
            devices = payload
        elif isinstance(payload, dict) and "devices" in payload:
            devices = payload["devices"]

        logger.info(f"Synchronizing {len(devices)} device states with local GPIO pins...")
        synced_count = 0
        for dev in devices:
            pin = dev.get("gpio_pin")
            state = dev.get("state", False)
            if pin and int(pin) > 0:
                pin_num = int(pin)
                self.hw.setup_pin(pin_num, initial_state=bool(state))
                synced_count += 1

        ack_packet = {
            "type": "activity_event",
            "payload": {
                "id": f"act-sync-{int(time.time()*1000)}",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "category": "system",
                "message": f"Edge hardware synchronized {synced_count} GPIO relay states.",
                "source": "edge-cli",
            },
        }
        await ws.send(json.dumps(ack_packet))

    async def run(self):
        """Main connection management loop with exponential backoff."""
        logger.info(f"Connecting edge tunnel to: {self.cloud_url} (Hub ID: {self.hub_id})")
        backoff = 2

        while self.running:
            try:
                async with websockets.connect(self.ws_url) as ws:
                    logger.info("Connected to OmniHome Cloud WebSocket tunnel successfully!")
                    backoff = 2  # Reset backoff on successful connect

                    # Send edge_online handshake
                    handshake = {
                        "type": "edge_online",
                        "payload": {
                            "node": "Raspberry Pi Edge Controller",
                            "hub_id": self.hub_id,
                            "mock": self.hw.mock_mode,
                            "pins": list(self.hw.pins_state.keys()),
                        },
                    }
                    await ws.send(json.dumps(handshake))

                    # Run both telemetry and receiver concurrently
                    await asyncio.gather(
                        self.telemetry_loop(ws),
                        self.receive_loop(ws),
                    )

            except websockets.exceptions.InvalidStatusCode as e:
                if e.status_code == 401:
                    logger.error("Authentication failed: Invalid or expired JWT token. Please run 'omnihome-edge login'.")
                    return
                logger.warning(f"Connection rejected with status {e.status_code}. Retrying in {backoff}s...")
            except (ConnectionRefusedError, OSError) as e:
                logger.warning(f"Cloud connection refused ({e}). Retrying in {backoff}s...")
            except Exception as e:
                logger.error(f"WebSocket session dropped: {e}. Reconnecting in {backoff}s...")

            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)
