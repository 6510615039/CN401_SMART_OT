"""
ASGI config for smart_ot — รองรับ HTTP + WebSocket ผ่าน Django Channels
"""
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
import api.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smart_ot.settings')

# ต้อง initialize Django ASGI app ก่อน import consumers
django_asgi_app = get_asgi_application()

from api.middleware import JWTAuthMiddleware  # noqa: E402  (import after django setup)

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter(api.routing.websocket_urlpatterns)
    ),
})
