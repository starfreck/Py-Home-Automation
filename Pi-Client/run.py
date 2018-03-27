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
from PyHome.settings_read_write.settings_read_write import write
from PyHome.settings_read_write.settings_read_write import read
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
        print ("Interface_name :", interface_name)
        print("=======================================================")
        email = read("email")
        password = read("password")
        print ("E-mail :", email)
        print("=======================================================")

        payload1 = {'email': email, 'password': password}

        r1 = requests.post(URL_LOGIN, data=payload1).json()

        if r1['error']:
            print("Message	 :" + r1['error_msg'])
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

            p1 = threading.Thread(target=taskA)
            p2 = threading.Thread(target=taskB)

            p1.start()
            p2.start()
else:
    import json

    data = {}
    os.mkdir("settings")
    Name = os.path.join("settings/", "config.json")
    f = open(Name, "a")
    f.close()
    interface_name = raw_input('Enter Network Interface Name:')
    data["interface_name"]=interface_name
    email = raw_input('Email   :')
    data["email"] = email
    password = raw_input('Password:')
    data["password"] = password
    device = int(raw_input("Which Device you like to use? [Webcam:Mobile]:[0:1]:"))
    data["device"] = device
    webcam_no = int(raw_input("Enter your webcam number [Note:Default Webcam has number 0]:"))
    data["webcam_no"] = webcam_no
    mobile_mode=int(raw_input("Would you like to use 'ipwebcam' or 'manual' mode for mobiles?[ipwebcam:manual]:[0:1] :"))
    data["mobile_mode"] = mobile_mode
    email_update_interval = int(raw_input("Enter E-mail interval in Seconds :"))
    data["email_update_interval"] = email_update_interval
    print("Default email_folder_Name = draft")
    data["email_folder_name"] = "draft"
    print("Default web_folder_Name = sent")
    data["web_folder_name"] = "sent"
    with open(Name, 'w') as outfile:
        json.dump(data, outfile, indent=4)
