"""
GPIO Pin Controller
===================

Controls Raspberry Pi GPIO pins to switch electrical devices on and off.

This module maps logical device numbers (1-4) to physical GPIO pins
on the Raspberry Pi. Each device can be toggled on (True) or off (False).

.. note::
    The actual RPi.GPIO control code is currently commented out.
    This module prints status messages as a stub/simulator. To enable
    real hardware control on a Raspberry Pi:

    1. Install RPi.GPIO: ``pip install RPi.GPIO``
    2. Uncomment ``import RPi.GPIO as GPIO`` at the top
    3. Add GPIO.setup() and GPIO.output() calls in each condition block

Functions:
    switch(state, device_no) - Toggle a device on or off by device number.

GPIO Pin Mapping (suggested):
    Device 1 → GPIO Pin 17
    Device 2 → GPIO Pin 18
    Device 3 → GPIO Pin 27
    Device 4 → GPIO Pin 22
"""

# sudo pip install RPi.GPIO

# import RPi.GPIO as GPIO


def switch(state=bool,device_no=int):
    """Toggle a device on or off based on its device number.

    Maps a logical device number to the appropriate GPIO pin and
    sets it HIGH (on) or LOW (off). Currently operates as a stub
    that prints status messages instead of controlling actual GPIO pins.

    Args:
        state (bool): The desired state of the device.
            True = turn on (GPIO HIGH), False = turn off (GPIO LOW).
        device_no (int): The logical device number (1-4).
            Maps to a physical GPIO pin on the Raspberry Pi.

    Example:
        >>> switch(True, 1)   # Turn on device 1
        Device-1 stared...
        >>> switch(False, 2)  # Turn off device 2
        Device-2 stoped...

    Note:
        Currently supports devices 1-4. To add more devices,
        add additional elif blocks with the corresponding GPIO
        pin mappings.
    """

    # Device 1 On
    if state is True and device_no is 1:
        print("Device-1 stared...")

    # Device 1 Off
    elif state is False and device_no is 1:
        print("Device-1 stoped...")

    # Device 2 On
    elif state is True and device_no is 2:
        print("Device-2 stared...")

    # Device 2 Off
    elif state is False and device_no is 2:
        print("Device-2 stoped...")

    # Device 3 On
    elif state is True and device_no is 3:
        print("Device-3 stared...")

    # Device 3 Off
    elif state is False and device_no is 3:
        print("Device-3 stoped...")

    # Device 4 On
    elif state is True and device_no is 4:
        print("Device-4 stared...")

    # Device 4 Off
    elif state is False and device_no is 4:
        print("Device-4 stoped...")

    else:
        print("unknown command is given...")