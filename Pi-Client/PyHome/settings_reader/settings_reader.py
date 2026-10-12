"""
Settings Reader
===============

Reads configuration values from the ``settings/config.json`` file.

This module provides a simple key-value lookup into the JSON
configuration file that stores all Pi-Client runtime settings
(user credentials, camera settings, folder names, etc.).

The config file is created by the first_run module on initial setup
and can be manually edited afterwards.

Config File Location:
    settings/config.json

Available Keys:
    interface_name        (str)  - Network interface name (e.g., 'wlan0')
    email                 (str)  - User's registered email address
    password              (str)  - User's password
    device                (int)  - Camera source: 0=webcam, 1=mobile
    webcam_no             (int)  - Webcam device index (default 0)
    mobile_mode           (int)  - 0=IP Webcam app, 1=manual URL
    email_update_interval (int)  - Seconds between email notifications
    email_folder_name     (str)  - Folder for email-bound snapshots
    web_folder_name       (str)  - Folder for web-upload-bound snapshots

Functions:
    reader(key) - Read a single configuration value by key.
"""

import json


def reader(key):
    """Read a configuration value from settings/config.json.

    Args:
        key (str): The configuration key to look up (e.g., 'email',
            'interface_name', 'webcam_no').

    Returns:
        The value associated with the key. Type varies by key:
        str, int, or other JSON-compatible types.
        Returns False if the key is not found or the file cannot be read.

    Example:
        >>> reader("email")
        'user@example.com'
        >>> reader("webcam_no")
        0
        >>> reader("nonexistent_key")
        False
    """
    try:
        with open('settings/config.json', 'r') as f:
            config = json.load(f)
        return config[key]

    except:
        return False