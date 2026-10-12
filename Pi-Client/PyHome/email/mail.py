"""
Email Notification Service
==========================

Sends security camera snapshot images as email notifications via
Gmail SMTP. When the face recognizer detects a person, this module
composes an HTML email with the captured image embedded inline and
sends it to the device owner.

Configuration:
    - ``fromEmail``: The Gmail address to send FROM (set in this file)
    - ``fromEmailPassword``: Gmail app password (set in this file)
    - ``toEmail``: Recipient email (read from config.json ``email`` key)
    - ``email_folder_name``: Directory containing snapshots to send
      (read from config.json)

Security Note:
    For Gmail, generate an App Password instead of using your main
    password: https://support.google.com/accounts/answer/185833

Functions:
    sendEmail() - Compose and send security alert email with image attachment.

Dependencies:
    smtplib       - SMTP protocol client (Python standard library)
    email.mime.*  - Email message composition (Python standard library)
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from PyHome.settings_reader.settings_reader import reader

# Email you want to send the update from (only works with gmail)
fromEmail = ''
# You can generate an app password here to avoid storing your password in plain text
# https://support.google.com/accounts/answer/185833?hl=en
fromEmailPassword = ''

# Email you want to send the update to
toEmail = reader("email")


def sendEmail():
    """Send a security camera alert email with an attached snapshot image.

    Scans the email folder (configured as ``email_folder_name`` in config.json)
    for JPEG files, composes an HTML email with the image embedded inline
    using Content-ID, and sends it via Gmail's SMTP server (port 587 with TLS).

    After successful sending, the source image file is deleted from the
    email folder to prevent re-sending.

    Email structure:
        - Subject: "Security Updates"
        - Body text: "Smart security cam found Someone at your doorsteps..."
        - Inline image: The captured face detection frame

    Raises:
        smtplib.SMTPAuthenticationError: If Gmail credentials are invalid.
        OSError: If the email folder or image file cannot be accessed.

    Note:
        - Set ``fromEmail`` and ``fromEmailPassword`` module variables before use.
        - Gmail requires either "Less Secure Apps" enabled or an App Password.
        - This function is designed to be called from a background thread.
    """
    for file in os.listdir(reader("email_folder_name")):
        if file.endswith(".jpg"):
            msgRoot = MIMEMultipart('related')
            msgRoot['Subject'] = 'Security Updates'
            msgRoot['From'] = fromEmail
            msgRoot['To'] = toEmail
            msgRoot.preamble = 'Security camera update'

            msgAlternative = MIMEMultipart('alternative')
            msgRoot.attach(msgAlternative)
            msgText = MIMEText('Smart security cam found Someone at your doorsteps...')
            msgAlternative.attach(msgText)

            msgText = MIMEText('<img src="cid:image1">', 'html')
            msgAlternative.attach(msgText)
            name = os.path.basename(reader("email_folder_name") + "/frame0.jpg")
            msgImage = MIMEImage(open(reader("email_folder_name") + "/frame0.jpg", "rb").read(), name)
            msgImage.add_header('Content-ID', '<image1>')
            msgRoot.attach(msgImage)

            smtp = smtplib.SMTP('smtp.gmail.com', 587)
            smtp.starttls()
            smtp.login(fromEmail, fromEmailPassword)
            smtp.sendmail(fromEmail, toEmail, msgRoot.as_string())
            smtp.quit()
            try:
                print("E-mail Notification Sent...")
                os.remove(reader("email_folder_name") + "/frame0.jpg")
                print("File Removed from " + reader("email_folder_name") + "!")
                print("===================================================")
            except:
                print("Something went wrong, E-mail Notification Not Sent...")
                print("===================================================")