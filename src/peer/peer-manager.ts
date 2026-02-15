import { DataChannelHandler } from "./data-channel";
import { ICE_SERVERS } from "../config/constants";

/**
 * Callbacks for PeerManager events.
 * Allows the application to react to connection state changes,
 * incoming messages, ICE candidates, and media tracks.
 */
export type PeerCallbacks = {
  onMessage?: (message: string | Blob) => void;
  onStateChange?: (state: RTCPeerConnectionState) => void;
  onIceStateChange?: (state: RTCIceConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onTrack?: (track: MediaStreamTrack, streams: MediaStream[]) => void;
};

/**
 * Manages WebRTC peer connection and data channel.
 * Handles:
 * - Connection establishment (offer/answer)
 * - ICE candidate exchange
 * - Media track management
 * - Data channel messaging (text + file transfers)
 * - Statistics (RTT monitoring)
 */
export class PeerManager {
  private pc: RTCPeerConnection;
  private dcHandler: DataChannelHandler | null = null;
  private callbacks: PeerCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;

  /**
   * Creates a new PeerManager with the given callbacks.
   * @param callbacks - Event handlers for connection events
   */
  constructor(callbacks: PeerCallbacks) {
    this.callbacks = callbacks;
    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,      // Pre-generate ICE candidates
      bundlePolicy: "max-bundle",  // Bundle all tracks together
      rtcpMuxPolicy: "require",    // Require RTCP multiplexing
      iceTransportPolicy: "all",   // Use all available interfaces
    });

    // ICE candidate gathering - forward to peer via signalling
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      this.callbacks.onStateChange?.(this.pc.connectionState);
    };

    // ICE connection state changes
    this.pc.oniceconnectionstatechange = () => {
      this.callbacks.onIceStateChange?.(this.pc.iceConnectionState);
    };

    // Handle incoming data channel (guest side)
    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    // Handle incoming media tracks from peer
    this.pc.ontrack = (event) => {
      this.callbacks.onTrack?.(event.track, Array.from(event.streams));
    };
  }

  /**
   * Sets up the data channel with message handling.
   */
  private setupDataChannel(channel: RTCDataChannel) {
    this.dcHandler = new DataChannelHandler(channel, {
      onMessage: (message) => this.callbacks.onMessage?.(message),
    });
    this.callbacks.onDataChannelOpen?.();
  }

  /**
   * Creates an offer (host side).
   * Creates data channel if needed, generates SDP offer.
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.dcHandler) {
      const channel = this.pc.createDataChannel("chat", {
        ordered: true, // Ensure ordered delivery
      });
      this.setupDataChannel(channel);
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handles incoming offer (guest side).
   * Sets remote description, flushes pending ICE candidates, creates answer.
   */
  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.remoteDescSet = true;
    await this.flushCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handles incoming answer (host side).
   * Sets remote description and flushes pending ICE candidates.
   */
  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.remoteDescSet = true;
    await this.flushCandidates();
  }

  /**
   * Adds an ICE candidate from the peer.
   * Buffers candidates until remote description is set.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (this.remoteDescSet) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  /**
   * Flushes buffered ICE candidates after remote description is set.
   */
  private async flushCandidates() {
    for (const c of this.pendingCandidates) {
      await this.pc.addIceCandidate(new RTCIceCandidate(c));
    }
    this.pendingCandidates = [];
  }

  /**
   * Sends a message over the data channel.
   * @param message - Text string or Blob (image/file)
   */
  async sendMessage(message: string | Blob) {
    await this.dcHandler?.sendMessage(message);
  }

  /**
   * Adds a media track to the peer connection.
   * Called when camera/mic is enabled.
   */
  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    return this.pc.addTrack(track, stream);
  }

  /**
   * Replaces an existing track with a new one.
   * Used when switching cameras or microphones.
   */
  async replaceTrack(oldTrack: MediaStreamTrack | null, newTrack: MediaStreamTrack) {
    const sender = this.pc.getSenders().find((s) => s.track === oldTrack);
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  /**
   * Gets the round-trip time to the peer.
   * Returns null if not connected.
   */
  async getRTT(): Promise<number | null> {
    if (this.pc.connectionState !== "connected") return null;

    try {
      const stats = await this.pc.getStats();
      let rtt: number | null = null;
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded" && "currentRoundTripTime" in report) {
          const candidatePair = report as any;
          rtt = candidatePair.currentRoundTripTime * 1000; // seconds to ms
        }
      });
      return rtt;
    } catch (err) {
      console.error("Error getting RTT stats:", err);
      return null;
    }
  }

  /**
   * Current WebRTC connection state.
   */
  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  /**
   * Current ICE connection state.
   */
  get iceConnectionState(): RTCIceConnectionState {
    return this.pc.iceConnectionState;
  }

  /**
   * Data channel ready state.
   */
  get dataChannelState(): RTCDataChannelState | "none" {
    return this.dcHandler?.getState() ?? "none";
  }

  /**
   * Cleanly shuts down the peer connection.
   * Closes data channel and peer connection.
   */
  destroy() {
    this.dcHandler?.close();
    this.pc.close();
    this.dcHandler = null;
  }
}
