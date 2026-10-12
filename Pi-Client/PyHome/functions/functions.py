"""
Network Utility Functions
=========================

Provides helper functions for gathering network and geolocation
information about the Raspberry Pi device. Used during device
registration with the PHP web server.

Functions:
    get_mac(interface_name)       - Get MAC address of a network interface
    get_global_ip()               - Get the public/external IP address
    get_local_ip(interface_name)  - Get the local/LAN IP address
    location()                    - Get latitude/longitude via IP geolocation

Dependencies:
    netifaces - For accessing network interface information
    pif       - For determining the public IP address
    pygeoip   - For IP-to-geolocation lookups using GeoLite database
"""


def get_mac(interface_name):
	"""Get the MAC address of the specified network interface.

	Uses the netifaces library to query the link-layer address
	of the given network interface.

	Args:
		interface_name (str): The name of the network interface
			(e.g., 'wlan0', 'eth0', 'enp3s0').

	Returns:
		str: The MAC address in colon-separated hex format
			(e.g., 'aa:bb:cc:dd:ee:ff').

	Raises:
		ValueError: If the interface name doesn't exist.
		KeyError: If the interface has no link-layer address.
	"""
	import netifaces
	#print(netifaces.interfaces())
	#print(netifaces.ifaddresses('lo')[netifaces.AF_LINK])
	#print(netifaces.ifaddresses('wlp2s0b1')[netifaces.AF_LINK])
	#print(netifaces.ifaddresses('enp3s0')[netifaces.AF_LINK])
	a=netifaces.ifaddresses(interface_name)[netifaces.AF_LINK]
	#a=netifaces.ifaddresses('ppp0')[netifaces.AF_LINK]
	#pop the object from list using pop() method
	b=a.pop()
	#get attribute value from object using get() method
	c=b.get('addr')
	return (c)

def get_global_ip():
	"""Get the public/external IP address of this device.

	Uses the 'pif' library to query an external service for the
	device's public-facing IP address.

	Returns:
		str: The public IP address (e.g., '203.0.113.42').

	Note:
		Requires internet connectivity. Install with: pip install pif
	"""
	#pip install pif(public ip)
	from pif import get_public_ip
	return(get_public_ip())

def get_local_ip(interface_name):
	"""Get the local/LAN IP address of the specified network interface.

	Uses the netifaces library to query the IPv4 address assigned
	to the given network interface.

	Args:
		interface_name (str): The name of the network interface
			(e.g., 'wlan0', 'eth0').

	Returns:
		str: The local IPv4 address (e.g., '192.168.1.100').

	Raises:
		ValueError: If the interface name doesn't exist.
		KeyError: If the interface has no IPv4 address assigned.

	Note:
		Install with: pip install netifaces
	"""
	#pip install netifaces(local ip)
	import netifaces as ni
	ni.ifaddresses(interface_name)
	#ni.ifaddresses('ppp0')
	ip = ni.ifaddresses(interface_name)[ni.AF_INET][0]['addr']
	#ip = ni.ifaddresses('ppp0')[ni.AF_INET][0]['addr']
	return(ip)

def location():
	"""Get the geographical coordinates of this device via IP geolocation.

	Uses the pygeoip library with the GeoLite City database to look up
	the latitude and longitude based on the device's public IP address.

	Returns:
		tuple: A (latitude, longitude) tuple of floats.
			Example: (37.7749, -122.4194)

	Note:
		Requires the GeoLiteCity.dat file at 'geo_lite/GeoLiteCity.dat'.
		The MaxMind GeoLite Legacy databases are no longer updated;
		consider migrating to GeoIP2 for production use.
	"""
	import pygeoip
	g = pygeoip.GeoIP('geo_lite/GeoLiteCity.dat')
	ip = get_global_ip()
	latitude=g.record_by_addr(ip)['latitude']
	longitude=g.record_by_addr(ip)['longitude']
	#latitude =str(latitude).decode('utf8')
	#longitude =str(longitude).decode('utf8')
	return (latitude,longitude)