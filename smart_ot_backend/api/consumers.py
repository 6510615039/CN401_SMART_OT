"""
WebSocket consumer สำหรับการแจ้งเตือน real-time
URL: ws://localhost:8000/ws/notifications/?token=<access_token>
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    แต่ละ user เชื่อมต่อ WebSocket และเข้ากลุ่ม user_{id}
    เมื่อ backend ส่ง notification → channel_layer.group_send('user_{id}', ...) → ถึง client ทันที
    """

    async def connect(self):
        user = self.scope.get('user')

        # ปฏิเสธถ้า unauthenticated
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f'user_{user.id}'
        # เข้ากลุ่ม channel สำหรับ user นี้
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # รับข้อความจาก client (optional — ไม่ได้ใช้ตอนนี้)
    async def receive(self, text_data=None, bytes_data=None):
        pass

    # handler สำหรับ event type "notification.send" จาก channel layer
    async def notification_send(self, event):
        """ส่ง notification ไปยัง WebSocket client"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data'],
        }))
