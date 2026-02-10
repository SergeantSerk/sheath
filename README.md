# Sheath — Secure P2P Chat

Sheath is a minimal, secure, peer-to-peer (P2P) chat application built with modern web technologies. It establishes a direct, end-to-end encrypted connection between two users using WebRTC DataChannels.

## Features

- **No Server Storage**: Messages are sent directly between peers via `RTCPeerConnection`. The server is only used for initial signaling (handshake) and stores **zero** message data.
- **End-to-End Encryption**: All communication is secured via DTLS (Datagram Transport Layer Security) as part of the WebRTC standard.
- **Ephemeral**: Chat history exists only in your browser's memory. Refreshing the page wipes everything.
- **Simple Room System**: Create a room, share the 6-character code, and start chatting.
- **Modern UI**: Clean, dark-themed interface built with vanilla TypeScript and CSS.

## Tech Stack

- **Client**: Vite, TypeScript, Vanilla JS/DOM
- **Server**: Node.js, `ws` (WebSocket)
- **Protocol**: WebRTC (DataChannels), STUN (Google's public servers)
- **Deployment**: Docker & Docker Compose

## Prerequisites

- **Node.js**: v18+ (for local development)
- **Docker**: (optional, for containerized deployment)

## Local Development

### 1. Signaling Server

Start the WebSocket signaling server (runs on port 3001):

```bash
cd server
npm install
npm run dev
# Server listening on ws://localhost:3001
```

### 2. Client Application

Start the Vite development server (runs on port 5173):

```bash
cd client
npm install
npm run dev
# Client accessible at http://localhost:5173
```

## Docker & Docker Compose

You can run the entire stack (client + server) using Docker Compose.

### Run with Compose

```bash
docker compose up --build
```

- **Client**: [http://localhost:8080](http://localhost:8080)
- **Signaling Server**: `ws://localhost:3001`

### Stop Containers

```bash
docker compose down
```

## How to Use

1. **User A**: Open the app, click **Create Room**, and copy the 6-character room code.
2. **User B**: Open the app, enter the room code, and click **Join**.
3. **Chat**: Once connected, the status indicator will turn green. Messages are now encrypted and direct.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
