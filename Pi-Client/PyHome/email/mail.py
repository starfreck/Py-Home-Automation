import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from PyHome.settings_read_write.settings_read_write import read

# Email you want to send the update from (only works with gmail)
fromEmail = '' # write your own Gmail
# You can generate an app password here to avoid storing your password in plain text
# https://support.google.com/accounts/answer/185833?hl=en
fromEmailPassword = '' # write your Gmail Password

# Email you want to send the update to
toEmail = read("email")


def sendEmail():
    for file in os.listdir(read("email_folder_name")):
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
            name = os.path.basename(read("email_folder_name") + "/frame0.jpg")
            msgImage = MIMEImage(open(read("email_folder_name")+"/frame0.jpg", "rb").read(), name)
            msgImage.add_header('Content-ID', '<image1>')
            msgRoot.attach(msgImage)

            smtp = smtplib.SMTP('smtp.gmail.com', 587)
            smtp.starttls()
            smtp.login(fromEmail, fromEmailPassword)
            smtp.sendmail(fromEmail, toEmail, msgRoot.as_string())
            smtp.quit()
            try:
                print("E-mail Notification Sent...")
                os.remove(read("email_folder_name")+"/frame0.jpg")
                print("File Removed from "+read("email_folder_name")+"!")
                print("===================================================")
            except:
                print("Something went wrong, E-mail Notification Not Sent...")
                print("===================================================")