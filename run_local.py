#!/usr/bin/env python3
"""Serve www/ for local testing (Python 3 stdlib only).

Usage: python3 run_local.py [port]    (default 8080, binds 0.0.0.0)
Open the printed LAN URL on a phone connected to the same Wi-Fi.
"""
import functools
import http.server
import os
import socket
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "www")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packets are sent for UDP connect
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8080"))
    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        sys.exit("www/index.html not found next to run_local.py")
    handler = functools.partial(Handler, directory=ROOT)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", port), handler) as httpd:
        print("OrderFlow Crypto Pro - serving %s" % ROOT)
        print("  Local:   http://localhost:%d" % port)
        print("  Network: http://%s:%d   (phone on the same Wi-Fi)" % (lan_ip(), port))
        print("Press Ctrl+C to stop.", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
