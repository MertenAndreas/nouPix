#!/usr/bin/env python3
"""
Weft LED Mapper - local server and Art-Net bridge.

Browsers cannot send UDP, so this script does the network side:
  * serves the mapper interface (index.html) on http://127.0.0.1:<port>/
  * receives pixel frames from the interface over a WebSocket
  * sends them to your controllers as Art-Net ArtDmx packets (UDP 6454)
  * runs ArtPoll discovery and reports the nodes it finds

Python 3.8+ and the standard library only. No installs needed.

    python3 weft.py                 # start and open Weft in its own browser window
    python3 weft.py --port 9000     # different web port
    python3 weft.py --bind-ip 2.0.0.10   # send Art-Net from a specific network card
    python3 weft.py --browser default    # use your normal browser instead of a Weft window
    python3 weft.py --no-browser
"""

import argparse
import base64
import hashlib
import http.server
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser

VERSION = "0.2.0"
HERE = os.path.dirname(os.path.abspath(__file__))
ARTNET_PORT = 6454
WS_GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
ARTNET_ID = b"Art-Net\x00"
OP_POLL, OP_POLL_REPLY, OP_DMX, OP_SYNC = 0x2000, 0x2100, 0x5000, 0x5200
HOLD_AFTER = 1.0   # seconds without frames from the page before the bridge starts repeating the last one
HOLD_EVERY = 0.5   # how often the held frame is repeated, so controllers don't time out


# --------------------------------------------------------------------------- Art-Net

class ArtNet:
    def __init__(self, bind_ip="0.0.0.0", bind_port=ARTNET_PORT):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # No SO_REUSEADDR: on Windows it lets two programs share UDP 6454, and then neither reliably
        # receives. Without it, a busy port is detected and Weft falls back to sending without discovery.
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        if hasattr(socket, "SIO_UDP_CONNRESET"):  # Windows: ignore ICMP port-unreachable resets
            try:
                self.sock.ioctl(socket.SIO_UDP_CONNRESET, False)
            except (OSError, ValueError):
                pass
        self.bind_error = None
        try:
            self.sock.bind((bind_ip, bind_port))
        except OSError as e:
            self.bind_error = "port %d unavailable (%s) - is another Art-Net app running?" % (bind_port, e.strerror or e)
            self.sock.bind((bind_ip, 0))
        self.bind_ip, self.bind_port = self.sock.getsockname()
        # Replies to ArtPoll arrive on 6454, so discovery only works when we own that port.
        self.discovery = self.bind_port == ARTNET_PORT
        self.seq = {}
        self.lock = threading.Lock()
        self.packets = 0
        self.frames = 0
        self.errors = 0
        self.last_error = ""
        self.nodes = {}
        self.listeners = set()
        threading.Thread(target=self._recv_loop, daemon=True).start()

    def send_dmx(self, ip, universe, data):
        key = (ip, universe)
        seq = self.seq.get(key, 0) % 255 + 1  # 1..255, 0 means "sequencing off"
        self.seq[key] = seq
        n = len(data)
        if n % 2:
            data = data + b"\x00"
            n += 1
        pkt = (ARTNET_ID + struct.pack("<H", OP_DMX) + bytes((0, 14, seq, 0, universe & 0xFF, (universe >> 8) & 0x7F))
               + struct.pack(">H", n) + data)
        try:
            self.sock.sendto(pkt, (ip, ARTNET_PORT))
            self.packets += 1
        except OSError as e:
            self.errors += 1
            self.last_error = "%s: %s" % (ip, e.strerror or e)

    def send_sync(self, ips):
        pkt = ARTNET_ID + struct.pack("<H", OP_SYNC) + bytes((0, 14, 0, 0))
        for ip in ips:
            try:
                self.sock.sendto(pkt, (ip, ARTNET_PORT))
                self.packets += 1
            except OSError as e:
                self.errors += 1
                self.last_error = "%s: %s" % (ip, e.strerror or e)

    def poll(self, address):
        pkt = ARTNET_ID + struct.pack("<H", OP_POLL) + bytes((0, 14, 0, 0))
        try:
            self.sock.sendto(pkt, (address, ARTNET_PORT))
            return None
        except OSError as e:
            return "ArtPoll to %s failed: %s" % (address, e.strerror or e)

    def _recv_loop(self):
        while True:
            try:
                data, addr = self.sock.recvfrom(2048)
            except OSError:
                time.sleep(0.05)
                continue
            if len(data) < 10 or data[:8] != ARTNET_ID:
                continue
            if struct.unpack("<H", data[8:10])[0] == OP_POLL_REPLY:
                node = parse_poll_reply(data, addr)
                if node:
                    key = "%s#%d" % (node["ip"], node["bindIndex"])
                    self.nodes[key] = node
                    for fn in list(self.listeners):
                        try:
                            fn(node)
                        except Exception:
                            pass


def parse_poll_reply(d, addr):
    if len(d) < 197:
        return None
    text = lambda b: b.split(b"\x00")[0].decode("latin-1", "replace").strip()
    net, sub = d[18] & 0x7F, d[19] & 0x0F
    nports = min(d[173], 4)
    outs = []
    for i in range(nports):
        if d[174 + i] & 0x80:  # port can output DMX
            outs.append((net << 8) | (sub << 4) | (d[190 + i] & 0x0F))
    return {
        "ip": socket.inet_ntoa(d[10:14]) if d[10:14] != b"\x00\x00\x00\x00" else addr[0],
        "from": addr[0],
        "shortName": text(d[26:44]),
        "longName": text(d[44:108]),
        "report": text(d[108:172]),
        "ports": nports,
        "outUniverses": outs,
        "mac": ":".join("%02x" % b for b in d[201:207]) if len(d) >= 207 else "",
        "bindIndex": d[211] if len(d) >= 212 else 0,
        "seen": time.time(),
    }


# --------------------------------------------------------------------------- WebSocket

def unmask(data, mask):
    n = len(data)
    m = (mask * (n // 4 + 1))[:n]
    return (int.from_bytes(data, "little") ^ int.from_bytes(m, "little")).to_bytes(n, "little")


class WebSocket:
    def __init__(self, rfile, wfile):
        self.r, self.w = rfile, wfile
        self.lock = threading.Lock()
        self.alive = True

    def _read(self, n):
        b = self.r.read(n)
        if not b or len(b) < n:
            raise ConnectionError("closed")
        return b

    def recv(self):
        op0, buf = None, b""
        while True:
            b0, b1 = self._read(2)
            fin, op, n = b0 & 0x80, b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            if n > 32 * 1024 * 1024:
                raise ConnectionError("frame too large")
            mask = self._read(4) if b1 & 0x80 else None
            data = self._read(n) if n else b""
            if mask:
                data = unmask(data, mask)
            if op == 8:
                raise ConnectionError("closed by client")
            if op == 9:
                self.send(data, 0xA)
                continue
            if op == 0xA:
                continue
            if op:
                op0, buf = op, data
            else:
                buf += data
            if fin:
                return op0, buf

    def send(self, data, op=1):
        if isinstance(data, str):
            data = data.encode("utf-8")
        n = len(data)
        if n < 126:
            hdr = bytes((0x80 | op, n))
        elif n < 65536:
            hdr = bytes((0x80 | op, 126)) + struct.pack(">H", n)
        else:
            hdr = bytes((0x80 | op, 127)) + struct.pack(">Q", n)
        with self.lock:
            if not self.alive:
                return
            try:
                self.w.write(hdr + data)
            except OSError:
                self.alive = False

    def send_json(self, obj):
        self.send(json.dumps(obj))


# --------------------------------------------------------------------------- HTTP handler

def local_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    for probe in ("8.8.8.8", "10.255.255.254", "2.255.255.254", "192.168.255.254"):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect((probe, 9))  # no packet is sent; this just asks the OS for a route
            ips.add(s.getsockname()[0])
        except OSError:
            pass
        finally:
            s.close()
    ips.discard("0.0.0.0")
    return sorted(ips, key=lambda ip: (ip.startswith("127."), ip))


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "Weft/" + VERSION
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/ws" and self.headers.get("Upgrade", "").lower() == "websocket":
            return self.websocket()
        if path == "/favicon.ico":
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path in ("/", "/index.html"):
            return self.send_file(os.path.join(HERE, "index.html"), "text/html; charset=utf-8")
        self.send_error(404)

    def send_file(self, fn, ctype):
        try:
            with open(fn, "rb") as f:
                body = f.read()
        except OSError:
            return self.send_error(404, "index.html not found next to weft.py")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin or origin == "null":
            return True
        host = urllib.parse.urlparse(origin).hostname or ""
        return host in ("localhost", "127.0.0.1", "::1") or urllib.parse.urlparse(origin).netloc == self.headers.get("Host")

    def websocket(self):
        if not self.origin_ok():
            return self.send_error(403, "Origin not allowed")
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1(key.encode() + WS_GUID).digest()).decode()
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        self.close_connection = True

        art = self.server.artnet
        ws = WebSocket(self.rfile, self.wfile)
        on_node = lambda node: ws.send_json({"t": "node", "node": node})
        art.listeners.add(on_node)
        ws.send_json({
            "t": "hello", "version": VERSION, "bindIp": art.bind_ip, "bindPort": art.bind_port,
            "discovery": art.discovery, "bindError": art.bind_error, "interfaces": local_ips(),
            "nodes": list(art.nodes.values()),
        })

        def stats():
            last_p, last_f, last_t = art.packets, art.frames, time.time()
            while ws.alive:
                time.sleep(1.0)
                now = time.time()
                dt = max(1e-3, now - last_t)
                ws.send_json({"t": "stats", "pps": round((art.packets - last_p) / dt), "fps": round((art.frames - last_f) / dt, 1),
                              "errors": art.errors, "lastError": art.last_error})
                last_p, last_f, last_t = art.packets, art.frames, now
        threading.Thread(target=stats, daemon=True).start()

        try:
            while True:
                op, payload = ws.recv()
                if op == 2:
                    self.handle_frame(art, payload)
                elif op == 1:
                    self.handle_message(art, ws, payload)
        except (ConnectionError, OSError, ValueError):
            pass
        finally:
            ws.alive = False
            art.listeners.discard(on_node)

    @staticmethod
    def handle_frame(art, p):
        # [u8 type=1][u8 flags][u16 count] then count x ([4 ip][u16 universe][u16 length][data])
        if len(p) < 4 or p[0] != 1:
            return
        flags, count = p[1], struct.unpack_from("<H", p, 2)[0]
        off, ips = 4, []
        for _ in range(count):
            if off + 8 > len(p):
                break
            ip = socket.inet_ntoa(p[off:off + 4])
            uni, n = struct.unpack_from("<HH", p, off + 4)
            off += 8
            art.send_dmx(ip, uni, p[off:off + n])
            off += n
            if ip not in ips:
                ips.append(ip)
        if flags & 1:
            art.send_sync(ips)
        art.frames += 1

    @staticmethod
    def handle_message(art, ws, payload):
        try:
            msg = json.loads(payload.decode("utf-8"))
        except ValueError:
            return
        if msg.get("t") == "poll":
            if not art.discovery:
                ws.send_json({"t": "error", "msg": "Discovery unavailable: " + (art.bind_error or "not bound to port 6454")})
                return
            err = art.poll(str(msg.get("broadcast") or "255.255.255.255"))
            if err:
                ws.send_json({"t": "error", "msg": err})


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser(description="Weft LED Mapper - local server and Art-Net bridge")
    ap.add_argument("--port", type=int, default=8080, help="web interface port (default 8080)")
    ap.add_argument("--host", default="127.0.0.1", help="web interface address (use 0.0.0.0 to reach it from other devices)")
    ap.add_argument("--bind-ip", default="0.0.0.0", help="network card to send Art-Net from (default: all)")
    ap.add_argument("--bind-port", type=int, default=ARTNET_PORT, help="local UDP port (default 6454; 0 = any, disables discovery)")
    ap.add_argument("--no-browser", action="store_true", help="don't open the browser")
    args = ap.parse_args()

    art = ArtNet(args.bind_ip, args.bind_port)
    server = None
    for port in range(args.port, args.port + 10):
        try:
            server = Server((args.host, port), Handler)
            break
        except OSError:
            continue
    if server is None:
        sys.exit("Could not open a web port between %d and %d." % (args.port, args.port + 9))
    server.artnet = art
    shown = "127.0.0.1" if args.host in ("0.0.0.0", "") else args.host
    url = "http://%s:%d/" % (shown, server.server_address[1])

    print("")
    print("  Weft LED Mapper %s" % VERSION)
    print("  Interface   %s" % url)
    print("  Art-Net     sending from %s:%d" % (art.bind_ip, art.bind_port))
    if art.bind_error:
        print("  Discovery   off - %s" % art.bind_error)
    else:
        print("  Discovery   on (listening on UDP %d)" % ARTNET_PORT)
    print("  This PC     %s" % ", ".join(local_ips()))
    print("  Press Ctrl+C to stop.")
    print("")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\n  Stopped.")


if __name__ == "__main__":
    main()
