"""OmniHome Edge Configuration Management.

Stores credentials and device tokens securely in ~/.omnihome/edge_config.json
with strict 0600 file permissions to prevent unauthorized read/write access.
"""

import json
import os
import stat
from pathlib import Path
from typing import Any, Dict, Optional

CONFIG_DIR = Path.home() / ".omnihome"
CONFIG_FILE = CONFIG_DIR / "edge_config.json"
DEFAULT_CLOUD_URL = "http://localhost:8080"


def _ensure_dir():
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    else:
        # Enforce 0700 on the directory
        try:
            os.chmod(CONFIG_DIR, 0o700)
        except OSError:
            pass


def load_config() -> Dict[str, Any]:
    """Load configuration from disk. Returns empty dict if file does not exist."""
    _ensure_dir()
    if not CONFIG_FILE.exists():
        return {}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_config(data: Dict[str, Any]) -> None:
    """Save configuration to disk with strict 0600 permissions."""
    _ensure_dir()
    # Write to a temporary file then replace to ensure atomic write
    temp_file = CONFIG_DIR / "edge_config.tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    
    # Enforce strict 0600 (read/write only by owner)
    os.chmod(temp_file, stat.S_IRUSR | stat.S_IWUSR)
    temp_file.replace(CONFIG_FILE)
    os.chmod(CONFIG_FILE, stat.S_IRUSR | stat.S_IWUSR)


def clear_config() -> None:
    """Remove configuration file."""
    if CONFIG_FILE.exists():
        try:
            CONFIG_FILE.unlink()
        except OSError:
            pass


def get_token() -> Optional[str]:
    """Retrieve saved JWT authentication token."""
    cfg = load_config()
    return cfg.get("token")


def get_cloud_url() -> str:
    """Retrieve configured cloud URL."""
    cfg = load_config()
    return cfg.get("cloud_url", DEFAULT_CLOUD_URL).rstrip("/")


def get_user() -> Optional[Dict[str, Any]]:
    """Retrieve saved user information."""
    cfg = load_config()
    return cfg.get("user")


def is_authenticated() -> bool:
    """Check if valid token exists."""
    token = get_token()
    return bool(token and len(token) > 10)


def get_camera_config() -> Dict[str, Any]:
    """Retrieve edge camera & face recognition settings."""
    cfg = load_config()
    return {
        "enabled": cfg.get("camera_enabled", True),
        "source": cfg.get("camera_source", "0"),
        "face_detection": cfg.get("camera_face_detection", True),
        "cooldown": float(cfg.get("camera_cooldown", 5.0)),
        "width": int(cfg.get("camera_width", 640)),
        "height": int(cfg.get("camera_height", 480)),
    }


def update_camera_config(updates: Dict[str, Any]) -> None:
    """Save camera settings into edge_config.json."""
    cfg = load_config()
    for k, v in updates.items():
        cfg[f"camera_{k}"] = v
    save_config(cfg)

