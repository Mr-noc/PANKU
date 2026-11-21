#!/usr/bin/env python3
# 盘库 APP 本地静态服务器（相机需要在 127.0.0.1 这类安全地址下才能用）
import http.server
import os
import socket
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update({
        '.webmanifest': 'application/manifest+json',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    srv = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print('盘库 APP 已启动')
    print('  手机浏览器打开： http://127.0.0.1:%d/' % PORT)
    ip = lan_ip()
    if ip:
        print('  同一 Wi-Fi 下其他设备： http://%s:%d/' % (ip, PORT))
    print('  按 Ctrl+C 停止')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()
