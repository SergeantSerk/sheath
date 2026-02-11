export type PeerCallbacks = {
    onMessage?: (message: string | Blob) => void;
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
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.stunprotocol.org:3478" },
];

const CHUNK_SIZE = 16384; // 16KB for maximum compatibility
const MAX_BUFFERED_AMOUNT = 64 * 1024; // Keep buffer under 64KB

type FileHeader = {
    type: "file-header";
    chunks: number;
    size: number;
};

export class PeerManager {
    private pc: RTCPeerConnection;
    private dc: RTCDataChannel | null = null;
    private callbacks: PeerCallbacks;
    private pendingCandidates: RTCIceCandidateInit[] = [];
    private remoteDescSet = false;

    // Reassembly state
    private incomingChunks: Blob[] = [];
    private expectedChunks = 0;

    constructor(callbacks: PeerCallbacks) {
        this.callbacks = callbacks;
        this.pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
            iceCandidatePoolSize: 2,
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
            iceTransportPolicy: "all",
        });

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
        this.dc.binaryType = "blob";

        this.dc.onopen = () => {
            this.callbacks.onDataChannelOpen?.();
        };

        this.dc.onclose = () => {
            this.callbacks.onDataChannelClose?.();
        };

        this.dc.onmessage = async (event) => {
            const data = event.data;

            if (typeof data === "string") {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === "file-header") {
                        const header = parsed as FileHeader;
                        this.incomingChunks = [];
                        this.expectedChunks = header.chunks;
                        return;
                    }
                } catch (e) {
                    // Not a JSON message, handle as normal text
                }
                this.callbacks.onMessage?.(data);
            } else if (data instanceof Blob) {
                if (this.expectedChunks > 0) {
                    this.incomingChunks.push(data);
                    if (this.incomingChunks.length === this.expectedChunks) {
                        const fullBlob = new Blob(this.incomingChunks);
                        this.callbacks.onMessage?.(fullBlob);
                        this.incomingChunks = [];
                        this.expectedChunks = 0;
                    }
                }
            }
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

    async sendMessage(message: string | Blob) {
        if (this.dc?.readyState !== "open") return;

        if (typeof message === "string") {
            this.dc.send(message);
        } else {
            await this.sendBlobInChunks(message);
        }
    }

    private async sendBlobInChunks(blob: Blob) {
        if (!this.dc) return;

        const numChunks = Math.ceil(blob.size / CHUNK_SIZE);
        const header: FileHeader = {
            type: "file-header",
            chunks: numChunks,
            size: blob.size,
        };

        // Send metadata
        this.dc.send(JSON.stringify(header));

        // Send chunks
        for (let i = 0; i < numChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, blob.size);
            const chunk = blob.slice(start, end);

            // Wait if buffer is full
            while (this.dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
                await new Promise((r) => setTimeout(r, 50));
                if (this.dc.readyState !== "open") return;
            }

            this.dc.send(await chunk.arrayBuffer());
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

    async getRTT(): Promise<number | null> {
        if (this.pc.connectionState !== "connected") return null;

        try {
            const stats = await this.pc.getStats();
            let rtt: number | null = null;
            stats.forEach((report) => {
                if (report.type === "candidate-pair" && report.state === "succeeded" && report.currentRoundTripTime !== undefined) {
                    rtt = report.currentRoundTripTime * 1000; // seconds to ms
                }
            });
            return rtt;
        } catch (err) {
            console.error("Error getting RTT stats:", err);
            return null;
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
