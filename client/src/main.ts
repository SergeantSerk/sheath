import { SignalingClient } from "./signaling";
import { PeerManager } from "./peer";
import { UI } from "./ui";
import "./style.css";

const SIGNALING_URL = `ws://${window.location.hostname}:3001`;

const app = document.getElementById("app")!;
const ui = new UI(app);

let signaling: SignalingClient;
let peer: PeerManager | null = null;
let isHost = false;

function initPeer() {
    peer = new PeerManager({
        onMessage: (message) => {
            ui.addMessage(message, "received");
        },
        onStateChange: (state) => {
            switch (state) {
                case "connected":
                    ui.setStatus("connected", "Connected", "Peer-to-peer · DTLS encrypted");
                    break;
                case "disconnected":
                    ui.setStatus("disconnected", "Disconnected", "Peer connection lost");
                    ui.disableChat();
                    ui.addMessage("Peer disconnected.", "system");
                    break;
                case "failed":
                    ui.setStatus("failed", "Connection Failed", "Could not establish P2P link");
                    ui.disableChat();
                    ui.addMessage("Connection failed. Please refresh and try again.", "system");
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
            signaling.sendIceCandidate(candidate);
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
    });
}

signaling = new SignalingClient({
    onOpen: () => {
        ui.setStatus("idle", "Ready", "Connected to signaling server");
    },
    onClose: () => {
        ui.setStatus("disconnected", "Server Disconnected", "Signaling server unreachable");
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
            signaling.sendOffer(offer);
        }
    },
    onOffer: async (sdp) => {
        // Guest receives the offer and creates an answer
        initPeer();
        ui.setStatus("connecting", "Connecting", "Creating answer...");
        const answer = await peer!.handleOffer(sdp);
        signaling.sendAnswer(answer);
    },
    onAnswer: async (sdp) => {
        // Host receives the answer
        ui.setStatus("connecting", "Connecting", "Finalizing connection...");
        await peer!.handleAnswer(sdp);
    },
    onIceCandidate: async (candidate) => {
        await peer?.addIceCandidate(candidate);
    },
    onPeerLeft: () => {
        ui.setStatus("disconnected", "Peer Left", "The other user has disconnected");
        ui.disableChat();
        ui.addMessage("Peer has left the room.", "system");
        peer?.destroy();
        peer = null;
    },
});

// --- UI event handlers ---

ui.onCreateRoom = () => {
    signaling.createRoom();
};

ui.onJoinRoom = (code) => {
    signaling.joinRoom(code);
};

ui.onSendMessage = (message) => {
    peer?.sendMessage(message);
};

// --- Connect ---
signaling.connect(SIGNALING_URL);
ui.setStatus("connecting", "Connecting", "Reaching signaling server...");
