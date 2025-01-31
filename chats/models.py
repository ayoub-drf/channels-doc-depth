from django.contrib.auth.models import User
from django.db import models

# Create your models here.
class Product(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.name}"
    


class ChatMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Sender: {self.sender.username}   |   Receiver: {self.receiver.username}"