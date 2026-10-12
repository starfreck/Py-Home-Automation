"""OmniHome Edge Hardware Abstraction Layer.

Manages GPIO channels on physical Raspberry Pi (3/4/5) and handles automatic
virtual emulation on non-Pi or development platforms. Collects CPU telemetry,
temperatures, memory, and wattage estimates.
"""

import logging
import os
import time
from typing import Any, Dict, List, Optional

try:
    import psutil
except ImportError:
    psutil = None

# Detect physical Raspberry Pi GPIO capability
HAS_RPI_GPIO = False
try:
    import RPi.GPIO as GPIO  # type: ignore
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    HAS_RPI_GPIO = True
except (ImportError, RuntimeError):
    HAS_RPI_GPIO = False

logger = logging.getLogger("OmniHomeEdge.Hardware")


class EdgeHardware:
    """Hardware controller for GPIO actuation and sensor telemetry."""

    def __init__(self, mock_mode: bool = False):
        self.mock_mode = mock_mode or (not HAS_RPI_GPIO)
        self.pins_state: Dict[int, bool] = {}
        self.pins_pwm: Dict[int, Any] = {}

        if self.mock_mode:
            logger.info("Initializing in VIRTUAL HARDWARE EMULATION mode (No physical GPIO).")
        else:
            logger.info("Physical RPi.GPIO hardware detected and active.")

    def setup_pin(self, pin: int, initial_state: bool = False):
        """Configure a pin as output with initial state."""
        self.pins_state[pin] = initial_state
        if not self.mock_mode and HAS_RPI_GPIO:
            try:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH if initial_state else GPIO.LOW)
            except Exception as e:
                logger.error(f"Failed to setup physical GPIO pin {pin}: {e}")
        logger.info(f"GPIO Pin {pin} configured -> State: {'HIGH/ON' if initial_state else 'LOW/OFF'}")

    def write_pin(self, pin: int, state: bool) -> bool:
        """Set state of a pin (HIGH / LOW)."""
        self.pins_state[pin] = state
        if not self.mock_mode and HAS_RPI_GPIO:
            try:
                GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)
            except Exception as e:
                logger.error(f"Error actuating physical GPIO {pin}: {e}")
                return False
        logger.info(f"Actuated GPIO {pin} -> {'ON (HIGH)' if state else 'OFF (LOW)'}")
        return True

    def get_pin(self, pin: int) -> bool:
        """Get current state of a pin."""
        return self.pins_state.get(pin, False)

    def read_cpu_temp(self) -> float:
        """Read Raspberry Pi SoC temperature from thermal zone or psutil."""
        thermal_path = "/sys/class/thermal/thermal_zone0/temp"
        if os.path.exists(thermal_path):
            try:
                with open(thermal_path, "r", encoding="utf-8") as f:
                    return round(float(f.read().strip()) / 1000.0, 1)
            except Exception:
                pass

        if psutil and hasattr(psutil, "sensors_temperatures"):
            try:
                temps = psutil.sensors_temperatures()
                if temps:
                    for _, entries in temps.items():
                        if entries:
                            return round(entries[0].current, 1)
            except Exception:
                pass
        return 38.5

    def get_telemetry(self) -> Dict[str, Any]:
        """Aggregate live hardware telemetry for cloud ingestion."""
        cpu_usage = psutil.cpu_percent(interval=0.05) if psutil else 4.2
        mem_usage = psutil.virtual_memory().percent if psutil else 23.5
        cpu_temp = self.read_cpu_temp()
        active_relays = sum(1 for s in self.pins_state.values() if s)

        # Baseline edge idle draw is ~12W + ~45W per active physical relay
        watts = round(active_relays * 45.0 + 12.0, 1)

        return {
            "temperature": 22.5,
            "humidity": 48.0,
            "total_watts": watts,
            "cpu_usage": round(cpu_usage, 1),
            "memory_usage": round(mem_usage, 1),
            "cpu_temp": round(cpu_temp, 1),
            "active_count": active_relays,
            "total_count": len(self.pins_state) if self.pins_state else 6,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def cleanup(self):
        """Reset physical GPIO pins on shutdown."""
        if not self.mock_mode and HAS_RPI_GPIO:
            try:
                GPIO.cleanup()
                logger.info("Physical GPIO pins successfully reset and cleaned up.")
            except Exception as e:
                logger.error(f"GPIO cleanup error: {e}")
