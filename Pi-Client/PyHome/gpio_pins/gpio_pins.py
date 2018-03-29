# sudo pip install RPi.GPIO

# import RPi.GPIO as GPIO


def switch(state=bool,device_no=int):

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