/**
 * SignallingClient handles WebSocket communication with the signalling server.
 * Manages room lifecycle and relays WebRTC signalling messages (offer/answer/ICE).
 */
export type SignallingEvent =
  | { type: "room-created"; code: string }      // Server confirms room creation
  | { type: "room-joined"; code: string }       // Server confirms room join
  | { type: "peer-joined" }                     // Peer has joined the room
  | { type: "peer-left" }                       // Peer has disconnected
  | { type: "offer"; sdp: RTCSessionDescriptionInit } // WebRTC offer
  | { type: "answer"; sdp: RTCSessionDescriptionInit } // WebRTC answer
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit } // ICE candidate
  | { type: "error"; message: string };         // Error from server

/**
 * Callback interface for signalling events.
 * Application implements these to react to server messages.
 */
export type SignallingCallbacks = {
  onRoomCreated?: (code: string) => void;
  onRoomJoined?: (code: string) => void;
  onPeerJoined?: () => void;
  onPeerLeft?: () => void;
  onOffer?: (sdp: RTCSessionDescriptionInit) => void;
  onAnswer?: (sdp: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onError?: (message: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * WebSocket client for signalling server communication.
 * Uses browser's native WebSocket (not Node.js 'ws' package).
 */
export class SignallingClient {
  private ws: WebSocket | null = null;
  private callbacks: SignallingCallbacks;

  /**
   * Creates a new SignallingClient with event callbacks.
   * @param callbacks - Event handlers for signalling events
   */
  constructor(callbacks: SignallingCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Connects to the signalling server.
   * @param url - WebSocket URL (ws:// or wss://)
   */
  connect(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.callbacks.onOpen?.();
    };

    this.ws.onclose = () => {
      this.callbacks.onClose?.();
    };

    this.ws.onerror = () => {
      this.callbacks.onError?.("WebSocket connection failed");
    };

    this.ws.onmessage = (event) => {
      let msg: SignallingEvent;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // Ignore invalid JSON
      }

      // Route message to appropriate callback
      switch (msg.type) {
        case "room-created":
          this.callbacks.onRoomCreated?.(msg.code);
          break;
        case "room-joined":
          this.callbacks.onRoomJoined?.(msg.code);
          break;
        case "peer-joined":
          this.callbacks.onPeerJoined?.();
          break;
        case "peer-left":
          this.callbacks.onPeerLeft?.();
          break;
        case "offer":
          this.callbacks.onOffer?.(msg.sdp);
          break;
        case "answer":
          this.callbacks.onAnswer?.(msg.sdp);
          break;
        case "ice-candidate":
          this.callbacks.onIceCandidate?.(msg.candidate);
          break;
        case "error":
          this.callbacks.onError?.(msg.message);
          break;
      }
    };
  }

  /**
   * Sends data if WebSocket is open.
   */
  private send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Requests creation of a new room.
   */
  createRoom() {
    this.send({ type: "create-room" });
  }

  /**
   * Joins an existing room by code.
   * @param code - 6-character room code
   */
  joinRoom(code: string) {
    this.send({ type: "join-room", code });
  }

  /**
   * Sends a WebRTC offer to the peer.
   */
  sendOffer(sdp: RTCSessionDescriptionInit) {
    this.send({ type: "offer", sdp });
  }

  /**
   * Sends a WebRTC answer to the peer.
   */
  sendAnswer(sdp: RTCSessionDescriptionInit) {
    this.send({ type: "answer", sdp });
  }

  /**
   * Sends an ICE candidate to the peer.
   */
  sendIceCandidate(candidate: RTCIceCandidateInit) {
    this.send({ type: "ice-candidate", candidate });
  }

  /**
   * Closes the WebSocket connection.
   */
  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
