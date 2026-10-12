"""
TCP Socket Server
=================

Provides the main TCP socket server that listens for incoming device
control commands from the Android app (via direct connection or PHP
server relay).

The server listens on port 1997 and supports two command formats:

1. **Structured commands** (from PHP relay):
   Format: ``<host>&<state>&<device_number>``
   Example: ``global&1&3`` (turn on device 3 via global connection)

2. **Text commands** (from direct voice input):
   Format: Plain text matching entries in commands.json
   Example: ``turn on light`` (matched against device_1_on key)

Special commands:
    - ``shutdown``: Gracefully stops the server and closes the socket.

Classes:
    SS - The socket server class that handles incoming TCP connections.

Dependencies:
    socket - Python standard library for TCP networking.
"""

from PyHome.gpio_pins.gpio_pins import switch
from PyHome.command_reader.command_reader import reader


import socket
import sys

class SS:
    """TCP Socket Server for receiving and dispatching device commands.

    This server binds to all interfaces on port 1997 and listens for
    incoming TCP connections. Each received message is parsed and
    dispatched to the appropriate GPIO pin via the switch() function.

    The server supports both structured commands (host&state&device_no)
    from the PHP relay and plain text voice commands that are matched
    against the commands.json configuration.

    Attributes:
        HOST (str): The hostname to bind to (empty string = all interfaces).
        PORT (int): The TCP port number (1997).

    Example:
        >>> server = SS()
        >>> server.create()  # This blocks and runs the server loop
    """

    def __init__(self):
        """Initialize and start the TCP socket server.

        Creates a TCP socket, binds it to port 1997, and enters an
        infinite loop listening for connections. Each incoming message
        is parsed and dispatched:

        - Structured messages (host&state&device_no) are split and
          forwarded to the switch() function.
        - Plain text messages are matched against commands.json entries.
        - The special 'shutdown' command closes the server.

        Raises:
            socket.error: If the port is already in use or bind fails.
            SystemExit: On bind failure or shutdown command.
        """

        HOST = ''  # this is your localhost
        PORT = 1997

        # PORT=input('Enter Port Number:')
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        print 'socket created'
        # Bind socket to Host and Port
        try:
            s.bind((HOST, PORT))
        except socket.error as err:
            print 'Bind Failed, Error Code: ' + str(err[0]) + ', Message: ' + err[1]
            sys.exit()
        print 'Socket Bind Success!'
        # listen(): This method sets up and start TCP listener.
        s.listen(10)
        print 'Socket is now listening'

        while 1:

            conn, addr = s.accept()
            # print 'Connect with ' + addr[0] + ':' + str(addr[1])
            buf = conn.recv(5000)

            buf = str(buf).lower()
            print (buf)

            try:
                host, state, number = buf.split('&')
                state = int(state)
                state = bool(state)
                number = int(number)

                if host == 'global':
                    print "Device number :", number
                    print "Device state :", state
                    switch(state, number)

                elif host == 'local':
                    print "Device number :", number
                    print "Device state :", state
                    switch(state, number)
            except:
                    msg = str(buf)

                    # write all conditions here
                    if msg == reader("device_1_on"):
                        switch(True, 1)
                    elif msg == reader("device_1_off"):
                        switch(False, 1)
                    elif msg == reader("device_2_on"):
                        switch(True, 2)
                    elif msg == reader("device_2_off"):
                        switch(False, 2)
                    elif msg == reader("device_3_on"):
                        switch(True, 3)
                    elif msg == reader("device_3_off"):
                        switch(False, 3)
                    elif msg == reader("device_4_on"):
                        switch(True, 4)
                    elif msg == reader("device_4_off"):
                        switch(False, 4)
                    elif msg == 'shutdown':
                        s.close()
                        print ("All services are stop...")
                        break
                    else:
                        print ("Unknown Command please check your commands on serer or commands.json  file...")

        s.close()
        sys.exit()
