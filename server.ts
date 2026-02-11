import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, "dist")));

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/** @type {Map<string, { host: WebSocket | null, guest: WebSocket | null }>} */
const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function removeFromRoom(ws: WebSocket) {
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

function getPeer(ws: WebSocket) {
  for (const room of rooms.values()) {
    if (room.host === ws) return room.guest;
    if (room.guest === ws) return room.host;
  }
  return null;
}

wss.on("connection", (ws) => {
  console.log("[Server] New WebSocket connection");

  ws.on("message", (raw) => {
    let msg: any;
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
        room.host?.send(JSON.stringify({ type: "peer-joined" }));
        console.log(`[Room ${code}] Guest joined`);
        break;
      }

      case "offer":
      case "answer":
      case "ice-candidate": {
        const peer = getPeer(ws);
        if (peer && peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify(msg));
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    removeFromRoom(ws);
  });
});

server.listen(PORT, () => {
  console.log(`[Sheath] Server running on http://localhost:${PORT}`);
});
