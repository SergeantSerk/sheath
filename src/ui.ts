type StatusLevel = "idle" | "connecting" | "connected" | "disconnected" | "failed" | "error";

const STATUS_COLORS: Record<StatusLevel, string> = {
  idle: "#6b7280",
  connecting: "#f59e0b",
  connected: "#10b981",
  disconnected: "#ef4444",
  failed: "#ef4444",
  error: "#ef4444",
};

export class UI {
  private app: HTMLElement;
  private statusDot!: HTMLElement;
  private statusText!: HTMLElement;
  private detailText!: HTMLElement;
  private roomCodeDisplay!: HTMLElement;
  private lobbyView!: HTMLElement;
  private chatView!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private messageInput!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private joinInput!: HTMLInputElement;
  private localVideo!: HTMLVideoElement;
  private remoteVideo!: HTMLVideoElement;
  private muteBtn!: HTMLButtonElement;
  private cameraBtn!: HTMLButtonElement;
  private cameraSelect!: HTMLSelectElement;
  private latencyLabel!: HTMLSpanElement;

  public onCreateRoom?: () => void;
  public onJoinRoom?: (code: string) => void;
  public onSendMessage?: (message: string) => void;
  public onToggleAudio?: () => void;
  public onToggleVideo?: () => void;
  public onChangeCamera?: (deviceId: string) => void;

  constructor(appElement: HTMLElement) {
    this.app = appElement;
    this.render();
    this.bindEvents();
  }

  private render() {
    this.app.innerHTML = `
      <div class="container">
        <header class="header">
          <div class="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <h1>Sheath</h1>
          </div>
          <div class="status-bar">
            <div class="status-indicator">
              <span class="status-dot" id="statusDot"></span>
              <span class="status-text" id="statusText">Initializing</span>
            </div>
            <div class="latency-info hidden" id="latencyInfo">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span id="latencyValue">--</span>ms
            </div>
            <span class="detail-text" id="detailText"></span>
          </div>
        </header>

        <main class="main">
          <!-- Lobby View -->
          <div class="lobby" id="lobbyView">
            <div class="lobby-card">
              <div class="lobby-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h2>Secure P2P Chat</h2>
              <p class="lobby-desc">End-to-end encrypted. No servers. No logs. No history.</p>

              <div class="lobby-actions">
                <button class="btn btn-primary" id="createRoomBtn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create Room
                </button>

                <div class="divider">
                  <span>or</span>
                </div>

                <div class="join-group">
                  <input 
                    type="text" 
                    id="joinInput" 
                    class="input" 
                    placeholder="Enter room code" 
                    maxlength="6"
                    autocomplete="off"
                    spellcheck="false"
                  />
                  <button class="btn btn-secondary" id="joinRoomBtn">Join</button>
                </div>
              </div>
            </div>

            <div class="room-code-display hidden" id="roomCodeDisplay">
              <span class="room-label">Your Room Code</span>
              <div class="room-code-row">
                <span class="room-code" id="roomCodeValue"></span>
                <button class="btn-icon" id="copyCodeBtn" title="Copy code">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
              <span class="room-waiting">Waiting for peer to join...</span>
            </div>
          </div>

          <!-- Chat View -->
          <div class="chat hidden" id="chatView">
            <div class="video-container">
              <div class="video-wrapper local">
                <video id="localVideo" autoplay playsinline muted></video>
                <div class="video-label">You</div>
              </div>
              <div class="video-wrapper remote">
                <video id="remoteVideo" autoplay playsinline></video>
                <div class="video-label">Remote Peer</div>
              </div>
            </div>

            <div class="media-controls">
              <button class="btn-icon" id="muteBtn" title="Toggle Mute">
                <svg class="icon-on hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                <svg class="icon-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
              <button class="btn-icon" id="cameraBtn" title="Toggle Video">
                <svg class="icon-on hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                <svg class="icon-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
              <div class="camera-picker">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                <select id="cameraSelect" class="select-input">
                  <option value="">Default Camera</option>
                </select>
              </div>
            </div>

            <div class="messages" id="messagesContainer"></div>
            <div class="chat-input-bar">
              <input 
                type="text" 
                id="messageInput" 
                class="input chat-input" 
                placeholder="Type a message..." 
                autocomplete="off"
                spellcheck="false"
              />
              <button class="btn btn-primary btn-send" id="sendBtn" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </main>

        <footer class="footer">
          <span>Messages are end-to-end encrypted via DTLS &middot; Nothing is stored</span>
        </footer>
      </div>
    `;

    // Cache DOM refs
    this.statusDot = document.getElementById("statusDot")!;
    this.statusText = document.getElementById("statusText")!;
    this.detailText = document.getElementById("detailText")!;
    this.roomCodeDisplay = document.getElementById("roomCodeDisplay")!;
    this.lobbyView = document.getElementById("lobbyView")!;
    this.chatView = document.getElementById("chatView")!;
    this.messagesContainer = document.getElementById("messagesContainer")!;
    this.messageInput = document.getElementById("messageInput") as HTMLInputElement;
    this.sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
    this.joinInput = document.getElementById("joinInput") as HTMLInputElement;
    this.localVideo = document.getElementById("localVideo") as HTMLVideoElement;
    this.remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
    this.muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;
    this.cameraBtn = document.getElementById("cameraBtn") as HTMLButtonElement;
    this.cameraSelect = document.getElementById("cameraSelect") as HTMLSelectElement;
    this.latencyLabel = document.getElementById("latencyValue") as HTMLSpanElement;
  }

  private bindEvents() {
    document.getElementById("createRoomBtn")!.addEventListener("click", () => {
      this.onCreateRoom?.();
    });

    document.getElementById("joinRoomBtn")!.addEventListener("click", () => {
      const code = this.joinInput.value.trim();
      if (code) this.onJoinRoom?.(code);
    });

    this.joinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const code = this.joinInput.value.trim();
        if (code) this.onJoinRoom?.(code);
      }
    });

    // Force uppercase on room code input
    this.joinInput.addEventListener("input", () => {
      this.joinInput.value = this.joinInput.value.toUpperCase();
    });

    this.sendBtn.addEventListener("click", () => this.trySend());
    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.trySend();
    });

    document.getElementById("copyCodeBtn")!.addEventListener("click", () => {
      const code = document.getElementById("roomCodeValue")!.textContent || "";
      navigator.clipboard.writeText(code);
      this.showToast("Room code copied!");
    });

    this.muteBtn.addEventListener("click", () => {
      this.onToggleAudio?.();
    });

    this.cameraBtn.addEventListener("click", () => {
      this.onToggleVideo?.();
    });

    this.cameraSelect.addEventListener("change", () => {
      if (this.cameraSelect.value) {
        this.onChangeCamera?.(this.cameraSelect.value);
      }
    });
  }

  private trySend() {
    const msg = this.messageInput.value.trim();
    if (!msg) return;
    this.onSendMessage?.(msg);
    this.addMessage(msg, "sent");
    this.messageInput.value = "";
    this.messageInput.focus();
  }

  // --- Public API ---

  setStatus(level: StatusLevel, text: string, detail?: string) {
    this.statusDot.style.background = STATUS_COLORS[level];
    this.statusDot.classList.toggle("pulse", level === "connecting");
    this.statusText.textContent = text;
    this.detailText.textContent = detail || "";
  }

  showRoomCode(code: string) {
    document.getElementById("roomCodeValue")!.textContent = code;
    this.roomCodeDisplay.classList.remove("hidden");
  }

  showChat() {
    this.lobbyView.classList.add("hidden");
    this.chatView.classList.remove("hidden");
    this.sendBtn.disabled = false;
    this.messageInput.focus();
  }

  addMessage(text: string, type: "sent" | "received" | "system") {
    const el = document.createElement("div");
    el.className = `message message-${type}`;

    if (type === "system") {
      el.textContent = text;
    } else {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      el.innerHTML = `
        <span class="message-text">${this.escapeHtml(text)}</span>
        <span class="message-time">${time}</span>
      `;
    }

    this.messagesContainer.appendChild(el);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  disableChat() {
    this.sendBtn.disabled = true;
    this.messageInput.disabled = true;
  }

  enableChat() {
    this.sendBtn.disabled = false;
    this.messageInput.disabled = false;
    this.messageInput.focus();
  }

  private showToast(message: string) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  setLocalStream(stream: MediaStream) {
    this.localVideo.srcObject = stream;
  }

  setRemoteStream(stream: MediaStream) {
    this.remoteVideo.srcObject = stream;
  }

  updateAudioStatus(enabled: boolean) {
    this.muteBtn.querySelector(".icon-on")?.classList.toggle("hidden", !enabled);
    this.muteBtn.querySelector(".icon-off")?.classList.toggle("hidden", enabled);
  }

  updateVideoStatus(enabled: boolean) {
    this.cameraBtn.querySelector(".icon-on")?.classList.toggle("hidden", !enabled);
    this.cameraBtn.querySelector(".icon-off")?.classList.toggle("hidden", enabled);
  }

  setCameras(devices: MediaDeviceInfo[]) {
    this.cameraSelect.innerHTML = devices
      .map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1} (${d.deviceId.slice(0, 4)})`}</option>`)
      .join("");
  }

  setLatency(ms: number | null) {
    const info = document.getElementById("latencyInfo");
    if (!info) return;

    if (ms === null) {
      info.classList.add("hidden");
    } else {
      info.classList.remove("hidden");
      this.latencyLabel.textContent = Math.round(ms).toString();
    }
  }
}
