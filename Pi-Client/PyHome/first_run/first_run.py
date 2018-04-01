import json
import os

def first_run():
    print("============================================================================")
    print("============================================================================")
    print("================    Hello Welcome to Pi-Client Software     ================")
    print("============================================================================")
    print("============================================================================")
    print("================    Version:2.0     Develop By: Venom       ================")
    print("============================================================================")
    print("====If you are seeing this msg means you are running this app first time====")
    print("====Don't worry relax seat back and edit few one time run configurations====")
    print("============================================================================")

    data = {}
    try:
        os.mkdir("settings")
    except:
        os.stat("settings")

    Name = os.path.join("settings/", "config.json")
    f = open(Name, "a")
    f.close()
    interface_name = raw_input('Enter Network Interface Name:').lower()
    data["interface_name"] = interface_name
    email = raw_input('Email   :').lower()
    data["email"] = email
    password = raw_input('Password:')
    data["password"] = password
    device = int(raw_input("Which Device you like to use? [Webcam:Mobile]:[0:1]:"))
    data["device"] = device
    webcam_no = int(raw_input("Enter your webcam number [Note:Default Webcam has number 0]:"))
    data["webcam_no"] = webcam_no
    mobile_mode = int(
        raw_input("Would you like to use 'ipwebcam' or 'manual' mode for mobiles?[ipwebcam:manual]:[0:1] :"))
    data["mobile_mode"] = mobile_mode
    email_update_interval = int(raw_input("Enter E-mail interval in Seconds :"))
    data["email_update_interval"] = email_update_interval
    print("Default email_folder_Name = draft")
    data["email_folder_name"] = "draft"
    print("Default web_folder_Name = sent")
    data["web_folder_name"] = "sent"
    with open(Name, 'w') as outfile:
        json.dump(data, outfile, indent=4)
    print("============================================================================")
    print("========  All configurations are save under setting/config.json   ==========")
    print("========You can change these settings by modifying in config.json===========")
    print("============================================================================")
    print("============================================================================")
    print("==========           Set Default Local-Host Commands              ==========")
    print("============================================================================")

    commands = {}
    Name1 = os.path.join("settings/", "commands.json")
    f = open(Name1, "a")
    f.close()
    device_1_on = raw_input('Enter command to turn on device 1:').lower()
    commands["device_1_on"] = device_1_on
    device_1_off = raw_input('Enter command to turn off device 1:').lower()
    commands["device_1_off"] = device_1_off
    device_2_on = raw_input('Enter command to turn on device 2:').lower()
    commands["device_2_on"] = device_2_on
    device_2_off = raw_input('Enter command to turn off device 2:').lower()
    commands["device_2_off"] = device_2_off
    device_3_on = raw_input('Enter command to turn on device 3:').lower()
    commands["device_3_on"] = device_3_on
    device_3_off = raw_input('Enter command to turn off device 3:').lower()
    commands["device_3_off"] = device_3_off
    device_4_on = raw_input('Enter command to turn on device 4:').lower()
    commands["device_4_on"] = device_4_on
    device_4_off = raw_input('Enter command to turn off device 4:').lower()
    commands["device_4_off"] = device_4_off

    print("==============================================================================")
    print("========     All commands are save under setting/commands.json      ==========")
    print("========You can change these commands by modifying in commands.json===========")
    print("========             Please Re-run this software                  ===========")
    print("==============================================================================")
    print("================                Thank-you                    =================")
    print("==============================================================================")