from django.contrib.auth.models import User, AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to="profiles/%Y/%m/%d/", default="default-avatar.png")

    REQUIRED_FIELDS = ('username', )
    USERNAME_FIELD = 'email'
    def __str__(self):
        return self.username

# Create your models here.
class Product(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.name}"
    


class ChatMessage(models.Model):
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    image = models.ImageField(upload_to="chat-messages/", null=True)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Sender: {self.sender.username}   |   Receiver: {self.receiver.username}"