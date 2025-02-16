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
const startCallButton = document.querySelector("button#startCallButton");
const endCallButton = document.getElementById("endCallButton");

const shareScreenButton = document.getElementById("shareScreenButton");
const screenShareLocalVideo = document.getElementById("screenShareLocalVideo");
const screenShareRemoteVideo = document.getElementById("screenShareRemoteVideo");

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

  if (data.type == "video-offer") {
    if (data.currentCallingUser !== currentCallingUser) {
      answerButton = document.createElement("button");
      answerButton.innerText = "answer";
      document.body.append(answerButton);
      answerButton.onclick = async () => {
        await createVideoAnswer(data);
      };
    }
  } 
  else if (data.type == "video-answer") {
    if (data.currentCallingUser !== currentCallingUser) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushCandidateQueue();
    }
  } 
  else if (data.type == "candidate") {
    await handleCandidate(data);
  } else if (data.type == "screen-offer") {
    if (data.currentCallingUser !== currentCallingUser) {
      joinScreenButton = document.createElement("button");
        joinScreenButton.innerText = "Join the screen";
        joinScreenButton.classList.add("joinScreenButton");
        document.querySelector(".videos .screen-div").prepend(joinScreenButton);
      joinScreenButton.onclick = async () => {
        await createScreenAnswer(data);
      };

    }
  } else if (data.type == "screen-answer") {
    
    if (data.currentCallingUser !== currentCallingUser) {
      console.log("data.offer", data.offer)
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await flushCandidateQueue();
    }
  } else if (data.type == "screen-share-ended") {
    if (data.currentCallingUser !== currentCallingUser) {
      if (document.querySelector(".videos .screen-div *").classList.contains("joinScreenButton")) {
        document.querySelector(".videos .screen-div .joinScreenButton").remove();
        screenShareRemoteStream = null;
        screenShareRemoteVideo.srcObject = null;
      }
    }
  }
});

async function handleVideoMediaStreams() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });
  remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
}

async function createVideoOffer() {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      chatSocket.send(
        JSON.stringify({ type: "candidate", candidate: event.candidate })
      );
    }
  };
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const firstOffer = {
    offer: offerDescription,
    type: "video-offer",
    currentCallingUser: currentCallingUser,
  };

  await sendMessage(firstOffer);
}

async function createVideoAnswer(data) {
  toggleMicButton.disabled = false;
  toggleVideoButton.disabled = false;
  endCallButton.disabled = false;

  await handleVideoMediaStreams();
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const firstAnswer = {
    offer: answerDescription,
    type: "video-answer",
    currentCallingUser: currentCallingUser,
  };

  await sendMessage(firstAnswer);
}

startCallButton.addEventListener("click", async () => {
  toggleMicButton.disabled = false;
  toggleVideoButton.disabled = false;
  endCallButton.disabled = false;

  await handleVideoMediaStreams();

  await createVideoOffer();
});

async function sendMessage(message) {
  chatSocket.send(JSON.stringify(message));
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

async function handleCandidate(data) {
  if (data.candidate) {
    const candidate = new RTCIceCandidate(data.candidate);

    if (pc.remoteDescription) {
      await pc.addIceCandidate(candidate);
    } else {
      // If remote description is not set, queue the candidate.
      queueCandidate(candidate);
    }
  }
}

function queueCandidate(candidate) {
  candidateQueue.push(candidate);
}


shareScreenButton.addEventListener("click", async () => {
  if (!remoteStream && !localStream) {
    console.log('Start a call first')
    return;
  }

  await handleScreenMediaStreams("screen-offer");
  await createScreenOffer();

});

async function handleScreenMediaStreams(type) {
  if (type == "screen-offer") {
    screenShareLocalStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    
    screenShareLocalStream.getTracks().forEach((track) => {
      pc.addTrack(track, screenShareLocalStream);
    });
    screenShareLocalVideo.srcObject = screenShareLocalStream;

    screenShareLocalStream.getTracks().forEach((track) => {
      track.onended = async () => { 
        track.stop();
        screenShareLocalVideo.srcObject = null;
        screenShareLocalStream = null;
        await sendMessage({ type: "screen-share-ended", currentCallingUser: currentCallingUser });
      }
    });
   
    return;
  } else if (type == "screen-answer") {

    screenShareRemoteStream = new MediaStream();
  
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        screenShareRemoteStream.addTrack(track);
      });
    }
  
    screenShareRemoteVideo.srcObject = screenShareRemoteStream;

    return;
  }


};

async function createScreenOffer() {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      chatSocket.send(
        JSON.stringify({ type: "candidate", candidate: event.candidate })
      );
    }
  };
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const screenOffer = {
    offer: offerDescription,
    type: "screen-offer",
    currentCallingUser: currentCallingUser,
  };
  await sendMessage(screenOffer);
};


async function createScreenAnswer(data) {
  await handleScreenMediaStreams("screen-answer");
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const screenAnswer = {
    offer: answerDescription,
    type:  "screen-answer",
    currentCallingUser: currentCallingUser,
  };

  await sendMessage(screenAnswer);
};