from django.urls import path
from .views import *

urlpatterns = [
    path('v1/', video_p2p, name='video_v1'),
]
