"""
api/index.py — Vercel Python serverless entry point
Wraps the FastAPI backend app and strips the /api prefix
so routes like /clientes, /prestamos, etc. work correctly.
"""
import os
import sys

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Signal to main.py that we're running on Vercel (skip scheduler)
os.environ.setdefault('VERCEL', '1')

from starlette.types import ASGIApp, Receive, Scope, Send
from app.main import app as backend_app


class StripApiPrefixMiddleware:
    """Strip /api prefix before passing to FastAPI router."""

    def __init__(self, wrapped: ASGIApp) -> None:
        self.wrapped = wrapped

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            path: str = scope.get("path", "")
            if path.startswith("/api"):
                new_path = path[4:] or "/"
                scope = {**scope, "path": new_path, "raw_path": new_path.encode()}
        await self.wrapped(scope, receive, send)


# Export as `app` — Vercel detects this as the ASGI handler
app = StripApiPrefixMiddleware(backend_app)
