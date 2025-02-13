const roomName = JSON.parse(document.getElementById("receiverID").textContent);
console.log("currentCallingUser", currentCallingUser);
console.log("currentReceivingUser", currentReceivingUser);
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
const startCallButton = document.querySelector("button#startCallButton");
let remoteStream;
let localStream;
const pc = new RTCPeerConnection(servers);
let answerButton;

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
      answerButton = document.createElement("button");
      answerButton.innerText = "answer";
      document.body.append(answerButton);
      answerButton.onclick = async () => {
        await createReceiverAnswer(data);
      };
    }
  } else if (data.type == "answer") {
    if (data.currentReceivingUser === currentCallingUser) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        await flushCandidateQueue();
      } catch (error) {
        console.error("Error setting remote description:", error);
      }
    }
  } else if (data.type == "candidate") {
    await handleCandidate(data)
  }
});


async function handleCandidate(data) {
  if (data.candidate) {
    const candidate = new RTCIceCandidate(data.candidate);

    if (pc.remoteDescription) {
      await pc.addIceCandidate(candidate);
      console.log("ICE candidate added successfully:", candidate);
    } else {
      // If remote description is not set, queue the candidate.
      console.log("Remote description not set; candidate will be queued:", candidate);
      queueCandidate(candidate);
    }
    // console.log(data.candidate)
    // console.log('data.candidate', candidate)

    // await pc.addIceCandidate(candidate);

  }
}

let candidateQueue = [];

function queueCandidate(candidate) {
  candidateQueue.push(candidate);
}

async function flushCandidateQueue() {
  for (const candidate of candidateQueue) {
    try {
      await pc.addIceCandidate(candidate);
      console.log("Queued ICE candidate added:", candidate);
    } catch (error) {
      console.error("Error adding queued candidate:", error);
    }
  }
  // Clear the queue after processing.
  candidateQueue = [];
}

async function handleMediaStreams() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // initialize an empty media stream for the remote media stream (the receiver)
  remoteStream = new MediaStream();

  // when the local media stream tracks add it to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // when the peer connection tracked add event streams to remote stream (receiver)
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // add media streams to video html elements
  localVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
}

startCallButton.onclick = async () => {
  // get local media stream from the current user
  await handleMediaStreams()

  await createCurrentUserOffer();
};

async function createCurrentUserOffer() {
  pc.onicecandidate = event => {
     if (event.candidate) {
         chatSocket.send(JSON.stringify({type: "candidate", candidate: event.candidate}))
     }
   }

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    currentCallingUser: currentCallingUser,
  };

  await sendMessage(offer);
}

async function createReceiverAnswer(offerDescription) {
  await handleMediaStreams()
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
    currentReceivingUser: currentReceivingUser,
  };

  await sendMessage(answer);

  pc.onicecandidate = event => {
    if (event.candidate) {
        chatSocket.send(JSON.stringify({type: "candidate", candidate: event.candidate}))
    }
  }
}

async function sendMessage(message) {
  chatSocket.send(JSON.stringify(message));
}

// startCallButton.onclick = async () => {
//   // pc.onicecandidate = event => {
//   //   if (event.candidate) {
//   //     sendMessage({
//   //       type: "candidate",
//   //       candidate: event.candidate
//   //     });
//   //   }
//   // };

//   const offerDescription = await pc.createOffer();
//   await pc.setLocalDescription(offerDescription);

//   const offer = {
//     sdp: offerDescription.sdp,
//     type: offerDescription.type,
//   };

//   await sendMessage(offer)

// };

// chatSocket.addEventListener("message", async (e) => {
//   console.log(" ======== WebSocket messaged! =========");
//   const data = JSON.parse(e.data);
//   //console.log(data)

//   switch (data.type) {
//     case "offer":
//       handleOffer(data);
//       break;
//     case "answer":
//       handleAnswer(data);
//       break;
//     case "candidate":
//       handleCandidate(data);
//       break;
//     default:
//       console.log("Unknown message type:", data.type);
//   }
// });

// chatSocket.addEventListener("close", async () => {
//   console.log("WebSocket connection closed!");
// });

// async function sendMessage(message) {
//   chatSocket.send(JSON.stringify(message));
// }

// async function handleOffer(data) {
//   await pc.setRemoteDescription(new RTCSessionDescription(data));

//   const answerDescription = await pc.createAnswer();
//   await pc.setLocalDescription(answerDescription);

//   const answer = {
//     type: answerDescription.type,
//     sdp: answerDescription.sdp,
//   };

//   await sendMessage(answer)

// }

// async function handleAnswer(data) {
//   console.log("handleAnswer")
//   await pc.setRemoteDescription(new RTCSessionDescription(data));
// }

// async function handleCandidate(data) {
//   if (data.candidate) {
//     try {
//       await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
//       console.log("ICE candidate added successfully.");
//     } catch (error) {
//       console.error("Error adding received ICE candidate", error);
//     }
//   }
// }
