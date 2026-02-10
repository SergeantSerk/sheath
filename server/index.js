const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

/** @type {Map<string, { host: WebSocket | null, guest: WebSocket | null }>} */
const rooms = new Map();

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function removeFromRoom(ws) {
    for (const [code, room] of rooms.entries()) {
        if (room.host === ws) {
            room.host = null;
            if (room.guest) {
                room.guest.send(JSON.stringify({ type: "peer-left" }));
            }
            if (!room.guest) rooms.delete(code);
            console.log(`[Room ${code}] Host disconnected`);
            return;
        }
        if (room.guest === ws) {
            room.guest = null;
            if (room.host) {
                room.host.send(JSON.stringify({ type: "peer-left" }));
            }
            if (!room.host) rooms.delete(code);
            console.log(`[Room ${code}] Guest disconnected`);
            return;
        }
    }
}

function getPeer(ws) {
    for (const room of rooms.values()) {
        if (room.host === ws) return room.guest;
        if (room.guest === ws) return room.host;
    }
    return null;
}

wss.on("connection", (ws) => {
    console.log("[Server] New WebSocket connection");

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
            return;
        }

        switch (msg.type) {
            case "create-room": {
                let code = generateRoomCode();
                while (rooms.has(code)) code = generateRoomCode();
                rooms.set(code, { host: ws, guest: null });
                ws.send(JSON.stringify({ type: "room-created", code }));
                console.log(`[Room ${code}] Created`);
                break;
            }

            case "join-room": {
                const code = (msg.code || "").toUpperCase().trim();
                const room = rooms.get(code);
                if (!room) {
                    ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
                    return;
                }
                if (room.guest) {
                    ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
                    return;
                }
                room.guest = ws;
                ws.send(JSON.stringify({ type: "room-joined", code }));
                // Notify host that a peer has joined so they can create the offer
                room.host.send(JSON.stringify({ type: "peer-joined" }));
                console.log(`[Room ${code}] Guest joined`);
                break;
            }

            case "offer":
            case "answer":
            case "ice-candidate": {
                const peer = getPeer(ws);
                if (peer && peer.readyState === 1) {
                    peer.send(JSON.stringify(msg));
                }
                break;
            }

            default:
                ws.send(
                    JSON.stringify({ type: "error", message: `Unknown type: ${msg.type}` })
                );
        }
    });

    ws.on("close", () => {
        console.log("[Server] WebSocket disconnected");
        removeFromRoom(ws);
    });

    ws.on("error", (err) => {
        console.error("[Server] WebSocket error:", err.message);
    });
});

console.log(`[Sheath Signaling Server] Listening on ws://localhost:${PORT}`);
