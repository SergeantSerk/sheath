# Sheath – Peer‑to‑Peer Secure Chat

**Onboarding Documentation for Agents**  

---

## 1. Project Overview  

- **Purpose**: Sheath is a minimal, secure, peer‑to‑peer (P2P) chat application that enables two users to communicate end‑to‑end encrypted via WebRTC DataChannels.  
- **Key Goal**: No persistent server storage of messages; the server only handles signalling (hand‑shake) and relays data‑channel establishment.  
- **Target Users**: End‑users who want a lightweight, privacy‑focused chat solution that can be self‑hosted or run in Docker.  

---

## 2. High‑Level Architecture  

```
+-------------------+           +-------------------+           +-------------------+
|   Client (Vite)   |   <--->   | Signalling Server |   <--->   |   Client (Vite)   |
|   (HTML/TS/JS)    | WebSocket |  (Node/Express)   | WebSocket |   (HTML/TS/JS)    |
+-------------------+           +-------------------+           +-------------------+
          |                                                               |
          |                  WebRTC DataChannel (direct)                  |
          +---------------------------------------------------------------+
- **Client**: Vite + TypeScript + vanilla DOM. Establishes a WebSocket connection to the signalling server for pairing negotiations (room creation, code exchange, ICE candidate exchange). After successful negotiation, peers connect directly via a WebRTC DataChannel for encrypted peer‑to‑peer messaging.  
- **Signalling Server**: Express + `ws` WebSocket endpoint. Handles room creation, code exchange, and the WebSocket signalling that negotiates client pairings before they establish a direct WebRTC DataChannel.  
- **Docker**: Provides reproducible runtime for both client and server; orchestrated via `docker‑compose.yml`.  

---

## 3. Directory Structure  

```
sheath/
│
├─ docker-compose.yml          # Orchestrates client & server containers
├─ Dockerfile                  # Unified build for client & server
├─ index.html                  # Static HTML entry point (served by server)
├─ LICENSE
├─ package.json                # Root workspace – defines scripts & dependencies
├─ README.md
├─ server.ts                   # Entry point delegating to server/index.ts
├─ tsconfig.json
├─ vite.config.ts              # Vite config for client bundling
│
├─ server/                     # Signalling backend
│  ├─ index.ts                 # Express + HTTP + WebSocket setup
│  ├─ middleware/              # Security, rate-limiting, and static file serving
│  ├─ rooms/                   # Room code generator and RoomManager
│  ├─ validation/              # Zod message schemas
│  └─ websocket/               # WebSocketHandler (heartbeat) & MessageRouter
│
└─ src/                        # Client source code
   ├─ app.ts                   # Orchestration controller
   ├─ main.ts                  # Client entry point
   ├─ style.css                # Responsive styles & mobile viewport rules
   ├─ config/                  # App constants & configurable ICE servers
   ├─ media/                   # MediaManager (camera, microphone, screenshare)
   ├─ peer/                    # PeerManager (WebRTC) & DataChannelHandler
   ├─ signalling/              # WebSocket SignallingClient
   └─ ui/                      # UIManager & modular UI components
```

- **`src/`** contains all front‑end TypeScript modules.  
- **`server/`** contains the modular Node signalling server.  
- **`docker-compose.yml`** orchestrates the unified container deployment.  

---

## 4. Technology Stack  

| Layer          | Technology         | Version (as of context) | Notes                              |
|----------------|--------------------|-------------------------|------------------------------------|
| **Client**     | Vite               | `^6.1.0`                | Fast dev server, native ES modules |
|                | TypeScript         | `^5.7.0`                | Strict typing, JSX‑free            |
|                | HTML/CSS           | –                       | Vanilla DOM manipulation           |
| **Server**     | Node.js            | v18+ (prereq)           | Runtime for Express                |
|                | Express            | `^4.18.2`               | HTTP server & middleware           |
|                | ws                 | `^8.16.0`               | WebSocket implementation           |
|                | helmet             | `^8.1.0`                | Security headers                   |
|                | express‑rate‑limit | `^8.2.1`                | DoS protection                     |
|                | zod                | `^4.3.6`                | Runtime validation                 |
| **Dev Tools**  | tsx                | `^4.7.0`                | Run TypeScript directly            |
|                | npm                | –                       | Package scripts                    |
| **Container**  | Docker             | –                       | Multi‑stage Dockerfile             |
|                | Docker‑Compose     | –                       | Orchestration                      |

---

## 5. Core Features  

1. **End‑to‑End Encryption** – WebRTC DataChannels use DTLS; encryption is built‑in, no extra crypto code required.  
2. **No Server‑Side Message Persistence** – Chat messages are sent directly between peers; server stores only signalling metadata.  
3. **Ephemeral Sessions** – All chat history lives only in browser memory; refresh clears everything.  
4. **Simple Room Code** – 6‑character alphanumeric codes (excluding ambiguous characters) for room identification.  
5. **Rate‑Limited Signalling** – HTTP endpoints are rate‑limited to mitigate abuse.  
6. **CSP & Security Headers** – `helmet` configures a safe CSP (Content‑Security‑Policy) for the SPA.  
7. **Hardlink Room Invites** – URLs with `?room=CODE` automatically prefill and connect on page load. Hosts can copy the full invite link or invoke the native Web Share API on mobile devices.  
8. **Mobile-Responsive UI** – Dynamic viewport sizing (`100dvh`), iOS notch/home-bar safe area insets, touch-persistent video overlays, flexbox wrapping to prevent media control overflow, and 16px input font sizing to prevent unwanted mobile zoom.  

---

## 6. Signalling Flow (Step‑by‑Step)  

1. **User A** opens the client UI → establishes a WebSocket connection to the signalling server.  
2. **Keepalive Heartbeat** – The server periodically sends WebSocket `ping` frames every 25 seconds; client responds with `pong` to prevent cellular NAT gateways from dropping idle connections.  
3. **Room Creation** – Client sends `create-room` request → server generates a 6‑char uppercase code and registers the host.  
4. **User B** joins using the same code (normalized to uppercase) → server maps the two sockets under that code.  
5. **Peer Discovery** – Server signals each side with the other’s SDP offer/answer and ICE candidates via WebSocket messages. Client buffers early ICE candidates if received before peer initialization.  
6. **WebRTC Connection** – Once both peers have exchanged ICE candidates and established connectivity, the `RTCPeerConnection` and `RTCDataChannel` enter `open` / `connected`.  
7. **Data Transfer** – Application‑level chat messages and chunked binary blobs (with MIME type metadata) are sent over `dataChannel.send()`.  
8. **Disconnection / Close** – When either peer disconnects, the server retrieves the peer before unregistering the socket and forwards `{ type: "peer-left" }`; client tears down WebRTC and updates UI.  

*All signalling messages are JSON‑encoded and validated with **zod** schemas.*

---

## 7. API Endpoints (Server)  

| Method | Endpoint  | Purpose                                    | Example Payload                              |
|--------|-----------|--------------------------------------------|----------------------------------------------|
| `GET`  | `/`       | Serves `index.html` (SPA fallback)         | –                                            |
| `GET`  | `/health` | Health check for container orchestration   | –                                            |
| `WS`   | `/signal` | WebSocket endpoint for signalling messages | `{type:"OFFER", sdp:"…", target:"roomCode"}` |

*WebSocket message schema is defined in `src/signalling.ts` and validated with Zod.*

---

## 8. Docker & Docker‑Compose  

### Dockerfile (Multi‑Stage)  

1. **Builder Stage** – Installs dependencies, compiles TypeScript (`npm run build`).  
2. **Runtime Stage** – Copies compiled `dist/` and static assets into a lightweight `node:18-alpine` image.  
3. **Expose** – Ports `3000` (server) and `5173` (client dev) are exposed as needed.  

### docker‑compose.yml  

```yaml
version: "3.9"
services:
  server:
    build: .
    container_name: sheath-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./dist:/app/dist
    environment:
      - PORT=3000
  client:
    build: .
    container_name: sheath-client
    restart: unless-stopped
    ports:
      - "5173:5173"
    depends_on:
      - server
    environment:
      - VITE_SIGNALLING_URL=ws://server:3000
```

- **Volumes** map compiled assets for hot‑reload in dev.  
- **Environment Variable** `VITE_SIGNALLING_URL` points the client to the signalling server.  

---

## 9. Development Workflow  

| Step             | Command                    | Description                                         |
|------------------|----------------------------|-----------------------------------------------------|
| **Install**      | `npm install` (root)       | Installs root deps (shared dev tools).              |
| **Server Dev**   | `cd server && npm run dev` | Starts Express server with hot‑reload (`tsx`).      |
| **Client Dev**   | `cd client && npm run dev` | Starts Vite dev server with hot‑module replacement. |
| **Build**        | `npm run build` (root)     | Transpiles TS → JS, bundles client assets.          |
| **Preview**      | `npm run preview`          | Serves built client & static assets via server.     |
| **Docker Build** | `docker compose build`     | Builds multi‑stage images.                          |
| **Docker Up**    | `docker compose up -d`     | Spins up server & client containers.                |
| **Docker Down**  | `docker compose down`      | Stops and removes containers.                       |

*All scripts are defined in the root `package.json` under `"scripts"`.*

---

## 10. Testing & Validation  

- **Unit Tests** – Not currently included; can be added under `src/` with a test framework (e.g., Vitest).  
- **Linting** – Pre‑commit hook can run `eslint` (configured via `eslint.config.mjs`).  
- **Type Checking** – `npm run build` triggers `tsc` with `--noEmit` on errors.  
- **Security Scan** – `npm audit` and `npm run lint` as part of CI.  

---

## 11. CI/CD (Suggested)  

1. **GitHub Actions** – Run on PR:  
   - `npm ci` → install dependencies.  
   - `npm run lint` → lint check.  
   - `npm run build` → compile.  
   - `docker build .` → verify Dockerfile works.  
2. **Deploy** – Use Azure Container Apps or AWS ECS with the generated image.  

---

## 12. Onboarding Checklist for Agents  

| ✅ | Item                              | Details                                                                                                                 |
|----|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| 1  | **Repository Overview**           | Understand folder layout, `package.json`, and `README.md`.                                                              |
| 2  | **Run Locally**                   | Execute `npm run dev` for both server and client; verify UI at `http://localhost:5173`.                                 |
| 3  | **Signalling Protocol**           | Study `src/signalling.ts` and WebSocket message types; validate with Zod schemas.                                       |
| 4  | **WebRTC Flow**                   | Review `peer.ts` and `main.ts` for DataChannel creation & message handling.                                             |
| 5  | **Docker Build**                  | Run `docker compose build` and confirm both services start without errors.                                              |
| 6  | **Environment Variables**         | Note `VITE_SIGNALLING_URL` usage; ensure correct URL in production.                                                     |
| 7  | **Security Middleware**           | Examine `helmet` config and rate‑limit settings; understand why CSP is disabled for SPA.                                |
| 8  | **Testing Strategy**              | Set up ESLint & TypeScript strictness; add unit tests if needed.                                                        |
| 9  | **CI Pipeline**                   | Create GitHub Actions workflow for lint, build, and Docker build.                                                       |
| 10 | **Documentation**                 | Keep `agents.md` up‑to‑date with any architectural changes.                                                             |
| 11 | **Documentation Synchronization** | Ensure `agents.md` is updated for every code change; include documentation diffs in pull‑request reviews and CI checks. |
| 12 | **Code Comments**                 | Add and update comments all around the codebase where relevant and possible, to describe the function of the code.      |

---

## 13. Knowledge Base References  

- **WebRTC Primer** – MDN Web Docs on DataChannels & DTLS.  
- **Zod Validation** – Official Zod documentation for schema definitions.  
- **Express Rate Limiting** – Express docs for `express-rate-limit`.  
- **Docker Multi‑Stage Builds** – Docker best practices for minimal images.  

---

## 14. Common Issues & Troubleshooting  

| Symptom                                      | Likely Cause                                          | Fix                                                                                        |
|----------------------------------------------|-------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Client cannot connect to signalling server   | Wrong host URL or server not running                  | Check server status and network URL; ensure WebSocket endpoint is reachable.                |
| WebRTC connection stays `connecting` / `failed` between mobile phones | Symmetric NAT / CGNAT on cellular or IPv4/IPv6 mismatch | Two phones on cellular networks require a TURN relay server (configure via `SHEATH_ICE_SERVERS`). |
| Mobile $\leftrightarrow$ PC connects but Mobile $\leftrightarrow$ Mobile fails | Asymmetric NAT hole punching works only with Cone NAT | Mobile devices behind Symmetric NATs cannot hole-punch directly; deploy a TURN relay server. |
| ICE candidates dropped on guest side         | Candidates arrived before offer processed             | Candidates are automatically buffered in `App` until `PeerManager` is ready.                 |
| Silent WebSocket disconnection on mobile     | Carrier NAT timeout on idle TCP socket                | Resolved via 25-second WebSocket ping/pong keepalive.                                       |
| iOS Safari zooms in on text input            | Input font size < 16px                                | Resolved by setting `.input` font-size to `1rem` (16px).                                     |
| Images fail to display on iOS Safari         | Data channel binary received as `ArrayBuffer`         | `DataChannelHandler` supports both `Blob` and `ArrayBuffer` with MIME type reassembly.      |

---

## 15. Extensibility Points  

1. **Authentication** – Add JWT‑based room access control.  
2. **Message Persistence** – Integrate encrypted storage (e.g., IndexedDB) for transcript history.  
3. **Multi‑User Rooms** – Extend signalling to support >2 participants.  
4. **TLS Termination** – Deploy behind an ingress with HTTPS for production.  
5. **Monitoring** – Export Prometheus metrics from the server (connection count, message rate).  

---

*End of Documentation*  

---

*Prepared for internal agent onboarding. All paths are absolute for Windows environment. Adjust Docker networking if deploying to non‑default Azure container networks.*
