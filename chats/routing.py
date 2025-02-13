from django.urls import re_path

from .consumers_asynchronous import ChatConsumer, UserToUserChatConsumer

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<receiverID>\w+)/$", ChatConsumer.as_asgi()),
    
    re_path(r"ws/messaging/(?P<receiverID>\w+)/$", UserToUserChatConsumer.as_asgi()),
]