"""
Web Image Uploader
==================

Uploads security camera snapshot images to the PHP web server
for display in the web-based security gallery.

When the face recognizer captures a snapshot, this module sends it
via HTTP POST (multipart/form-data) to the ``Pi_web_img.php`` API
endpoint. The web server stores the image and records it in the
``security_cam`` database table.

Functions:
    upload_to_web() - Upload the latest snapshot to the web server.

Dependencies:
    requests - HTTP library for making API calls.
"""

import requests
import sys
import os
from PyHome.urls.urls import URL_IMG
from PyHome.settings_reader.settings_reader import reader


def upload_to_web():
    """Upload a security camera snapshot image to the PHP web server.

    Scans the web upload folder (configured as ``web_folder_name`` in
    config.json) for JPEG files, and uploads each one to the PHP
    server's ``Pi_web_img.php`` endpoint as a multipart form POST.

    The upload includes:
        - ``image``: The JPEG file (multipart file upload)
        - ``email``: The device owner's email (for ownership association)

    After successful upload, the source image file is deleted from the
    web folder to prevent re-uploading.

    API Endpoint:
        POST {URL_IMG} with multipart form data.

    Raises:
        requests.exceptions.RequestException: If the server is
            unreachable or returns an error. Triggers sys.exit(1).

    Note:
        - Server accepts JPEG and PNG files up to 2MB.
        - This function is designed to be called from a background thread.
    """
    for file in os.listdir(reader("web_folder_name")):
        if file.endswith(".jpg"):
            files = {'image': open(reader("web_folder_name") + "/frame0.jpg", "rb")}
            data = {'email': reader("email")}
            try:
                response = requests.post(URL_IMG, files=files, data=data).json()
                if response['error']:
                    print("Message\t :" + response['error_msg'])

            except requests.exceptions.RequestException as e:
                sys.exit(1)
            try:
                print("Successfully uploaded to Webserver...")
                os.remove(reader("web_folder_name") + "/frame0.jpg")
                print("File Removed from " + reader("web_folder_name") + "!")
                print("===================================================")
            except:
                print("Something went wrong, Not uploaded to Webserver...")
                print("===================================================")
