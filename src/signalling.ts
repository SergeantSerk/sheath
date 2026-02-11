export type SignallingEvent =
    | { type: "room-created"; code: string }
    | { type: "room-joined"; code: string }
    | { type: "peer-joined" }
    | { type: "peer-left" }
    | { type: "offer"; sdp: RTCSessionDescriptionInit }
    | { type: "answer"; sdp: RTCSessionDescriptionInit }
    | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
    | { type: "error"; message: string };

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

export class SignallingClient {
    private ws: WebSocket | null = null;
    private callbacks: SignallingCallbacks;

    constructor(callbacks: SignallingCallbacks) {
        this.callbacks = callbacks;
    }

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
                return;
            }

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

    private send(data: object) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    createRoom() {
        this.send({ type: "create-room" });
    }

    joinRoom(code: string) {
        this.send({ type: "join-room", code });
    }

    sendOffer(sdp: RTCSessionDescriptionInit) {
        this.send({ type: "offer", sdp });
    }

    sendAnswer(sdp: RTCSessionDescriptionInit) {
        this.send({ type: "answer", sdp });
    }

    sendIceCandidate(candidate: RTCIceCandidateInit) {
        this.send({ type: "ice-candidate", candidate });
    }

    disconnect() {
        this.ws?.close();
        this.ws = null;
    }
}
