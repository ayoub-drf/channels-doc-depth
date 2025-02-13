from django.shortcuts import render
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import ChatMessage

User = get_user_model()


def test(request):

    return render(request, 'chat/test.html')

def user_to_user_chat(request, pk):
    print('user_to_user_chat')

    receiver = User.objects.get(pk=pk)


    messages = ChatMessage.objects.filter(sender=request.user, receiver=receiver) | ChatMessage.objects.filter(sender=receiver, receiver=request.user).order_by('timestamp')
    
    return render(request, "chat/chat.html", {'receiver': receiver, 'messages': messages})

def home(request):
    users = User.objects.exclude(username=request.user.username)

    return render(request, 'chat/index.html', {'users': users})

def room(request, receiverID):
    user = User.objects.get(pk=receiverID)

    return render(request, "chat/room.html", {"receiverID": receiverID, "user": user})

