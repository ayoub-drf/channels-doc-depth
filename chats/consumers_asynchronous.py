import json
from sqlite3 import Binary

from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatMessage
# from django.contrib.auth.models import User
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile, File
from django.db.models.fields.files import ImageFieldFile
from django.utils.crypto import get_random_string
from django.utils.timezone import now
from django.utils.text import slugify


import base64
import os
User = get_user_model()

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
    def create_message(self, text, fileImgContent, fileAudioContent):
        print("create_message")
        chat_message = ChatMessage(sender=self.sender, receiver=self.receiverUser)
        
        if text:
            chat_message.message = text

        if fileAudioContent:
            chat_message.audio.save(fileAudioContent.name, fileAudioContent)

        if fileImgContent:
            chat_message.image.save(fileImgContent.name, fileImgContent)


        chat_message.save()
        return chat_message

    @database_sync_to_async
    def get_messages(self):
        messages = ChatMessage.objects.filter(sender=self.sender, receiver=self.receiverUser) | ChatMessage.objects.filter(sender=self.receiverUser, receiver=self.sender).order_by('timestamp')
        return [{"messageURL": msg.image.url if msg.image else None, "audio": msg.audio.url if msg.audio else None, "sender": msg.sender.username, "content": msg.message, "timestamp": msg.timestamp.strftime("%H:%M")} for msg in messages]
    
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

        text = body.get('text')
        fileImgContent = body.get('fileImgContent')
        fileAudioContent = body.get('fileAudioContent')
        
        if fileAudioContent:
            fileName = f'{body['fileAudioContent']['name']}_time'
            fileContent = body['fileAudioContent']['content']
            if "," in fileContent:
                fileContent = fileContent.split(",")[1]
            fileBinaryContent = base64.b64decode(fileContent)
            fileAudioName: str = f'{fileName}{now}{get_random_string(22)}.webm'
            file = ContentFile(fileBinaryContent, fileAudioName)
            fileAudioContent = file

        if fileImgContent:
            imgName = f'{body['fileImgContent']['name']}_time'
            imgContent = body['fileImgContent']['content']
            if "," in imgContent:
                imgContent = imgContent.split(",")[1]
            imgBinaryContent = base64.b64decode(imgContent)
            fileImgName: str = f'{imgName}{now}{get_random_string(22)}.png'
            file = ContentFile(imgBinaryContent, fileImgName)
            fileImgContent = file

        chat_message = await self.create_message(text, fileImgContent, fileAudioContent)



        await self.channel_layer.group_send(self.messaging_group,  
                                            {
                "type": "chat.message",
                "text": chat_message.message if chat_message.message else None,
                "messageURL": chat_message.image.url if chat_message.image else None,
                "audio": chat_message.audio.url if chat_message.audio else None,
                "sender": self.sender.username,
                "timestamp": chat_message.timestamp.strftime("%H:%M")
            }
        )

    
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"sender": event['sender'], "message": event['text'], "audio": event['audio'], "timestamp": event['timestamp'], "messageURL": event['messageURL']}))



class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.receiveID = self.scope['url_route']['kwargs']['receiverID']
        self.sender = self.scope['user']

        self.receiverUser = await self.get_user(self.receiveID)
        self.room_name = self.get_room_name()

        self.messaging_group = f"chat_{self.room_name}"
        await self.channel_layer.group_add(self.messaging_group, self.channel_name)


        await self.accept()


    @database_sync_to_async
    def get_user(self, userID):
        return User.objects.get(pk=userID)
    
    def get_room_name(self):
        ids = sorted([str(self.sender.id), str(self.receiveID)])
        return f"{ids[0]}_{ids[1]}"


    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.messaging_group, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        print(data)
        await self.channel_layer.group_send(
            self.messaging_group,
            {
                'type': 'signal_message',
                'message': data,
            }
        )

    async def signal_message(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))
