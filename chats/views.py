from django.shortcuts import render
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import ChatMessage

User = get_user_model()

def user_to_user_chat(request, pk):
    receiver = User.objects.get(pk=pk)


    messages = ChatMessage.objects.filter(sender=request.user, receiver=receiver) | ChatMessage.objects.filter(sender=receiver, receiver=request.user).order_by('timestamp')
    # print(messages)
    # print([{"sender": msg.sender.username, "message": msg.message, "timestamp": msg.timestamp.strftime("%H:%M")} for msg in messages])
    
    return render(request, "chat/j.html", {'receiver': receiver, 'messages': messages})

def home(request):
    users = User.objects.exclude(username=request.user.username)

    return render(request, 'chat/index.html', {'users': users})

def room(request, room_name):
    return render(request, "chat/room.html", {"room_name": room_name})

