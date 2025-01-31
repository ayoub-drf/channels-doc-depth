import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import ChatMessage



class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.receiver_id = int(self.scope['url_route']['kwargs']['receiver_id'])
        self.sender = self.scope['user']
        
        if self.sender.is_anonymous:
            await self.close()
            return
            
        self.receiver = await self.get_user(self.receiver_id)
        self.room_name = self.get_room_name()
        self.room_group_name = f'chat_{self.room_name}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        
        # Send last 50 messages
        messages = await self.get_messages()
        for message in messages:
            await self.send_message_to_client(message)

    def get_room_name(self):
        ids = sorted([str(self.sender.id), str(self.receiver_id)])
        return f"{ids[0]}_{ids[1]}"

    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def get_messages(self):
        return list(ChatMessage.objects.filter(
            sender__in=[self.sender, self.receiver],
            receiver__in=[self.sender, self.receiver]
        ).order_by('-timestamp')[:50][::-1])

    @database_sync_to_async
    def create_message(self, message):
        return ChatMessage.objects.create(
            sender=self.sender,
            receiver=self.receiver,
            message=message
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data['message']
        
        # Save message to database
        db_message = await self.create_message(message)
        
        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': self.sender.id,
                'timestamp': str(db_message.timestamp)
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'sender_id': event['sender_id'],
            'timestamp': event['timestamp']
        }))

    async def send_message_to_client(self, message):
        await self.send(text_data=json.dumps({
            'message': message.message,
            'sender_id': message.sender.id,
            'timestamp': str(message.timestamp)
        }))