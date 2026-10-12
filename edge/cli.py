#!/usr/bin/env python3
"""OmniHome Edge Device CLI.

Provides command-line interface for edge hardware (Raspberry Pi / Linux):
  - omnihome-edge login     Authenticate tenant and store secure credentials
  - omnihome-edge logout    Clear stored credentials
  - omnihome-edge status    Display local hardware & cloud connection status
  - omnihome-edge start     Launch edge daemon tunnel & stream telemetry
  - omnihome-edge devices   List authenticated tenant devices and GPIO pins
  - omnihome-edge pin-test  Direct manual GPIO pin actuation
"""

import argparse
import asyncio
import getpass
import json
import logging
import os
import signal
import sys
import time
from typing import Optional
import urllib.error
import urllib.request

from edge import config
from edge.client import EdgeTunnelClient
from edge.hardware import EdgeHardware, HAS_RPI_GPIO

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (EdgeCLI) %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("OmniHomeEdge")


def _http_request(url: str, method: str = "GET", data: Optional[dict] = None, token: Optional[str] = None):
    """Zero-dependency HTTP client using standard library urllib."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            if content:
                return json.loads(content)
            return {}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(error_body)
            msg = err_json.get("error", error_body)
        except Exception:
            msg = error_body
        raise RuntimeError(f"HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error: {e.reason}")


# ===================== COMMAND: LOGIN =====================

def cmd_login(args):
    """Authenticate edge device to OmniHome Cloud."""
    cloud_url = (args.cloud or config.get_cloud_url()).rstrip("/")
    email = args.email
    password = args.password
    register_mode = args.register

    print("\n" + "=" * 50)
    print("      OmniHome Edge Device Authentication      ")
    print("=" * 50)
    print(f"Cloud Gateway: {cloud_url}\n")

    if not email:
        email = input("Tenant Email: ").strip()
    if not password:
        password = getpass.getpass("Password: ").strip()

    if not email or not password:
        print("Error: Email and password are required.")
        sys.exit(1)

    endpoint = f"{cloud_url}/api/auth/register" if register_mode else f"{cloud_url}/api/auth/login"
    payload = {"email": email, "password": password}
    if register_mode:
        name = input("Your Name (or press Enter for Edge User): ").strip() or "Edge User"
        payload["name"] = name

    try:
        print(f"Authenticating with {cloud_url}...")
        resp = _http_request(endpoint, method="POST", data=payload)
        token = resp.get("token")
        user = resp.get("user", {})

        if not token:
            print("Login failed: Cloud server did not return a valid JWT.")
            sys.exit(1)

        # Store credentials securely
        config.save_config({
            "cloud_url": cloud_url,
            "token": token,
            "user": user,
            "login_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

        print("\n[SUCCESS] Authentication verified!")
        print(f"  User ID:    {user.get('id')}")
        print(f"  User Name:  {user.get('name')}")
        print(f"  Email:      {user.get('email')}")
        print(f"  Config:     ~/.omnihome/edge_config.json (Permissions: 0600)")
        print("\nYou can now start the edge daemon using:")
        print("  omnihome-edge start\n")

    except Exception as e:
        print(f"\n[ERROR] Authentication failed: {e}\n")
        sys.exit(1)


# ===================== COMMAND: LOGOUT =====================

def cmd_logout(args):
    """Clear edge credentials."""
    config.clear_config()
    print("\n[SUCCESS] Logged out. Stored edge credentials cleared from disk.\n")


# ===================== COMMAND: STATUS =====================

def cmd_status(args):
    """Inspect edge hardware and cloud connectivity."""
    print("\n" + "=" * 55)
    print("             OmniHome Edge Device Status             ")
    print("=" * 55)

    token = config.get_token()
    cloud_url = config.get_cloud_url()
    user = config.get_user()

    print(f"Cloud URL:       {cloud_url}")
    print(f"Authenticated:   {'YES' if token else 'NO (Run: omnihome-edge login)'}")
    if user:
        print(f"User:            {user.get('name')} <{user.get('email')}> (ID: {user.get('id')})")

    # Hardware stats
    hw = EdgeHardware()
    telemetry = hw.get_telemetry()
    print("\n[Hardware Telemetry]")
    print(f"  GPIO Driver:   {'RPi.GPIO (Physical)' if HAS_RPI_GPIO else 'Virtual Emulation Mode'}")
    print(f"  CPU Temp:      {telemetry['cpu_temp']} °C")
    print(f"  CPU Load:      {telemetry['cpu_usage']} %")
    print(f"  Memory Usage:  {telemetry['memory_usage']} %")
    print(f"  Power Draw:    {telemetry['total_watts']} W")

    # Cloud Gateway reachability
    print("\n[Cloud Gateway Reachability]")
    try:
        sys_status = _http_request(f"{cloud_url}/api/status", token=token)
        print(f"  Status:        ONLINE (HTTP 200 OK)")
        print(f"  Gateway Hub:   {sys_status.get('gateway')}")
        print(f"  Version:       {sys_status.get('version')}")
        print(f"  Edge Linked:   {'Connected' if sys_status.get('edge_connected') else 'Waiting for daemon connection'}")
        print(f"  Devices Total: {sys_status.get('devices_count')}")
    except Exception as e:
        print(f"  Status:        OFFLINE or Unreachable ({e})")

    print("=" * 55 + "\n")


# ===================== COMMAND: DEVICES =====================

def cmd_devices(args):
    """List tenant devices from the cloud."""
    token = config.get_token()
    if not token:
        print("Error: Not logged in. Run 'omnihome-edge login' first.")
        sys.exit(1)

    cloud_url = config.get_cloud_url()
    try:
        devices = _http_request(f"{cloud_url}/api/devices", token=token)
        print("\n" + "=" * 65)
        print(f"{'ID':<12} {'NAME':<24} {'TYPE':<10} {'GPIO':<6} {'STATE':<8}")
        print("=" * 65)
        for d in devices:
            state_str = "ON" if d.get("state") else "OFF"
            gpio_str = str(d.get("gpio_pin", "-"))
            print(f"{d.get('id', ''):<12} {d.get('name', ''):<24} {d.get('type', ''):<10} {gpio_str:<6} {state_str:<8}")
        print("=" * 65 + "\n")
    except Exception as e:
        print(f"Error fetching devices: {e}")
        sys.exit(1)


# ===================== COMMAND: PIN-TEST =====================

def cmd_pin_test(args):
    """Test a physical GPIO pin directly on the edge hardware."""
    pin = args.pin
    state = args.state.lower() in ("1", "on", "true", "high")

    hw = EdgeHardware(mock_mode=args.mock)
    hw.setup_pin(pin)
    ok = hw.write_pin(pin, state)
    if ok:
        print(f"[SUCCESS] Pin GPIO {pin} set to {'ON (HIGH)' if state else 'OFF (LOW)'}.")
    else:
        print(f"[FAILED] Failed to actuate Pin GPIO {pin}.")


# ===================== COMMAND: START (DAEMON) =====================

def cmd_start(args):
    """Run edge tunnel daemon connecting edge hardware to Cloud Gateway."""
    token = config.get_token()
    if not token:
        print("\n[ERROR] Authentication required!")
        print("Please authenticate this edge device first by running:")
        print("  omnihome-edge login [--cloud <url>] [--email <email>]\n")
        sys.exit(1)

    cloud_url = (args.cloud or config.get_cloud_url()).rstrip("/")
    hub_id = args.hub_id
    mock_mode = args.mock
    interval = args.interval

    user = config.get_user() or {}
    print("\n" + "=" * 55)
    print("       OmniHome Edge Hardware Daemon Running        ")
    print("=" * 55)
    print(f"Tenant:         {user.get('name', 'User')} ({user.get('email', 'unknown')})")
    print(f"Cloud Gateway:  {cloud_url}")
    print(f"Hardware Mode:  {'Virtual Mock' if mock_mode or not HAS_RPI_GPIO else 'Physical Raspberry Pi GPIO'}")
    print(f"Telemetry Rate: Every {interval} seconds")
    print("=" * 55 + "\n")

    client = EdgeTunnelClient(
        cloud_url=cloud_url,
        token=token,
        hub_id=hub_id,
        mock_mode=mock_mode,
        telemetry_interval=interval,
    )

    def shutdown(sig, frame):
        logger.info("Received stop signal. Shutting down edge daemon...")
        client.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        asyncio.run(client.run())
    except (KeyboardInterrupt, SystemExit):
        client.stop()


# ===================== MAIN PARSER =====================

def build_parser():
    parser = argparse.ArgumentParser(
        prog="omnihome-edge",
        description="OmniHome Edge Device CLI for Raspberry Pi & Linux hardware nodes",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # login
    p_login = subparsers.add_parser("login", help="Authenticate edge device with cloud tenant credentials")
    p_login.add_argument("--cloud", help="OmniHome Cloud Gateway URL (e.g. http://localhost:8080)")
    p_login.add_argument("--email", help="Tenant email address")
    p_login.add_argument("--password", help="Tenant password")
    p_login.add_argument("--register", action="store_true", help="Register a new tenant account")
    p_login.set_defaults(func=cmd_login)

    # logout
    p_logout = subparsers.add_parser("logout", help="Clear stored credentials")
    p_logout.set_defaults(func=cmd_logout)

    # status
    p_status = subparsers.add_parser("status", help="Inspect edge hardware & cloud link status")
    p_status.set_defaults(func=cmd_status)

    # devices
    p_dev = subparsers.add_parser("devices", help="List tenant devices and configured GPIO channels")
    p_dev.set_defaults(func=cmd_devices)

    # pin-test
    p_pin = subparsers.add_parser("pin-test", help="Directly actuate a GPIO pin for diagnostics")
    p_pin.add_argument("pin", type=int, help="BCM GPIO pin number (e.g. 17)")
    p_pin.add_argument("state", help="Target state: 'on', 'off', '1', '0'")
    p_pin.add_argument("--mock", action="store_true", help="Test in virtual simulation mode")
    p_pin.set_defaults(func=cmd_pin_test)

    # start
    p_start = subparsers.add_parser("start", help="Start edge hardware daemon and reverse tunnel")
    p_start.add_argument("--cloud", help="Override Cloud Gateway URL")
    p_start.add_argument("--hub-id", help="Edge hardware hub identifier (default: host-based)")
    p_start.add_argument("--mock", action="store_true", help="Force virtual simulation mode")
    p_start.add_argument("--interval", type=int, default=3, help="Telemetry reporting interval (default: 3s)")
    p_start.set_defaults(func=cmd_start)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
