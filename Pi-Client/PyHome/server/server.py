from PyHome.gpio_pins.gpio_pins import switch


class SS:
    def __init__(self):
        import socket
        import sys
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
            print("Command :"+buf)

            # write all conditions here
            if buf == 'turn on light':
                switch(True, 1)
            elif buf == 'turn off light':
                switch(False, 1)
            if buf == 'turn on fan':
                switch(True, 2)
            elif buf == 'turn off fan':
                switch(False, 2)
            if buf == 'turn on ac':
                switch(True, 3)
            elif buf == 'turn off ac':
                switch(False, 3)
            if buf == 'turn on bedroom light':
                switch(True, 4)
            elif buf == 'turn off bedroom light':
                switch(False, 4)
            if buf == 'shutdown':
                break

        s.close()
        sys.exit()



