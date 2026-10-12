"""
Py-Home-Automation: Pi-Client Entry Point
==========================================

Main entry point for the Raspberry Pi home automation client.

This script orchestrates the startup sequence:
1. Checks for existing configuration files (settings/config.json, settings/commands.json).
2. If missing, runs the first-run interactive setup wizard.
3. Authenticates the user against the PHP web server.
4. Collects device information (MAC, IPs, geolocation).
5. Registers/updates the Pi device on the web server.
6. If the device is approved (status=1), starts two parallel threads:
   - Thread 1: TCP socket server (listens for commands on port 1997)
   - Thread 2: Face recognizer (webcam/mobile camera security monitoring)

Usage:
    python run.py

Configuration:
    settings/config.json   - User credentials and device settings
    settings/commands.json - Voice command to device mappings

Dependencies:
    requests, netifaces, pif, pygeoip, opencv-python, numpy
"""

import requests
import threading
import os

from PyHome.functions.functions import get_mac
from PyHome.functions.functions import get_global_ip
from PyHome.functions.functions import get_local_ip
from PyHome.functions.functions import location
from PyHome.urls.urls import URL_LOGIN
from PyHome.urls.urls import URL_REG
from PyHome.server.server import SS
from PyHome.first_run.first_run import first_run
from PyHome.settings_reader.settings_reader import reader
from PyHome.face_recognizer.face_recognizer import Welcome


def taskA():
    """Start the TCP socket server for receiving device control commands.

    Creates and starts an instance of the SS (Socket Server) class,
    which listens on port 1997 for incoming commands from the Android
    app or PHP web server relay.
    """
    Server = SS()
    Server.create()


def taskB():
    """Start the face recognition security camera system.

    Launches the Welcome() function which determines the camera source
    (webcam or mobile IP camera) from config and begins continuous
    face detection monitoring with email and web upload notifications.
    """
    Welcome()


if os.path.exists('settings/config.json') and os.path.exists('settings/commands.json'):
    loop = 'true'
    while loop == 'true':
        print("=======================================================")
        interface_name = reader("interface_name")
        print ("Interface Name :"+interface_name)
        print("=======================================================")
        email = reader("email")
        password = reader("password")
        print ("E-mail :"+email)
        print("=======================================================")

        payload1 = {'email': email, 'password': password}

        r1 = requests.post(URL_LOGIN, data=payload1).json()

        if r1['error']:
            print("Message\t : " + r1['error_msg'])
            print("=======================================================")
            print("Change your Login credentials in settings/config.json")
            print("=======================================================")
            exit(0)

        else:
            print("***#_User Details_#***")
            print("uid\t  :" + r1['uid'])
            print("Name\t  :" + r1['user']['name'])
            r_email = r1['user']['email']
            print("Email\t  :" + r1['user']['email'])
            print("created_at:" + r1['user']['created_at'])
            print("updated_at:" + r1['user']['updated_at'])
            loop = 'false'
            mac = get_mac(interface_name)
            global_ip = get_global_ip()
            local_ip = get_local_ip(interface_name)
            latitude, longitude = location()

            print("=======================================================")
            print("***#_Device Details_#***")
            print("Your MAC Address :" + mac)
            print("Your Global IP\t :" + global_ip)
            print("Your Local IP\t :" + local_ip)
            print("Latitude\t :" + str(latitude))
            print("Longitude\t :" + str(longitude))
            print("=======================================================")

            payload2 = {'mac': mac, 'local_ip': local_ip, 'global_ip': global_ip, 'email': email, 'latitude': latitude,
                        'longitude': longitude}

            r2 = requests.post(URL_REG, data=payload2).json()

            if r2['error']:
                status = r2['status']
                if status == '1':
                    print("Status   :Active")
                elif status == '0':
                    print("Status   :Not Active")
                print("Message\t :" + r2['error_msg'])

            else:
                print("***#_Device Details_#***")
                print("Device id :" + r2['device_unique_id'])
                print("Owner\t  :" + r2['owner'])
                r_mac = r2['device']['mac']
                print("Mac\t  :" + r2['device']['mac'])
                print("Local IP  :" + r2['device']['local_ip'])
                print("Global IP :" + r2['device']['global_ip'])
                print("created_at:" + r2['device']['created_at'])
                print("Latitude  :" + r2['device']['latitude'])
                print("Longitude :" + r2['device']['longitude'])
                status = r2['device']['status']
                if status == '1':
                    print("Status    :Active")
                elif status == '0':
                    print("Status    :Not Active")

            print("=======================================================")

            if status == '1':
                p1 = threading.Thread(target=taskA)
                p2 = threading.Thread(target=taskB)
                p1.start()
                p2.start()
            elif status == '0':
                print("Your Device isn't activated yet, Please contact Admin for approval  ")
                print("Thank you")
                exit(0)
else:
    first_run()
