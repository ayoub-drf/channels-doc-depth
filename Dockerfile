FROM redis

EXPOSE 6379

# docker run --rm --name redis-container -d -p 6379:6379 redis
# Jitsi Meet, lib-jitsi-meet, WebRTC

CMD ["redis-server"]