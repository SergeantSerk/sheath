export type PeerCallbacks = {
    onMessage?: (message: string) => void;
    onStateChange?: (state: RTCPeerConnectionState) => void;
    onIceStateChange?: (state: RTCIceConnectionState) => void;
    onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
    onDataChannelOpen?: () => void;
    onDataChannelClose?: () => void;
    onTrack?: (track: MediaStreamTrack, streams: readonly MediaStream[]) => void;
};

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

export class PeerManager {
    private pc: RTCPeerConnection;
    private dc: RTCDataChannel | null = null;
    private callbacks: PeerCallbacks;
    private pendingCandidates: RTCIceCandidateInit[] = [];
    private remoteDescSet = false;

    constructor(callbacks: PeerCallbacks) {
        this.callbacks = callbacks;
        this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.callbacks.onIceCandidate?.(event.candidate.toJSON());
            }
        };

        this.pc.onconnectionstatechange = () => {
            this.callbacks.onStateChange?.(this.pc.connectionState);
        };

        this.pc.oniceconnectionstatechange = () => {
            this.callbacks.onIceStateChange?.(this.pc.iceConnectionState);
        };

        // Handle incoming data channel (for the answerer/guest)
        this.pc.ondatachannel = (event) => {
            this.setupDataChannel(event.channel);
        };

        this.pc.ontrack = (event) => {
            this.callbacks.onTrack?.(event.track, event.streams);
        };
    }

    private setupDataChannel(channel: RTCDataChannel) {
        this.dc = channel;

        this.dc.onopen = () => {
            this.callbacks.onDataChannelOpen?.();
        };

        this.dc.onclose = () => {
            this.callbacks.onDataChannelClose?.();
        };

        this.dc.onmessage = (event) => {
            this.callbacks.onMessage?.(event.data);
        };
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
        // Host creates the data channel if it doesn't exist
        if (!this.dc) {
            const channel = this.pc.createDataChannel("chat", {
                ordered: true,
            });
            this.setupDataChannel(channel);
        }

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        return offer;
    }

    async handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.remoteDescSet = true;
        await this.flushCandidates();

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        return answer;
    }

    async handleAnswer(sdp: RTCSessionDescriptionInit) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.remoteDescSet = true;
        await this.flushCandidates();
    }

    async addIceCandidate(candidate: RTCIceCandidateInit) {
        if (this.remoteDescSet) {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
            this.pendingCandidates.push(candidate);
        }
    }

    private async flushCandidates() {
        for (const c of this.pendingCandidates) {
            await this.pc.addIceCandidate(new RTCIceCandidate(c));
        }
        this.pendingCandidates = [];
    }

    sendMessage(message: string) {
        if (this.dc?.readyState === "open") {
            this.dc.send(message);
        }
    }

    addTrack(track: MediaStreamTrack, stream: MediaStream) {
        return this.pc.addTrack(track, stream);
    }

    async replaceTrack(oldTrack: MediaStreamTrack | null, newTrack: MediaStreamTrack) {
        const sender = this.pc.getSenders().find((s) => s.track === oldTrack);
        if (sender) {
            await sender.replaceTrack(newTrack);
        } else {
            // If no sender found for old track, just add it (this might happen on first camera start)
            // But usually we use addTrack first.
        }
    }

    get connectionState(): RTCPeerConnectionState {
        return this.pc.connectionState;
    }

    get iceConnectionState(): RTCIceConnectionState {
        return this.pc.iceConnectionState;
    }

    get dataChannelState(): RTCDataChannelState | "none" {
        return this.dc?.readyState ?? "none";
    }

    destroy() {
        this.dc?.close();
        this.pc.close();
        this.dc = null;
    }
}
