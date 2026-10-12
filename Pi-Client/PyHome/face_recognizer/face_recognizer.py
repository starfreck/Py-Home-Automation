"""
Face Recognizer / Security Camera
==================================

OpenCV-based face detection system that monitors a camera feed (webcam
or mobile IP camera) and performs two actions when a face is detected:

1. Sends an email notification with a snapshot attached.
2. Uploads the snapshot to the PHP web server for the security gallery.

The module uses Haar cascade classifiers for real-time face and eye
detection, drawing rectangles around detected features on the live feed.

Notification throttling is controlled by the ``email_update_interval``
setting in config.json (in seconds) to avoid spamming.

Functions:
    MobileStream()  - Stream from a mobile IP camera (e.g., IP Webcam app)
    WebcamStream()  - Stream from a local USB/built-in webcam
    Welcome()       - Entry point that selects the camera source from config

Dependencies:
    opencv-python (cv2) - Computer vision and image processing
    numpy               - Array operations for image handling
    urllib               - URL-based image fetching (mobile stream)

Models Used (in models/ directory):
    haarcascade_frontalface_default.xml - Front face detection
    haarcascade_eye.xml                 - Eye detection
"""

import urllib
import cv2
import numpy as np
import os
import time
import threading
from PyHome.settings_reader.settings_reader import reader
from PyHome.email.mail import sendEmail
from PyHome.web_uploader.web_uploader import upload_to_web

email_update_interval = reader("email_update_interval")  # sends an email only once in this time interval in Seconds
last_interval = 0

face_cascade = cv2.CascadeClassifier('models/haarcascade_frontalface_default.xml')
face_glass_cascade = cv2.CascadeClassifier('models/haarcascade_eye.xml')


def MobileStream():
    """Stream video from a mobile IP camera and perform face detection.

    Connects to a mobile phone's camera stream via HTTP (typically an
    IP Webcam app running on the phone). Continuously fetches JPEG frames,
    performs face and eye detection, and displays the annotated feed.

    Camera URL modes (from config.json ``mobile_mode``):
        - 0: Uses default IP Webcam URL (http://192.168.43.1:8080/shot.jpg)
        - 1: Prompts the user to enter a custom streaming URL

    Detection features:
        - Faces are highlighted with magenta rectangles
        - Eyes are highlighted with green rectangles

    Press 'q' to quit the live stream window.

    Note:
        This function runs in an infinite loop and blocks the calling thread.
        Unlike WebcamStream(), this does NOT trigger email/web notifications.
    """
    loop = True
    while loop:
        raw = reader("mobile_mode")
        if raw == 0:
            loop = False
            url = 'http://192.168.43.1:8080/shot.jpg'
        elif raw == 1:
            loop = False
            url = str(raw_input("Enter live streming URL :"))
        else:
            print("Wrong choice plase try again..!!")

    while True:
        imgResp = urllib.urlopen(url)
        imgNp = np.array(bytearray(imgResp.read()), dtype=np.uint8)
        img = cv2.imdecode(imgNp, -1)
        # cv2.imshow('test',img)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        for (x, y, w, h) in faces:
            cv2.rectangle(img, (x, y), (x + w, y + h), (255, 0, 255), 2)
            roi_gray = gray[y:y + h, x:x + w]
            roi_color = img[y:y + h, x:x + w]
            face_glass = face_glass_cascade.detectMultiScale(roi_gray)

            for (ex, ey, ew, eh) in face_glass:
                cv2.rectangle(roi_color, (ex, ey), (ex + ew, ey + eh), (0, 255, 0), 2)
        cv2.imshow('Live Streaming...', img)
        # cv2.destroyAllWindows()
        if ord('q') == cv2.waitKey(10) & 0xff:
            exit(0)


def WebcamStream():
    """Stream video from a local webcam and perform face detection with notifications.

    Captures frames from a USB or built-in webcam, performs real-time face
    and eye detection using Haar cascades, and triggers security notifications
    (email + web upload) when faces are detected.

    Notification throttling:
        Notifications are sent at most once per ``email_update_interval``
        seconds (configured in config.json) to prevent excessive alerts.

    When a face is detected:
        1. Saves the frame to the ``email_folder_name`` directory
        2. Saves the frame to the ``web_folder_name`` directory
        3. Spawns a thread to send an email notification (sendEmail)
        4. Spawns a thread to upload the image to the web server (upload_to_web)

    Detection features:
        - Faces are highlighted with magenta rectangles
        - Eyes are highlighted with green rectangles

    Press 'q' to quit the live stream window.

    Note:
        This function runs in an infinite loop and blocks the calling thread.
        The webcam number is read from config.json ``webcam_no`` key.
    """
    global last_interval
    raw = reader("webcam_no")
    email_folder_name=reader("email_folder_name")
    web_folder_name = reader("web_folder_name")
    try:
        os.stat(email_folder_name)
        os.stat(web_folder_name)
    except:
        os.mkdir(email_folder_name)
        os.mkdir(web_folder_name)
    # count = 0
    cap = cv2.VideoCapture(raw)

    while True:
        ret, img = cap.read()
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        for (x, y, w, h) in faces:
            cv2.rectangle(img, (x, y), (x + w, y + h), (255, 0, 255), 2)
            if (time.time() - last_interval) > email_update_interval:
                last_interval = time.time()
                cv2.imwrite(os.path.join(email_folder_name, "frame0.jpg"), img)
                cv2.imwrite(os.path.join(web_folder_name, "frame0.jpg"), img)
                p1 = threading.Thread(target=sendEmail)
                p2 = threading.Thread(target=upload_to_web)
                p1.start()
                p2.start()

            roi_gray = gray[y:y + h, x:x + w]
            roi_color = img[y:y + h, x:x + w]
            face_glass = face_glass_cascade.detectMultiScale(roi_gray)

            for (ex, ey, ew, eh) in face_glass:
                cv2.rectangle(roi_color, (ex, ey), (ex + ew, ey + eh), (0, 255, 0), 2)

        cv2.imshow('Live Streaming...', img)
        if ord('q') == cv2.waitKey(10) & 0xff:
            exit(0)
    cap.release()
    cv2.destroyAllWindows()


def Welcome():
    """Entry point for the face recognition security system.

    Reads the ``device`` setting from config.json to determine the
    camera source and launches the appropriate stream function:

    - device=0: Launch WebcamStream() for local USB/built-in webcam
    - device=1: Launch MobileStream() for mobile IP camera

    This function is called from run.py as a separate thread (taskB).
    """
    loop = True
    while loop is True:
        raw = reader("device")
        if raw == 0:
            loop = False
            WebcamStream()
        elif raw == 1:
            loop = False
            MobileStream()
        else:
            print("Please choose correct option...!")