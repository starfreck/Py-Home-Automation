"""
API Endpoint URLs
=================

Centralized configuration for all PHP web server API endpoint URLs
used by the Pi-Client.

Update these URLs to match your PHP web server's address before running
the Pi-Client. The URLs support both local development (localhost) and
remote/hosted servers.

Constants:
    URL_REG   - Pi device registration endpoint (reg_pi.php)
    URL_LOGIN - User authentication endpoint (login.php)
    URL_IMG   - Security camera image upload endpoint (Pi_web_img.php)

Usage:
    from PyHome.urls.urls import URL_LOGIN, URL_REG, URL_IMG

Configuration:
    Change 'localhost' to your server's IP address or domain name
    for remote access. Examples are provided as comments below.
"""

URL_REG = 'http://localhost/PyHomeAutomation/api/reg_pi.php?'
"""str: URL for registering/updating a Raspberry Pi device.
POST parameters: mac, local_ip, global_ip, email, latitude, longitude."""

URL_LOGIN = 'http://localhost/PyHomeAutomation/api/login.php?'
"""str: URL for authenticating a user.
POST parameters: email, password."""

URL_IMG = 'http://localhost/PyHomeAutomation/api/Pi_web_img.php?'
"""str: URL for uploading security camera snapshots.
POST parameters: email (form field), image (file upload)."""

#URL_REG = 'http://pyhomeautomation.epizy.com/api/reg_pi.php?'
#URL_LOGIN = 'http://pyhomeautomation.epizy.com/api/login.php?'
#URL_GET = 'http://pyhomeautomation.epizy.com/api/get.php?'


#URL_REG = 'http://pyhomeautomation.uphero.com/api/reg_pi.php?'
#URL_LOGIN = 'http://pyhomeautomation.uphero.com/api/login.php?'
