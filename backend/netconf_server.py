import socket
import threading
from lxml import etree
from prometheus_client import Counter

NETCONF_SESSIONS = Counter('netconf_sessions_total', 'Total NETCONF sessions accepted')

class NetconfServer:

    
    def __init__(self, port=830):
        self.port = port
        self.running = False
        
    def start(self):
        """Start NETCONF SSH server"""
        self.running = True
        server_thread = threading.Thread(target=self._run_server, daemon=True)
        server_thread.start()
        print(f"NETCONF server started on port {self.port}")
        
    def _run_server(self):
        """Run the NETCONF server loop"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(('0.0.0.0', self.port))
        sock.listen(5)
        
        while self.running:
            try:
                conn, addr = sock.accept()
                threading.Thread(
                    target=self._handle_client,
                    args=(conn, addr),
                    daemon=True
                ).start()
            except Exception as e:
                print(f"NETCONF server error: {e}")
                
    def _handle_client(self, conn, addr):
        """Handle NETCONF client connection"""
        print(f"NETCONF client connected: {addr}")
        NETCONF_SESSIONS.inc()
        # Send NETCONF hello
        hello = '''<?xml version="1.0" encoding="UTF-8"?>
        <hello xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
            <capabilities>
                <capability>urn:ietf:params:netconf:base:1.0</capability>
                <capability>urn:ietf:params:netconf:base:1.1</capability>
            </capabilities>
        </hello>]]>]]>'''
        
        try:
            conn.send(hello.encode())
            conn.close()
        except Exception as e:
            print(f"Error handling NETCONF client: {e}")