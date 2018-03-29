import requests
import sys
import os
from PyHome.urls.urls import URL_IMG
from PyHome.settings_reader.settings_reader import read


def upload_to_web():
    for file in os.listdir(read("web_folder_name")):
        if file.endswith(".jpg"):
            files = {'image': open(read("web_folder_name")+"/frame0.jpg", "rb")}
            data = {'email': read("email")}
            try:
                response = requests.post(URL_IMG, files=files, data=data).json()
                if response['error']:
                    print("Message	 :" + response['error_msg'])

            except requests.exceptions.RequestException as e:
                sys.exit(1)
            try:
                print("Successfully uploaded to Webserver...")
                os.remove(read("web_folder_name")+"/frame0.jpg")
                print("File Removed from "+read("web_folder_name")+"!")
                print("===================================================")
            except:
                print("Something went wrong, Not uploaded to Webserver...")
                print("===================================================")
