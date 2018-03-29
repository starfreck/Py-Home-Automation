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
from PyHome.settings_reader.settings_reader import read
from PyHome.face_recognizer.Final_cam_modual import Welcome


def taskA():
    Server = SS()
    Server.create()


def taskB():
    Welcome()


if os.path.exists('settings/config.json'):
    loop = 'true'
    while loop == 'true':
        print("=======================================================")
        interface_name = read("interface_name")
        print ("Interface Name :"+interface_name)
        print("=======================================================")
        email = read("email")
        password = read("password")
        print ("E-mail :"+email)
        print("=======================================================")

        payload1 = {'email': email, 'password': password}

        r1 = requests.post(URL_LOGIN, data=payload1).json()

        if r1['error']:
            print("Message	 : " + r1['error_msg'])
            print("=======================================================")
            print("Change your Login credentials in settings/config.json")
            print("=======================================================")
            exit()

        else:
            print("***#_User Details_#***")
            print("uid	  :" + r1['uid'])
            print("Name	  :" + r1['user']['name'])
            r_email = r1['user']['email']
            print("Email	  :" + r1['user']['email'])
            print("created_at:" + r1['user']['created_at'])
            print("updated_at:" + r1['user']['updated_at'])
            loop = 'false'
            mac = get_mac(interface_name)
            global_ip = get_global_ip()
            local_ip = get_local_ip(interface_name)
            latitude, longitude = location()

            print("=======================================================")
            print("Your MAC Address :" + mac)
            print("Your Global IP	 :" + global_ip)
            print("Your Local IP	 :" + local_ip)
            print("Latitude	 :" + str(latitude))
            print("Longitude	 :" + str(longitude))
            print("=======================================================")

            payload2 = {'mac': mac, 'local_ip': local_ip, 'global_ip': global_ip, 'email': email, 'latitude': latitude,
                        'longitude': longitude}

            r2 = requests.post(URL_REG, data=payload2).json()

            if r2['error']:
                print("Message	 :" + r2['error_msg'])

            else:
                print("***#_Device Details_#***")
                print("Device id :" + r2['device_unique_id'])
                print("Owner	  :" + r2['owner'])
                r_mac = r2['device']['mac']
                print("Mac	  :" + r2['device']['mac'])
                print("Local IP  :" + r2['device']['local_ip'])
                print("Global IP :" + r2['device']['global_ip'])
                print("created_at:" + r2['device']['created_at'])
                print("Latitude  :" + r2['device']['latitude'])
                print("Longitude :" + r2['device']['longitude'])
            print("=======================================================")

            if True:
                p1 = threading.Thread(target=taskA)
                p2 = threading.Thread(target=taskB)
                p1.start()
                p2.start()
            else:
                print("Your Device isn't activated yet, Please contact Admin for approval  ")
                print("Thank you")
                exit(0)
else:
    first_run()
