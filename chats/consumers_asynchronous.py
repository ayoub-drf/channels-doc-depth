import json

from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatMessage
from django.contrib.auth.models import User
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

class UserToUserChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.receiveID = self.scope['url_route']['kwargs']['receiverID']
        self.sender = self.scope['user']

        self.room_name = self.get_room_name()

        self.messaging_group = f"chat_{self.room_name}"
        self.receiverUser = await self.get_user(self.receiveID)
        await self.channel_layer.group_add(self.messaging_group, self.channel_name)

        await self.accept()

        old_messages = await self.get_messages()

        await self.send(text_data=json.dumps({
            "type": "chat.history",
            "messages": old_messages
        }))


    @database_sync_to_async
    def create_message(self, message):
        return ChatMessage.objects.create(
            sender=self.sender,
            receiver=self.receiverUser,
            message=message
        )

    @database_sync_to_async
    def get_messages(self):
        messages = ChatMessage.objects.filter(sender=self.sender, receiver=self.receiverUser) | ChatMessage.objects.filter(sender=self.receiverUser, receiver=self.sender).order_by('timestamp')
        return [{"sender": msg.sender.username, "content": msg.message, "timestamp": msg.timestamp.strftime("%H:%M")} for msg in messages]
    
    def get_room_name(self):
        ids = sorted([str(self.sender.id), str(self.receiveID)])
        return f"{ids[0]}_{ids[1]}"
    
    
    @database_sync_to_async
    def get_user(self, userID):
        return User.objects.get(pk=userID)
    

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.messaging_group, self.channel_name)

    async def receive(self, text_data):
        body = json.loads(text_data)
        content = body["message"]
        message = await self.create_message(content)

        await self.channel_layer.group_send(self.messaging_group,  
                                            {
                "type": "chat.message",
                "message": message.message,
                "sender": self.sender.username,
                "timestamp": message.timestamp.strftime("%H:%M")
            }
        )

    
    async def chat_message(self, event):
        message = {"sender": event['sender'], "message": event['message'], "timestamp": event['timestamp']}
        await self.send(text_data=json.dumps({"sender": event['sender'], "message": event['message'], "timestamp": event['timestamp']}))



class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        # self.name = await self.db_access_async()


        # Join room group
        await self.accept()

    # @database_sync_to_async
    # def db_access_async(self):
    #     with open("x.txt", "w+") as file:
    #         file.write("Hello world")

    #     user = User(username="channelss", email="channelss@aol.com")
    #     user.set_password("JKLDKML89893")
    #     user.save()



    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json["message"]


        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name, {"type": "chat.message", "message": message}
        )

    # Receive message from room group
    async def chat_message(self, event):
        message = event["message"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps({"message": message}))
 
