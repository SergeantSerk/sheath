import { SignallingClient } from "./signalling/signalling-client";
import { PeerManager } from "./peer/peer-manager";
import { UIManager } from "./ui/ui-manager";
import { MediaManager } from "./media/media-manager";
import { STATUS_COLORS } from "./config/constants";

/**
 * Main application orchestrator.
 * Coordinates between:
 * - UI (user interactions and rendering)
 * - Signalling (WebSocket server communication)
 * - PeerManager (WebRTC connection management)
 * - MediaManager (camera/mic access and device enumeration)
 */
export class App {
  private ui: UIManager;
  private signalling!: SignallingClient;
  private peer: PeerManager | null = null;
  private mediaManager: MediaManager;
  
  private isHost = false;
  private statsInterval: number | null = null;
  private localStream: MediaStream | null = null;
  private currentVideoTrack: MediaStreamTrack | null = null;
  private currentAudioTrack: MediaStreamTrack | null = null;

  constructor() {
    const app = document.getElementById("app")!;
    this.ui = new UIManager(app);
    this.mediaManager = new MediaManager();
    this.setupCallbacks();
    this.setupEventHandlers();
    this.connectToSignalling();
  }

  private setupCallbacks() {
    this.signalling = new SignallingClient({
      onOpen: () => {
        this.ui.setStatus("idle", "Ready", "Connected to signalling server");
      },
      onClose: () => {
        this.ui.setStatus("disconnected", "Server Disconnected", "Signalling server unreachable");
      },
      onError: (message) => {
        this.ui.setStatus("error", "Error", message);
      },
      onRoomCreated: (code) => {
        this.isHost = true;
        this.ui.showRoomCode(code);
        this.ui.setStatus("idle", "Waiting", "Share the room code with your peer");
      },
      onRoomJoined: (_code) => {
        this.isHost = false;
        this.ui.setStatus("connecting", "Joining", "Waiting for host to initiate connection...");
      },
      onPeerJoined: async () => {
        if (this.isHost) {
          this.ui.setStatus("connecting", "Connecting", "Creating offer...");
          this.initPeer();
          const offer = await this.peer!.createOffer();
          this.signalling.sendOffer(offer);
        }
        this.ui.notifyPeerJoined();
      },
      onOffer: async (sdp) => {
        this.initPeer();
        this.ui.setStatus("connecting", "Negotiating", "Handling incoming offer...");
        const answer = await this.peer!.handleOffer(sdp);
        this.signalling.sendAnswer(answer);

        if (this.peer?.connectionState === "connected") {
          this.ui.setStatus("connected", "Connected", "Connection updated");
        }
      },
      onAnswer: async (sdp) => {
        this.ui.setStatus("connected", "Connected", "Connection updated");
        await this.peer!.handleAnswer(sdp);
      },
      onIceCandidate: async (candidate) => {
        await this.peer?.addIceCandidate(candidate);
      },
      onPeerLeft: () => {
        this.ui.setStatus("disconnected", "Peer Left", "The other user has disconnected");
        this.ui.disableChat();
        this.ui.addMessage("Peer has left the room.", "system");
        this.stopStatsPolling();
        this.peer?.destroy();
        this.peer = null;
        this.ui.notifyPeerLeft();
      },
    });
  }

  private setupEventHandlers() {
    this.ui.onCreateRoom = () => {
      this.signalling.createRoom();
    };

    this.ui.onJoinRoom = (code) => {
      this.signalling.joinRoom(code);
    };

    this.ui.onSendMessage = (message) => {
      this.peer?.sendMessage(message);
    };

    this.ui.onSendImage = (image) => {
      this.peer?.sendMessage(image);
    };

    this.ui.onToggleAudio = () => {
      if (this.currentAudioTrack) {
        this.currentAudioTrack.enabled = !this.currentAudioTrack.enabled;
        this.ui.updateAudioStatus(this.currentAudioTrack.enabled);
      } else {
        this.acquireAudio();
      }
    };

    this.ui.onToggleVideo = () => {
      if (this.currentVideoTrack) {
        this.currentVideoTrack.enabled = !this.currentVideoTrack.enabled;
        this.ui.updateVideoStatus(this.currentVideoTrack.enabled);
      } else {
        this.acquireVideo();
      }
    };

    this.ui.onChangeCamera = async (deviceId) => {
      try {
        const stream = await this.mediaManager.acquireVideo(deviceId);
        const newVideoTrack = stream.getVideoTracks()[0];

        if (this.peer) {
          await this.peer.replaceTrack(this.currentVideoTrack, newVideoTrack);
        }

        if (this.currentVideoTrack) {
          this.currentVideoTrack.stop();
        }

        this.currentVideoTrack = newVideoTrack;

        if (this.localStream) {
          this.localStream.removeTrack(this.localStream.getVideoTracks()[0]);
          this.localStream.addTrack(newVideoTrack);
          this.ui.setLocalStream(this.localStream);
        }
      } catch (err) {
        console.error("Failed to switch camera", err);
      }
    };

    this.ui.onChangeMicrophone = async (deviceId) => {
      try {
        const stream = await this.mediaManager.acquireAudio(deviceId);
        const newAudioTrack = stream.getAudioTracks()[0];

        if (this.peer) {
          await this.peer.replaceTrack(this.currentAudioTrack, newAudioTrack);
        }

        if (this.currentAudioTrack) {
          this.currentAudioTrack.stop();
        }

        this.currentAudioTrack = newAudioTrack;

        if (this.localStream) {
          this.localStream.removeTrack(this.localStream.getAudioTracks()[0]);
          this.localStream.addTrack(newAudioTrack);
          this.ui.setLocalStream(this.localStream);
        }
      } catch (err) {
        console.error("Failed to switch microphone", err);
      }
    };
  }

  private connectToSignalling() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const SIGNALLING_URL = `${protocol}//${window.location.host}`;
    this.signalling.connect(SIGNALLING_URL);
    this.ui.setStatus("connecting", "Connecting", "Reaching signalling server...");
  }

  private async acquireAudio() {
    if (this.currentAudioTrack) return;
    if (!this.mediaManager.isMediaSupported()) {
      this.ui.addMessage("Audio access failed: Peer-to-peer media requires a secure context (HTTPS or localhost).", "system");
      return;
    }

    try {
      const stream = await this.mediaManager.acquireAudio();
      const track = stream.getAudioTracks()[0];
      this.currentAudioTrack = track;

      if (!this.localStream) {
        this.localStream = new MediaStream([track]);
      } else {
        this.localStream.addTrack(track);
      }

      this.ui.setLocalStream(this.localStream);
      this.ui.updateAudioStatus(true);

      await this.updateMicrophoneList();

      if (this.peer) {
        this.peer.addTrack(track, this.localStream);
        await this.negotiate();
      }
    } catch (err) {
      console.error("Failed to acquire audio", err);
      this.ui.addMessage("Mic access denied or unavailable.", "system");
    }
  }

  private async acquireVideo() {
    if (this.currentVideoTrack) return;
    if (!this.mediaManager.isMediaSupported()) {
      this.ui.addMessage("Video access failed: Peer-to-peer media requires a secure context (HTTPS or localhost).", "system");
      return;
    }

    try {
      const stream = await this.mediaManager.acquireVideo();
      const track = stream.getVideoTracks()[0];
      this.currentVideoTrack = track;

      if (!this.localStream) {
        this.localStream = new MediaStream([track]);
      } else {
        this.localStream.addTrack(track);
      }

      this.ui.setLocalStream(this.localStream);
      this.ui.updateVideoStatus(true);

      await this.updateCameraList();

      if (this.peer) {
        this.peer.addTrack(track, this.localStream);
        await this.negotiate();
      }
    } catch (err) {
      console.error("Failed to acquire video", err);
      this.ui.addMessage("Camera access denied or unavailable.", "system");
    }
  }

  private async updateCameraList() {
    try {
      const cameras = await this.mediaManager.getCameras();
      this.ui.setCameras(cameras);
    } catch (err) {
      console.error("Failed to list cameras", err);
    }
  }

  private async updateMicrophoneList() {
    try {
      const microphones = await this.mediaManager.getMicrophones();
      this.ui.setMicrophones(microphones);
    } catch (err) {
      console.error("Failed to list microphones", err);
    }
  }

  private async negotiate() {
    if (this.peer) {
      this.ui.setStatus("connecting", "Negotiating", "Updating connection...");
      const offer = await this.peer.createOffer();
      this.signalling.sendOffer(offer);
    }
  }

  private startStatsPolling() {
    this.stopStatsPolling();
    this.statsInterval = window.setInterval(async () => {
      if (this.peer && this.peer.connectionState === "connected") {
        const rtt = await this.peer.getRTT();
        this.ui.setLatency(rtt);
      } else {
        this.stopStatsPolling();
      }
    }, 2000);
  }

  private stopStatsPolling() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.ui.setLatency(null);
  }

  private initPeer() {
    if (this.peer) return;

    this.peer = new PeerManager({
      onMessage: (message) => {
        this.ui.addMessage(message, "received");
      },
      onStateChange: (state) => {
        switch (state) {
          case "connected":
            this.ui.setStatus("connected", "Connected", "Peer-to-peer · DTLS encrypted");
            this.startStatsPolling();
            break;
          case "disconnected":
            this.ui.setStatus("disconnected", "Disconnected", "Peer connection lost");
            this.ui.disableChat();
            this.ui.addMessage("Peer disconnected.", "system");
            this.stopStatsPolling();
            break;
          case "failed":
            this.ui.setStatus("failed", "Connection Failed", "Could not establish P2P link");
            this.ui.disableChat();
            this.ui.addMessage("Connection failed. Please refresh and try again.", "system");
            this.stopStatsPolling();
            break;
          case "connecting":
            this.ui.setStatus("connecting", "Connecting", "Establishing peer connection...");
            break;
        }
      },
      onIceStateChange: (state) => {
        if (state === "checking") {
          this.ui.setStatus("connecting", "Connecting", "ICE checking...");
        }
      },
      onIceCandidate: (candidate) => {
        this.signalling.sendIceCandidate(candidate);
      },
      onDataChannelOpen: () => {
        this.ui.showChat();
        this.ui.setStatus("connected", "Connected", "Peer-to-peer · DTLS encrypted");
        this.ui.addMessage("Secure connection established. Messages are end-to-end encrypted.", "system");
      },
      onDataChannelClose: () => {
        this.ui.setStatus("disconnected", "Disconnected", "Data channel closed");
        this.ui.disableChat();
      },
      onTrack: (_track, streams) => {
        this.ui.setRemoteStream(streams[0]);
      },
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peer?.addTrack(track, this.localStream!);
      });
    }
  }
}
