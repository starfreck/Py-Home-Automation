"""
PyHome - Home Automation Package
================================

The core Python package for the Py-Home-Automation Pi-Client.

This package provides all the modules needed to run a Raspberry Pi
as a home automation controller, including:

- Network device control via TCP sockets
- Face detection security camera
- Email notifications
- Web server integration
- GPIO pin management
- Configuration management

Subpackages:
    command_reader    - Read custom voice command mappings from commands.json
    email             - Send security camera snapshots via Gmail SMTP
    face_recognizer   - OpenCV-based face detection for webcam/mobile streams
    first_run         - Interactive CLI wizard for initial setup
    functions         - Network utility functions (MAC, IP, geolocation)
    gpio_pins         - Raspberry Pi GPIO pin control
    server            - TCP socket server for receiving commands
    settings_reader   - Read configuration from config.json
    urls              - Centralized API endpoint URL definitions
    web_uploader      - Upload security images to the PHP web server
"""
