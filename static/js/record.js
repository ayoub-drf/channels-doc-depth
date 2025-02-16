const roomName = JSON.parse(document.getElementById("receiverID").textContent);
const servers = {
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:a.relay.metered.ca:80",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
        "stun:stun.freevoipdeal.com:3478",
        "stun:bn-turn1.xirsys.com",
      ],
    },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      url: "turn:numb.viagenie.ca",
      credential: "muazkh",
      username: "webrtc@live.com",
    },
    {
      url: "turn:turn.bistri.com:80",
      credential: "homeo",
      username: "homeo",
    },
    {
      url: "turn:turn.anyfirewall.com:443?transport=tcp",
      credential: "webrtc",
      username: "webrtc",
    },
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "69af939fef256835a4f3b00e",
      credential: "lbUFDSyF6j3MVZLd",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "69af939fef256835a4f3b00e",
      credential: "lbUFDSyF6j3MVZLd",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "69af939fef256835a4f3b00e",
      credential: "lbUFDSyF6j3MVZLd",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "69af939fef256835a4f3b00e",
      credential: "lbUFDSyF6j3MVZLd",
    },
    {
      username:
        "UEK79BUzSp4OBBEUMDCHPTGOTKJbUueRyfOjjzNVot4LG9RZpoBOZqdaAzCMek32AAAAAGRpDz92ZW5rYXQxMjM=",
      credential: "e4a7926a-f73a-11ed-9f71-0242ac140004",
      urls: [
        "turn:bn-turn1.xirsys.com:80?transport=udp",
        "turn:bn-turn1.xirsys.com:3478?transport=udp",
        "turn:bn-turn1.xirsys.com:80?transport=tcp",
        "turn:bn-turn1.xirsys.com:3478?transport=tcp",
        "turns:bn-turn1.xirsys.com:443?transport=tcp",
        "turns:bn-turn1.xirsys.com:5349?transport=tcp",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const toggleMicButton = document.getElementById("toggleMicButton");
const toggleVideoButton = document.getElementById("toggleVideoButton");
const endCallButton = document.getElementById("endCallButton");
const shareScreenButton = document.getElementById("shareScreenButton");

const screenShareLocalVideo = document.getElementById("screenShareLocalVideo");
const screenShareRemoteVideo = document.getElementById(
  "screenShareRemoteVideo"
);

const startCallButton = document.querySelector("button#startCallButton");
let remoteStream;
let localStream;
let joinScreenButton;
let answerButton;
let screenShareRemoteStream;
let screenShareLocalStream;
let candidateQueue = [];

let pc = new RTCPeerConnection(servers);

const chatSocket = new WebSocket(
  "ws://" + window.location.host + "/ws/chat/" + roomName + "/"
);

chatSocket.addEventListener("open", async () => {
  console.log("WebSocket connection established!");
});

chatSocket.addEventListener("message", async (e) => {
  const data = JSON.parse(e.data);

  if (data.type == "offer") {
    if (currentCallingUser !== data.currentCallingUser) {
      if (data.mediaType === "screen") {
        joinScreenButton = document.createElement("button");
        joinScreenButton.innerText = "Join the screen";
        joinScreenButton.classList.add("joinScreenButton");

        document.querySelector(".videos .screen-div").prepend(joinScreenButton);
        joinScreenButton.onclick = async () => {
          console.log('joinScreenButton.onclick')
          await createReceiverAnswer(data, "screen");
        };
      } else {
        answerButton = document.createElement("button");
        answerButton.innerText = "answer";
        document.body.append(answerButton);
        answerButton.onclick = async () => {
          await createReceiverAnswer(data);
        };
      }
    }
  } else if (data.type == "answer") {
    console.log("hello", data, currentCallingUser)
    if (data.currentReceivingUser == currentCallingUser) {
      console.log("me the answer", data);
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      await flushCandidateQueue();
      console.log('done', data.sdp)
      // try {
      //   await pc.setRemoteDescription(new RTCSessionDescription(data));
      //   await flushCandidateQueue();
      // } catch (error) {
      //   console.error("Error setting remote description:", error);
      // }
    }
  } else if (data.type == "candidate") {
    await handleCandidate(data);
    console.log('candidate', data)
  } else if (data.type == "endCall") {
    endCall();
  } else if (data.type === "removeJoinButton") {
    if (data.currentCallingUser !== currentCallingUser) {
      if (screenShareRemoteStream) {
        console.log('Stooped .........')
        // let tracks = screenShareRemoteStream.getTracks();
        // for (let i = 0; i < tracks.length; i++) {
        //   // tracks[i].stop();
        //   console.log(tracks[i])
          
        // }
        // screenShareRemoteVideo.srcObject = null;

      }

      if (
        document
          .querySelector(".videos .screen-div .joinScreenButton")
          .classList.contains("joinScreenButton")
      ) {
        document
          .querySelector(".videos .screen-div .joinScreenButton")
          .remove();
      }
    }
  }
});

async function handleCandidate(data) {
  if (data.candidate) {
    const candidate = new RTCIceCandidate(data.candidate);
    queueCandidate(candidate);

    // if (pc.remoteDescription) {
    //   await pc.addIceCandidate(candidate);
    // } else {
    //   // If remote description is not set, queue the candidate.
    // }
  }
}

function queueCandidate(candidate) {
  candidateQueue.push(candidate);
}

async function flushCandidateQueue() {
  for (const candidate of candidateQueue) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (error) {
      console.error("Error adding queued candidate:", error);
    }
  }
  // Clear the queue after processing.
  candidateQueue = [];
}

async function stopLocalScreenSharing(
  screenShareLocalVideo,
  screenShareLocalStream,
) {
  const offer = {
    type: "removeJoinButton",
    currentCallingUser: currentCallingUser,
  };

  await sendMessage(offer);
  let tracks = screenShareLocalStream.getTracks();
  for (let i = 0; i < tracks.length; i++) {
    tracks[i].stop();
  }
  screenShareLocalVideo.srcObject = null;
}

async function stopRemoteScreenSharing(screenShareRemoteVideo, screenShareRemoteStream) {
  console.log('stopRemoteScreenSharing')
}

async function handleMediaStreams(mediaStreamType, user) {
  if (mediaStreamType === "screen") {
    if (currentCallingUser !== user) {
      screenShareLocalStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenShareLocalStream.getTracks().forEach((track) => {
        pc.addTrack(track, screenShareLocalStream);
      });

      screenShareLocalVideo.srcObject = screenShareLocalStream;

      const screenShareLocalTrack = screenShareLocalStream.getVideoTracks()[0];
      screenShareLocalTrack.onended = async () => {
        await stopLocalScreenSharing(
          screenShareLocalVideo,
          screenShareLocalStream,
        );
      };
    } else {
      screenShareRemoteStream = new MediaStream();
      screenShareRemoteVideo.srcObject = screenShareRemoteStream;

      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            screenShareRemoteStream.addTrack(track);
            remoteStream.addTrack(track);
        });
      };

      return
      
    }
  } else {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    // initialize an empty media stream for the remote media stream (the receiver)
    remoteStream = new MediaStream();

    // when the local media stream tracks add it to peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // add media streams to video html elements
    localVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    // when the peer connection tracked add event streams to remote stream (receiver)
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
      });
    };
    return;
  }


}

startCallButton.onclick = async () => {
  toggleMicButton.disabled = false;
  toggleVideoButton.disabled = false;
  endCallButton.disabled = false;
  // get local media stream from the current user
  await handleMediaStreams();

  await createCurrentUserOffer();
};

function endCall() {
  console.log("end call");
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  window.location.reload();
}
shareScreenButton.addEventListener("click", async () => {
  // shareScreenButton.disabled = true;
  await handleMediaStreams("screen");
  await createCurrentUserOffer("screen");
});

endCallButton.addEventListener("click", () => {
  // endCall()
  sendMessage({ type: "endCall", reload: true });
  window.location.reload();
});

toggleMicButton.addEventListener("click", () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleMicButton.innerText = audioTrack.enabled
        ? "Mute Mic"
        : "Unmute Mic";
    }
  }
});

toggleVideoButton.addEventListener("click", () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleVideoButton.innerText = videoTrack.enabled
        ? "Stop Video"
        : "Start Video";
    }
  }
});

async function createCurrentUserOffer(mediaType) {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      chatSocket.send(
        JSON.stringify({ type: "candidate", candidate: event.candidate })
      );
    }
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    mediaType: mediaType,
    currentCallingUser: currentCallingUser,
  };

  await sendMessage(offer);
}

async function createReceiverAnswer(offerDescription, MediaType) {
  toggleMicButton.disabled = false;
  toggleVideoButton.disabled = false;
  endCallButton.disabled = false;
  await handleMediaStreams(MediaType, currentCallingUser);

  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
    MediaType: MediaType,
    currentReceivingUser: currentReceivingUser,
  };


  await sendMessage(answer);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      chatSocket.send(
        JSON.stringify({ type: "candidate", candidate: event.candidate })
      );
    }
  };
}

async function sendMessage(message) {
  chatSocket.send(JSON.stringify(message));
}
