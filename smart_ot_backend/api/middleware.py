"""
JWT WebSocket middleware — แปลง ?token=... query-string เป็น user ที่ authenticate แล้ว
ใช้แทน AuthMiddlewareStack เพราะ DRF SimpleJWT ใช้ JWT ไม่ใช่ Django session
"""
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_token(token: str):
    """ถอด JWT token แล้วคืน user instance (หรือ AnonymousUser)"""
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from api.models import User
        decoded = AccessToken(token)
        user_id = decoded['user_id']
        return User.objects.get(id=user_id, is_active=True)
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Middleware สำหรับ WebSocket: อ่าน ?token= แล้วตั้ง scope['user']"""

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)
