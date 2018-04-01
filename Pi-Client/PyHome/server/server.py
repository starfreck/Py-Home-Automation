from PyHome.gpio_pins.gpio_pins import switch
from PyHome.command_reader.command_reader import reader


import socket
import sys

class SS:

    def __init__(self):

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
