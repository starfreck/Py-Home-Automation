"""
Command Reader
==============

Reads custom voice command mappings from the ``settings/commands.json`` file.

This module provides key-value lookup for the voice commands that map
spoken phrases to device on/off actions. The commands file is created
by the first_run module on initial setup and can be manually edited.

Command File Location:
    settings/commands.json

Available Keys:
    device_1_on   (str) - Voice command to turn on device 1
    device_1_off  (str) - Voice command to turn off device 1
    device_2_on   (str) - Voice command to turn on device 2
    device_2_off  (str) - Voice command to turn off device 2
    device_3_on   (str) - Voice command to turn on device 3
    device_3_off  (str) - Voice command to turn off device 3
    device_4_on   (str) - Voice command to turn on device 4
    device_4_off  (str) - Voice command to turn off device 4

Functions:
    reader(key) - Read a single command mapping by key.
"""

import json


def reader(key):
    """Read a voice command mapping from settings/commands.json.

    Args:
        key (str): The command key to look up (e.g., 'device_1_on',
            'device_2_off').

    Returns:
        str: The voice command text associated with the key
            (e.g., 'turn on light').
        Returns False if the key is not found or the file cannot be read.

    Example:
        >>> reader("device_1_on")
        'turn on light'
        >>> reader("device_3_off")
        'turn off tv'
    """
    try:
        with open('settings/commands.json', 'r') as f:
            config = json.load(f)
        return config[key]

    except:
        return False
