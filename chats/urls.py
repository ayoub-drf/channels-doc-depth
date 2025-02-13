from .views import *
from django.urls import path

urlpatterns = [
    path('', home, name="home"),
    path('test/', test, name="test"),
    path("chat/<str:receiverID>/", room, name="room"),
    path("messaging/<str:pk>/", user_to_user_chat, name="user_to_user_chat"),
]
