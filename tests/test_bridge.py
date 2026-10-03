import socket, struct, base64, os, json, time, subprocess, sys, threading
sys.path.insert(0, os.path.dirname(__file__))
from harness import FakeNode, start_bridge
node = FakeNode()
p = start_bridge(8097)

class WS:
    def __init__(s, port):
        s.s = socket.create_connection(("127.0.0.1", port))
        s.s.sendall(("GET /ws HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (port, base64.b64encode(os.urandom(16)).decode())).encode())
        s.buf = b""; s.msgs = []
        hdr = b""
        while b"\r\n\r\n" not in hdr: hdr += s.s.recv(1)
        threading.Thread(target=s.reader, daemon=True).start()
    def reader(s):
        f = s.s.makefile("rb")
        while True:
            try:
                b0, b1 = f.read(2); n = b1 & 0x7f
                if n == 126: n = struct.unpack(">H", f.read(2))[0]
                elif n == 127: n = struct.unpack(">Q", f.read(8))[0]
                d = f.read(n)
                if b0 & 0x0f == 1: s.msgs.append(json.loads(d))
            except Exception: return
    def send(s, payload, op=2):
        if isinstance(payload, dict): payload, op = json.dumps(payload).encode(), 1
        mask = os.urandom(4); n = len(payload)
        hdr = bytes((0x80 | op,)) + (bytes((0x80 | n,)) if n < 126 else bytes((0x80 | 126,)) + struct.pack(">H", n))
        s.s.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
    def close(s): s.s.shutdown(socket.SHUT_RDWR); s.s.close()

def frame(val, uni=1):
    return struct.pack("<BBH", 1, 0, 1) + socket.inet_aton("127.0.0.1") + struct.pack("<HH", uni, 512) + bytes([val]) * 512

try:
  a, b = WS(8097), WS(8097)
  time.sleep(0.3)
  print("hello discovery:", a.msgs[0]["discovery"], "|", a.msgs[0]["discoveryNote"])
  t0 = time.time(); a.send(frame(10)); time.sleep(0.2)
  print("frame without output-on sent:", node.count(t0, time.time()))
  a.send({"t": "output", "on": True}); time.sleep(0.05)
  t0 = time.time(); a.send(frame(20)); time.sleep(0.2)
  print("owner frame sent:", node.count(t0, time.time()), "value", node.last(1)[0])
  b.send({"t": "output", "on": True}); time.sleep(0.2)
  print("A got takeover:", any(m.get("t") == "takeover" for m in a.msgs))
  t0 = time.time(); a.send(frame(30)); time.sleep(0.2)
  print("old owner frame dropped:", node.count(t0, time.time()) == 0)
  b.send(frame(40)); time.sleep(0.1)
  t0 = time.time(); time.sleep(3.0)
  n = node.count(t0, time.time())
  print("held frames in 3 s after stall:", n, "value", node.last(1)[0])
  b.send(frame(50)); time.sleep(0.2)
  b.send({"t": "output", "on": False}); time.sleep(0.1)
  t0 = time.time(); time.sleep(2.0)
  print("after output off, frames:", node.count(t0, time.time()))
  b.send({"t": "output", "on": True}); b.send(frame(60)); time.sleep(0.2); b.close(); time.sleep(0.3)
  t0 = time.time(); time.sleep(2.0)
  print("after owner disconnect, frames:", node.count(t0, time.time()))
finally:
  p.terminate(); print(p.communicate()[0])
