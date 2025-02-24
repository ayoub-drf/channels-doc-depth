const roomName = JSON.parse(document.getElementById("receiverID").textContent);
// const servers = {
//     iceServers: [
//       {
//         urls: "stun:stun.l.google.com:19302"
//       },
//       {
//         urls: "turn:openrelay.metered.ca:80",
//         username: "openrelayproject",
//         credential: "openrelayproject"
//       }
//     ],
//     iceCandidatePoolSize: 10
//   };
const servers = {
    "iceServers": [{ "urls": "stun:stun2.1.google.com:19302" }]
};  
  
const startCallButton = document.querySelector(".container #startCallButton");
// const startAudioButton = document.querySelector(".container #startAudioButton");
const toggleMicButton = document.getElementById("toggleMicButton");
const toggleVideoButton = document.getElementById("toggleVideoButton");
const endCallButton = document.getElementById("endCallButton");
const shareScreenButton = document.getElementById("shareScreenButton");

let localVideoStream;
let remoteVideoStream;
let localScreenSharingStream;
let remoteScreenSharingStream;
let candidateQueue = [];
const videoStreamConstraint = {
  video: true,
  audio: false,
};
const keywordConstraint = {
  video: "video",
  screen: "screen",
  offer: "offer",
  answer: "answer",
  candidate: "candidate",
  removeJoinButton: "removeJoinButton",
};
const localVideoStreamHtml = document.querySelector(".videos #localVideoHtml");
const remoteVideoStreamHtml = document.querySelector(
  ".videos #remoteVideoHtml"
);
const screenShareLocalVideoHtml = document.getElementById(
  "screenShareLocalVideo"
);
const screenShareRemoteVideoHtml = document.getElementById(
  "screenShareRemoteVideo"
);
let pc = new RTCPeerConnection(servers);

const chatSocket = new WebSocket(
  "ws://" + window.location.host + "/ws/chat/" + roomName + "/"
);

startCallButton.onclick = async () => {
  startCallButton.disabled = true;
  toggleMicButton.disabled = false;
  toggleVideoButton.disabled = false;
  endCallButton.disabled = false;
  try {
    await handleLocalVideoStream();
    await createLocalVideoStreamOffer();
  } catch (error) {
    console.log("handleLocalVideoStream", error);
  }
};

chatSocket.addEventListener("message", async (e) => {
  const message = JSON.parse(e.data);

  if (message.mediaType === keywordConstraint.video) {
    if (message.type === keywordConstraint.offer) {
      if (message.currentCallingUser !== currentCallingUser) {
        answerButton = document.createElement("button");
        answerButton.innerText = "answer";
        document.body.append(answerButton);
        answerButton.onclick = async () => {
          await createRemoteVideoAnswer(message);
        };
      }
    } else if (message.type === keywordConstraint.answer) {
      if (message.currentCallingUser !== currentCallingUser) {
        const answer = {
          type: message.type,
          sdp: message.sdp,
        };

        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushCandidateQueue();
      }
    } else if (message.type === keywordConstraint.candidate) {
      await handleCandidate(message);
    }
  } 


  else if (message.mediaType === keywordConstraint.screen) {

    if (message.type === keywordConstraint.offer) {
      if (message.currentCallingUser !== currentCallingUser) {
        joinScreenButton = document.createElement("button");
        joinScreenButton.innerText = "Join the screen";
        joinScreenButton.classList.add("joinScreenButton");
        document.querySelector(".videos .screen-div").prepend(joinScreenButton);

        joinScreenButton.onclick = async () => {
          await createRemoteScreenSharingAnswer(message);
        };
      }
    } 

    else if (message.type === keywordConstraint.answer) {
      if (message.currentCallingUser !== currentCallingUser) {
        const answer = {
          type: message.type,
          sdp: message.sdp,
        };

        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        //   await flushCandidateQueue();
      }
    } 

    else if (message.type === keywordConstraint.candidate) {
      console.log("candidate from the screen");
      // await handleCandidate(message);
    }
  } 

  else if (message.mediaType === keywordConstraint.removeJoinButton) {
    if (message.currentCallingUser !== currentCallingUser) {
      if (document.querySelector(".joinScreenButton")) {
        document.querySelector(".joinScreenButton").remove();
      }
    }
  }

  else if (message.mediaType === "stopeRemoteScreenSharingStream") {
    if (message.currentCallingUser !== currentCallingUser) {
        if (remoteScreenSharingStream) {
            remoteScreenSharingStream.getTracks().forEach(track => {
                track.stop();
            });
        }

        screenShareRemoteVideoHtml.srcObject = null;

    }
  }
});

async function handleLocalVideoStream() {
  localVideoStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  remoteVideoStream = new MediaStream();

  localVideoStream.getTracks().forEach((track) => {
    pc.addTrack(track, localVideoStream);
  });

  localVideoStreamHtml.srcObject = localVideoStream;
  remoteVideoStreamHtml.srcObject = remoteVideoStream;

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteVideoStream.addTrack(track);
    });
  };
}

async function createLocalVideoStreamOffer() {
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    currentCallingUser: currentCallingUser,
    mediaType: "video",
  };

  sendMessage(offer);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({
        type: "candidate",
        candidate: event.candidate,
        mediaType: "video",
      });
    }
  };
}

async function createRemoteVideoAnswer(message) {
  await handleLocalVideoStream();
  const offer = {
    type: message.type,
    sdp: message.sdp,
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
    currentCallingUser: currentCallingUser,
    mediaType: "video",
  };

  sendMessage(answer);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({
        type: "candidate",
        candidate: event.candidate,
        mediaType: "video",
      });
    }
  };
}

async function handleCandidate(message) {
  if (message.candidate) {
    const candidate = new RTCIceCandidate(message.candidate);
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
  candidateQueue = [];
}

function sendMessage(message) {
  chatSocket.send(JSON.stringify(message));
}

toggleMicButton.addEventListener("click", () => {
  if (localVideoStream) {
    const audioTrack = localVideoStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleMicButton.innerText = audioTrack.enabled
        ? "Mute Mic"
        : "Unmute Mic";
    }
  }
});

toggleVideoButton.addEventListener("click", () => {
  if (localVideoStream) {
    const videoTrack = localVideoStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleVideoButton.innerText = videoTrack.enabled
        ? "Stop Video"
        : "Start Video";
    }
  }
});

shareScreenButton.onclick = async () => {
  try {
    await handleLocalScreenSharingStream();
    await createLocalScreenSharingStreamOffer();
  } catch (error) {
    console.log("handleLocalScreenSharingStream", error);
  }
};

async function handleLocalScreenSharingStream() {
  localScreenSharingStream = await navigator.mediaDevices.getDisplayMedia(
    videoStreamConstraint
  );
  remoteScreenSharingStream = new MediaStream();

  localScreenSharingStream.getTracks().forEach((track) => {
    pc.addTrack(track, localScreenSharingStream);
    track.addEventListener("ended", () => {
      stopeLocalScreenSharingStream();
    });
  });

  screenShareLocalVideoHtml.srcObject = localScreenSharingStream;
//   screenShareRemoteVideoHtml.srcObject = remoteScreenSharingStream;

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteScreenSharingStream.addTrack(track);
    });
  };
}

async function createLocalScreenSharingStreamOffer() {
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    currentCallingUser: currentCallingUser,
    mediaType: "screen",
  };

  sendMessage(offer);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendMessage({
        type: "candidate",
        candidate: event.candidate,
        mediaType: "screen",
      });
    }
  };
}

function stopeLocalScreenSharingStream() {
  if (localScreenSharingStream) {
    localScreenSharingStream.getTracks().forEach((track) => {
      track.stop();
      pc.getSenders().forEach((sender) => {
        if (sender.track === track) {
          pc.removeTrack(sender);
        }
      });
    });
    screenShareLocalVideoHtml.srcObject = null;

    sendMessage({
      mediaType: "removeJoinButton",
      currentCallingUser: currentCallingUser,
    });
  }

  if (remoteScreenSharingStream) {
    sendMessage({
        mediaType: "stopeRemoteScreenSharingStream",
        currentCallingUser: currentCallingUser,
      });
  }
}

async function createRemoteScreenSharingAnswer(message) {
  remoteScreenSharingStream = new MediaStream();

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteScreenSharingStream.addTrack(track);
    });
  };

  screenShareRemoteVideoHtml.srcObject = remoteScreenSharingStream;
  const offer = {
    type: message.type,
    sdp: message.sdp,
  };

  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
    currentCallingUser: currentCallingUser,
    mediaType: "screen",
  };

  sendMessage(answer);
}
