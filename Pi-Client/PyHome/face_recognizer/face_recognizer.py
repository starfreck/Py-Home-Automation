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