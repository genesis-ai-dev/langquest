#!/usr/bin/env python3
"""
Android Emulator Network Control Panel

Uses adb root + tc (traffic control) + iptables for precise, kernel-level
network shaping on a rootable (Google APIs) Android emulator.

Requires: a Google APIs emulator image (not Google Play) so adb root works.
Run setup.sh first to create the AVD.

Usage: python3 tools/network-control/network_control.py
"""

import http.server
import json
import os
import subprocess
import sys
import webbrowser

HOST = "127.0.0.1"
PORT = 8199
ADB = "adb"

# The WiFi interface inside the Android emulator is always wlan0.
NET_IFACE = "wlan0"


def run_adb(*args):
    try:
        result = subprocess.run(
            [ADB, *args], capture_output=True, text=True, timeout=10
        )
        return (result.stdout + result.stderr).strip()
    except FileNotFoundError:
        return "ERROR: adb not found"
    except subprocess.TimeoutExpired:
        return "ERROR: adb timed out"


def shell(cmd):
    return run_adb("shell", cmd)


def ensure_root():
    """Elevate adb to root. Returns True if successful."""
    out = run_adb("root")
    if "cannot run as root" in out.lower():
        return False
    # adb root restarts adbd; wait for device to come back
    run_adb("wait-for-device")
    return True


def disable_cellular():
    """Bring down eth0 (cellular data) so all traffic is forced through wlan0.
    The emulator has both WiFi and cellular active, and traffic can
    bypass our tc rules if it goes through the unthrottled path."""
    shell("ip link set dev eth0 down 2>/dev/null; true")


# IFB device used to shape ingress (download) traffic
IFB_IFACE = "ifb0"


# ── tc (traffic control) helpers ─────────────────────────────────────────────

def tc_setup_ifb():
    """Set up IFB device and ingress redirect so we can shape download traffic.
    tc on a network interface only controls egress (upload). To shape ingress
    (download), we redirect incoming packets through an IFB device."""
    shell(f"ip link set dev {IFB_IFACE} up")
    shell(f"tc qdisc del dev {NET_IFACE} ingress 2>/dev/null; true")
    shell(f"tc qdisc del dev {NET_IFACE} clsact 2>/dev/null; true")
    shell(f"tc qdisc add dev {NET_IFACE} ingress")
    shell(
        f"tc filter add dev {NET_IFACE} parent ffff: protocol all "
        f"u32 match u32 0 0 action mirred egress redirect dev {IFB_IFACE}"
    )


def tc_clear():
    """Remove all qdiscs on both egress and ingress paths."""
    shell(f"tc qdisc del dev {NET_IFACE} root 2>/dev/null; true")
    shell(f"tc qdisc del dev {IFB_IFACE} root 2>/dev/null; true")


def _ensure_ifb_redirect():
    """Verify the ingress redirect is in place; re-create if missing."""
    out = shell(f"tc filter show dev {NET_IFACE} parent ffff: 2>/dev/null")
    if "mirred" not in out:
        tc_setup_ifb()


def tc_set(rate=None, delay=None, jitter=None, loss=None):
    """Apply traffic shaping to both upload and download.

    Upload (wlan0):  tbf rate limiting only — no delay here because delaying
                     outgoing ACKs destroys TCP throughput for downloads.
    Download (ifb0): netem for delay/jitter/loss -> tbf child for rate.
                     Delay on the download path is what users actually
                     experience (slow page loads, API responses).
    """
    tc_clear()
    _ensure_ifb_redirect()

    # Upload: rate limit only
    if rate:
        shell(f"tc qdisc add dev {NET_IFACE} root tbf rate {rate} burst 256kb latency 500ms")

    # Download: delay/jitter/loss + rate limit
    has_netem = delay or jitter or loss
    if has_netem and rate:
        netem_parts = [f"tc qdisc add dev {IFB_IFACE} root handle 1: netem"]
        if delay:
            netem_parts.append(f"delay {delay}")
            if jitter:
                netem_parts.append(jitter)
        if loss:
            netem_parts.append(f"loss {loss}")
        shell(" ".join(netem_parts))
        shell(f"tc qdisc add dev {IFB_IFACE} parent 1:1 handle 10: tbf rate {rate} burst 256kb latency 500ms")
    elif has_netem:
        netem_parts = [f"tc qdisc add dev {IFB_IFACE} root netem"]
        if delay:
            netem_parts.append(f"delay {delay}")
            if jitter:
                netem_parts.append(jitter)
        if loss:
            netem_parts.append(f"loss {loss}")
        shell(" ".join(netem_parts))
    elif rate:
        shell(f"tc qdisc add dev {IFB_IFACE} root tbf rate {rate} burst 256kb latency 500ms")


# ── iptables helpers ─────────────────────────────────────────────────────────

def iptables_block():
    """Block all outbound traffic except loopback, triggering Android's
    'connected, no internet' detection. Must INSERT at position 1
    to land before Android's built-in sub-chain jumps, and must
    cover both IPv4 and IPv6 (most emulator traffic is IPv6)."""
    iptables_flush()
    shell("iptables -I OUTPUT 1 ! -o lo -j REJECT --reject-with icmp-net-unreachable")
    shell("ip6tables -I OUTPUT 1 ! -o lo -j REJECT --reject-with icmp6-no-route")


def iptables_flush():
    """Remove our REJECT rules from both IPv4 and IPv6 OUTPUT chains."""
    shell("iptables -D OUTPUT -j REJECT ! -o lo --reject-with icmp-net-unreachable 2>/dev/null; true")
    shell("ip6tables -D OUTPUT -j REJECT ! -o lo --reject-with icmp6-no-route 2>/dev/null; true")


# ── WiFi / radio helpers (via adb shell, no root needed) ────────────────────

def set_wifi(on):
    shell(f"svc wifi {'enable' if on else 'disable'}")


def set_data(on):
    shell(f"svc data {'enable' if on else 'disable'}")


def set_airplane(on):
    val = "1" if on else "0"
    shell(f"settings put global airplane_mode_on {val}")
    shell(
        f"am broadcast -a android.intent.action.AIRPLANE_MODE "
        f"--ez state {'true' if on else 'false'}"
    )


# ── Presets ──────────────────────────────────────────────────────────────────

PRESETS = [
    {
        "key": "full",
        "name": "Full Internet",
        "desc": "No throttling",
        "tc": None,
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "50m",
        "name": "50 Mbps",
        "desc": "Fast broadband / 4G",
        "tc": {"rate": "50mbit"},
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "10m",
        "name": "10 Mbps",
        "desc": "Moderate broadband / good 3G",
        "tc": {"rate": "10mbit"},
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "5m",
        "name": "5 Mbps",
        "desc": "Slow broadband",
        "tc": {"rate": "5mbit"},
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "1m",
        "name": "1 Mbps",
        "desc": "Poor connection",
        "tc": {"rate": "1mbit"},
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "250k",
        "name": "250 Kbps",
        "desc": "Very poor / 2G",
        "tc": {"rate": "250kbit"},
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "50k",
        "name": "50 Kbps",
        "desc": "Barely usable",
        "tc": {"rate": "50kbit"},
        "iptables": "flush",
        "wifi": True,
        "data": True,
        "airplane": False,
    },
    {
        "key": "wifi_no_internet",
        "name": "WiFi (No Internet)",
        "desc": "WiFi connected, all traffic rejected",
        "tc": None,
        "iptables": "block",
        "wifi": True,
        "data": False,
        "airplane": False,
    },
    {
        "key": "airplane",
        "name": "Airplane Mode",
        "desc": "All radios off",
        "tc": None,
        "iptables": "flush",
        "wifi": False,
        "data": False,
        "airplane": True,
    },
]

PRESET_MAP = {p["key"]: p for p in PRESETS}


def apply_preset(key):
    preset = PRESET_MAP.get(key)
    if not preset:
        return False

    # Always clean up first
    tc_clear()
    iptables_flush()

    # Apply tc if specified
    tc_params = preset.get("tc")
    if tc_params:
        tc_set(**tc_params)

    # Apply iptables
    if preset.get("iptables") == "block":
        iptables_block()

    # Apply radio state
    if preset.get("airplane"):
        set_airplane(True)
    else:
        set_airplane(False)
        set_wifi(preset.get("wifi", True))
        set_data(preset.get("data", True))

    return True


# ── Status ───────────────────────────────────────────────────────────────────

def get_status():
    wifi = shell("settings get global wifi_on").strip()
    data = shell("settings get global mobile_data").strip()
    airplane = shell("settings get global airplane_mode_on").strip()
    tc_egress = shell(f"tc qdisc show dev {NET_IFACE} 2>/dev/null").strip()
    tc_ingress = shell(f"tc qdisc show dev {IFB_IFACE} 2>/dev/null").strip()
    tc_status = f"egress ({NET_IFACE}): {tc_egress}\ningress ({IFB_IFACE}): {tc_ingress}"
    ipt4 = shell("iptables -L OUTPUT -n 2>/dev/null").strip()
    ipt6 = shell("ip6tables -L OUTPUT -n 2>/dev/null | head -5").strip()

    return {
        "wifi": wifi == "1",
        "data": data == "1",
        "airplane": airplane == "1",
        "tc": tc_status,
        "iptables": ipt4 + "\n\nIPv6:\n" + ipt6,
    }


def get_devices():
    return run_adb("devices", "-l")


# ── HTTP Server ──────────────────────────────────────────────────────────────

HTML_PATH = os.path.join(os.path.dirname(__file__), "index.html")


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if args:
            print(f"  {args[0]}")

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            with open(HTML_PATH, "rb") as f:
                self.wfile.write(f.read())
        elif self.path == "/api/status":
            self._json(get_status())
        elif self.path == "/api/devices":
            self._json({"devices": get_devices()})
        elif self.path == "/api/presets":
            self._json([{"key": p["key"], "name": p["name"], "desc": p["desc"]} for p in PRESETS])
        else:
            self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if self.path == "/api/preset":
            key = body.get("key", "")
            if apply_preset(key):
                self._json({"ok": True, "preset": key, "status": get_status()})
            else:
                self._json({"ok": False, "error": f"Unknown preset: {key}"}, 400)

        elif self.path == "/api/toggle":
            target = body.get("target")
            on = body.get("on", True)
            if target == "wifi":
                set_wifi(on)
            elif target == "data":
                set_data(on)
            elif target == "airplane":
                set_airplane(on)
            else:
                self._json({"ok": False, "error": f"Unknown target: {target}"}, 400)
                return
            self._json({"ok": True, "status": get_status()})

        else:
            self.send_error(404)


def main():
    print("Checking for connected device...")
    devices = get_devices()
    print(f"  {devices}")

    print("Elevating to root...")
    if not ensure_root():
        print(
            "\n  ERROR: 'adb root' failed. You need a Google APIs emulator image"
            "\n  (not Google Play) for root access. Run setup.sh first:"
            "\n"
            "\n    bash tools/network-control/setup.sh"
            "\n    npm run emulator:nettest"
            "\n",
            file=sys.stderr,
        )
        sys.exit(1)

    print("  Root access confirmed.")

    print(f"  Target interface: {NET_IFACE}")

    print("  Disabling cellular (eth0) to force all traffic through WiFi...")
    disable_cellular()

    print("  Setting up IFB for download shaping...")
    tc_setup_ifb()
    print(f"  IFB redirect: {NET_IFACE} ingress -> {IFB_IFACE}")

    # Clean slate
    tc_clear()
    iptables_flush()

    server = http.server.HTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"\nNetwork Control running at {url}")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCleaning up...")
        tc_clear()
        iptables_flush()
        print("Shutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
