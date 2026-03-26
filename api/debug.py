"""
api/debug.py — temporary debug endpoint to capture import errors
"""
import os
import sys
import traceback
import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        errors = []
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
            errors.append(f"sys.path: {sys.path[:3]}")
            errors.append(f"__file__: {__file__}")
            errors.append(f"cwd: {os.getcwd()}")
            try:
                import app.config
                errors.append("app.config: OK")
            except Exception as e:
                errors.append(f"app.config ERROR: {traceback.format_exc()}")
            try:
                from app.main import app as backend_app
                errors.append("app.main: OK")
            except Exception as e:
                errors.append(f"app.main ERROR: {traceback.format_exc()}")
        except Exception as e:
            errors.append(f"FATAL: {traceback.format_exc()}")

        body = json.dumps({"debug": errors}, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
