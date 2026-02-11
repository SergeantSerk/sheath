import { SignallingClient } from "./signalling";
import { PeerManager } from "./peer";
import { UI } from "./ui";
import "./style.css";

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const SIGNALLING_URL = `${protocol}//${window.location.host}`;

const app = document.getElementById("app")!;
const ui = new UI(app);

let signalling: SignallingClient;
let peer: PeerManager | null = null;
let isHost = false;

let statsInterval: number | null = null;
let localStream: MediaStream | null = null;
let currentVideoTrack: MediaStreamTrack | null = null;
let currentAudioTrack: MediaStreamTrack | null = null;

function isMediaSupported(): boolean {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Media devices API not available. This usually happens in insecure contexts (HTTP).");
        return false;
    }
    return true;
}

async function updateCameraList() {
    if (!isMediaSupported()) return;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        ui.setCameras(cameras);
    } catch (err) {
        console.error("Failed to list cameras", err);
    }
}

async function acquireAudio() {
    if (currentAudioTrack) return;
    if (!isMediaSupported()) {
        ui.addMessage("Audio access failed: Peer-to-peer media requires a secure context (HTTPS or localhost).", "system");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = stream.getAudioTracks()[0];
        currentAudioTrack = track;

        if (!localStream) {
            localStream = new MediaStream([track]);
        } else {
            localStream.addTrack(track);
        }

        ui.setLocalStream(localStream);
        ui.updateAudioStatus(true);

        if (peer) {
            peer.addTrack(track, localStream);
            await negotiate();
        }
    } catch (err) {
        console.error("Failed to acquire audio", err);
        ui.addMessage("Mic access denied or unavailable.", "system");
    }
}

async function acquireVideo() {
    if (currentVideoTrack) return;
    if (!isMediaSupported()) {
        ui.addMessage("Video access failed: Peer-to-peer media requires a secure context (HTTPS or localhost).", "system");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = stream.getVideoTracks()[0];
        currentVideoTrack = track;

        if (!localStream) {
            localStream = new MediaStream([track]);
        } else {
            localStream.addTrack(track);
        }

        ui.setLocalStream(localStream);
        ui.updateVideoStatus(true);

        // Populate cameras now that we have permission (labels will be present)
        await updateCameraList();

        if (peer) {
            peer.addTrack(track, localStream);
            await negotiate();
        }
    } catch (err) {
        console.error("Failed to acquire video", err);
        ui.addMessage("Camera access denied or unavailable.", "system");
    }
}

async function negotiate() {
    if (peer) {
        ui.setStatus("connecting", "Negotiating", "Updating connection...");
        const offer = await peer.createOffer();
        signalling.sendOffer(offer);
    }
}

function startStatsPolling() {
    stopStatsPolling();
    statsInterval = window.setInterval(async () => {
        if (peer && peer.connectionState === "connected") {
            const rtt = await peer.getRTT();
            ui.setLatency(rtt);
        } else {
            stopStatsPolling();
        }
    }, 2000);
}

function stopStatsPolling() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
    ui.setLatency(null);
}

function initPeer() {
    if (peer) return; // Don't re-init if exists

    peer = new PeerManager({
        onMessage: (message) => {
            ui.addMessage(message, "received");
        },
        onStateChange: (state) => {
            switch (state) {
                case "connected":
                    ui.setStatus("connected", "Connected", "Peer-to-peer · DTLS encrypted");
                    startStatsPolling();
                    break;
                case "disconnected":
                    ui.setStatus("disconnected", "Disconnected", "Peer connection lost");
                    ui.disableChat();
                    ui.addMessage("Peer disconnected.", "system");
                    stopStatsPolling();
                    break;
                case "failed":
                    ui.setStatus("failed", "Connection Failed", "Could not establish P2P link");
                    ui.disableChat();
                    ui.addMessage("Connection failed. Please refresh and try again.", "system");
                    stopStatsPolling();
                    break;
                case "connecting":
                    ui.setStatus("connecting", "Connecting", "Establishing peer connection...");
                    break;
            }
        },
        onIceStateChange: (state) => {
            if (state === "checking") {
                ui.setStatus("connecting", "Connecting", "ICE checking...");
            }
        },
        onIceCandidate: (candidate) => {
            signalling.sendIceCandidate(candidate);
        },
        onDataChannelOpen: () => {
            ui.showChat();
            ui.setStatus("connected", "Connected", "Peer-to-peer · DTLS encrypted");
            ui.addMessage("Secure connection established. Messages are end-to-end encrypted.", "system");
        },
        onDataChannelClose: () => {
            ui.setStatus("disconnected", "Disconnected", "Data channel closed");
            ui.disableChat();
        },
        onTrack: (_track, streams) => {
            ui.setRemoteStream(streams[0]);
        },
    });

    // Add local tracks to peer
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            peer?.addTrack(track, localStream!);
        });
    }
}

signalling = new SignallingClient({
    onOpen: () => {
        ui.setStatus("idle", "Ready", "Connected to signalling server");
    },
    onClose: () => {
        ui.setStatus("disconnected", "Server Disconnected", "Signalling server unreachable");
    },
    onError: (message) => {
        ui.setStatus("error", "Error", message);
    },
    onRoomCreated: (code) => {
        isHost = true;
        ui.showRoomCode(code);
        ui.setStatus("idle", "Waiting", "Share the room code with your peer");
    },
    onRoomJoined: (_code) => {
        isHost = false;
        ui.setStatus("connecting", "Joining", "Waiting for host to initiate connection...");
    },
    onPeerJoined: async () => {
        // Host creates the offer when a peer joins
        if (isHost) {
            ui.setStatus("connecting", "Connecting", "Creating offer...");
            initPeer();
            const offer = await peer!.createOffer();
            signalling.sendOffer(offer);
        }
    },
    onOffer: async (sdp) => {
        // Guest receives the offer and creates an answer
        initPeer();
        ui.setStatus("connecting", "Negotiating", "Handling incoming offer...");
        const answer = await peer!.handleOffer(sdp);
        signalling.sendAnswer(answer);
    },
    onAnswer: async (sdp) => {
        // Host receives the answer
        ui.setStatus("connected", "Connected", "Connection updated");
        await peer!.handleAnswer(sdp);
    },
    onIceCandidate: async (candidate) => {
        await peer?.addIceCandidate(candidate);
    },
    onPeerLeft: () => {
        ui.setStatus("disconnected", "Peer Left", "The other user has disconnected");
        ui.disableChat();
        ui.addMessage("Peer has left the room.", "system");
        stopStatsPolling();
        peer?.destroy();
        peer = null;
    },
});

// --- UI event handlers ---

ui.onCreateRoom = () => {
    signalling.createRoom();
};

ui.onJoinRoom = (code) => {
    signalling.joinRoom(code);
};

ui.onSendMessage = (message) => {
    peer?.sendMessage(message);
};

ui.onToggleAudio = () => {
    if (currentAudioTrack) {
        currentAudioTrack.enabled = !currentAudioTrack.enabled;
        ui.updateAudioStatus(currentAudioTrack.enabled);
    } else {
        acquireAudio();
    }
};

ui.onToggleVideo = () => {
    if (currentVideoTrack) {
        currentVideoTrack.enabled = !currentVideoTrack.enabled;
        ui.updateVideoStatus(currentVideoTrack.enabled);
    } else {
        acquireVideo();
    }
};

ui.onChangeCamera = async (deviceId) => {
    if (!isMediaSupported()) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
        });
        const newVideoTrack = stream.getVideoTracks()[0];

        if (peer) {
            await peer.replaceTrack(currentVideoTrack, newVideoTrack);
        }

        if (currentVideoTrack) {
            currentVideoTrack.stop(); // Stop old track
        }

        currentVideoTrack = newVideoTrack;

        // Update local stream in UI
        if (localStream) {
            localStream.removeTrack(localStream.getVideoTracks()[0]);
            localStream.addTrack(newVideoTrack);
            ui.setLocalStream(localStream);
        }
    } catch (err) {
        console.error("Failed to switch camera", err);
    }
};

// --- Connect ---
signalling.connect(SIGNALLING_URL);
ui.setStatus("connecting", "Connecting", "Reaching signalling server...");
