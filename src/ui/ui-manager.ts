import { StatusDisplay } from "./components/status-display";
import { ChatRenderer } from "./components/chat-renderer";
import { DeviceSelector } from "./components/device-selector";
import { SoundPlayer } from "./components/sound-player";
import { EmojiPicker } from "./components/emoji-picker";

/**
 * UIManager coordinates all UI components and handles event binding.
 * Acts as the main interface between the App and the UI layer.
 */
export class UIManager {
  private app: HTMLElement;
  private statusDisplay!: StatusDisplay;
  private chatRenderer!: ChatRenderer;
  private deviceSelector!: DeviceSelector;
  private soundPlayer!: SoundPlayer;
  private emojiPicker!: EmojiPicker;
  private typingIndicator!: HTMLElement;
  private typingTimeout: number | null = null;
  private isTyping = false;

  // Event callbacks - set by App
  public onCreateRoom?: () => void;
  public onJoinRoom?: (code: string) => void;
  public onSendMessage?: (message: string) => void;
  public onToggleAudio?: () => void;
  public onToggleVideo?: () => void;
  public onSendImage?: (image: Blob) => void;
  public onChangeCamera?: (deviceId: string) => void;
  public onChangeMicrophone?: (deviceId: string) => void;
  public onTypingStart?: () => void;
  public onTypingStop?: () => void;

  /**
   * Creates UIManager and initializes UI.
   * @param appElement - Root DOM element
   */
  constructor(appElement: HTMLElement) {
    this.app = appElement;
    this.render();
    this.initializeComponents();
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
                <div class="video-controls-overlay">
                  <button class="btn-icon btn-sm" id="remoteMuteBtn" title="Mute Remote Audio">
                    <svg class="icon-on" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    <svg class="icon-off hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                  </button>
                  <button class="btn-icon btn-sm" id="remoteHideBtn" title="Hide Remote Video">
                    <svg class="icon-on" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg class="icon-off hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
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
              <div class="mic-picker">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                <select id="micSelect" class="select-input">
                  <option value="">Default Microphone</option>
                </select>
              </div>
            </div>

            <div class="messages" id="messagesContainer"></div>
            <div class="typing-indicator hidden" id="typingIndicator">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
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
              <button class="btn btn-secondary btn-image" id="imageBtn" title="Send Image" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </button>
              <div class="emoji-container">
                <button class="btn btn-secondary btn-emoji" id="emojiBtn" title="Insert Emoji" disabled>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <div class="emoji-picker hidden" id="emojiPicker"></div>
              </div>
              <input type="file" id="imageInput" class="hidden" accept="image/*" />
            </div>
          </div>
        </main>

        <footer class="footer">
          <span>Messages are end-to-end encrypted via DTLS &middot; Nothing is stored</span>
        </footer>
      </div>
    `;

    this.statusDisplay = new StatusDisplay();
    this.chatRenderer = new ChatRenderer();
    this.deviceSelector = new DeviceSelector();
    this.soundPlayer = new SoundPlayer();
    this.emojiPicker = new EmojiPicker();
    this.typingIndicator = document.getElementById("typingIndicator")!;
  }

  private initializeComponents() {
    this.statusDisplay.initialize();
    this.chatRenderer.initialize();
    this.deviceSelector.initialize();
    this.emojiPicker.initialize();
  }

  private bindEvents() {
    document.getElementById("createRoomBtn")?.addEventListener("click", () => {
      this.onCreateRoom?.();
    });

    document.getElementById("joinRoomBtn")?.addEventListener("click", () => {
      const code = this.deviceSelector.getJoinCode();
      if (code) this.onJoinRoom?.(code);
    });

    const joinInput = document.getElementById("joinInput") as HTMLInputElement;
    joinInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const code = joinInput.value.trim();
        if (code) this.onJoinRoom?.(code);
      }
    });

    // Force uppercase on room code input
    joinInput?.addEventListener("input", () => {
      joinInput.value = joinInput.value.toUpperCase();
    });

    document.getElementById("sendBtn")?.addEventListener("click", () => this.trySend());
    document.getElementById("messageInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.trySend();
    });

    // Typing indicator
    document.getElementById("messageInput")?.addEventListener("input", () => this.handleTypingInput());

    // Paste image from clipboard
    document.getElementById("messageInput")?.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            this.onSendImage?.(file);
            this.chatRenderer.addMessage(file, "sent");
          }
          break;
        }
      }
    });

    document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
      const code = document.getElementById("roomCodeValue")?.textContent || "";
      navigator.clipboard.writeText(code);
      this.showToast("Room code copied!");
    });

    document.getElementById("muteBtn")?.addEventListener("click", () => {
      this.onToggleAudio?.();
    });

    document.getElementById("cameraBtn")?.addEventListener("click", () => {
      this.onToggleVideo?.();
    });

    document.getElementById("cameraSelect")?.addEventListener("change", () => {
      const deviceId = this.deviceSelector.getSelectedCamera();
      if (deviceId) this.onChangeCamera?.(deviceId);
    });

    document.getElementById("micSelect")?.addEventListener("change", () => {
      const deviceId = this.deviceSelector.getSelectedMicrophone();
      if (deviceId) this.onChangeMicrophone?.(deviceId);
    });

    document.getElementById("imageBtn")?.addEventListener("click", () => {
      document.getElementById("imageInput")?.click();
    });

    document.getElementById("imageInput")?.addEventListener("change", () => {
      const file = (document.getElementById("imageInput") as HTMLInputElement)?.files?.[0];
      if (file) {
        this.onSendImage?.(file);
        this.chatRenderer.addMessage(file, "sent");
        (document.getElementById("imageInput") as HTMLInputElement).value = "";
      }
    });

    document.getElementById("remoteMuteBtn")?.addEventListener("click", () => {
      const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
      const muted = !remoteVideo.muted;
      remoteVideo.muted = muted;
      this.deviceSelector.toggleRemoteMuteIcon(muted);
    });

    document.getElementById("remoteHideBtn")?.addEventListener("click", () => {
      const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
      const hidden = remoteVideo.classList.toggle("hidden-video");
      this.deviceSelector.toggleRemoteHideIcon(hidden);
    });

    // Emoji picker events
    document.getElementById("emojiBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.emojiPicker.toggle();
    });

    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const emojiPicker = document.getElementById("emojiPicker");
      if (emojiPicker && !emojiPicker.contains(target) && target.id !== "emojiBtn") {
        this.emojiPicker.hide();
      }
    });
  }

  private trySend() {
    const msg = (document.getElementById("messageInput") as HTMLInputElement).value.trim();
    if (!msg) return;
    this.onSendMessage?.(msg);
    this.chatRenderer.addMessage(msg, "sent");
    (document.getElementById("messageInput") as HTMLInputElement).value = "";
    (document.getElementById("messageInput") as HTMLInputElement).focus();
  }

  // --- Public API (called by App) ---

  /**
   * Updates the status indicator with connection state.
   */
  setStatus(level: string, text: string, detail?: string) {
    this.statusDisplay.update(level, text, detail);
  }

  /**
   * Displays the room code after room creation.
   */
  showRoomCode(code: string) {
    document.getElementById("roomCodeValue")!.textContent = code;
    this.deviceSelector.showRoomCode();
  }

  /**
   * Switches from lobby view to chat view.
   */
  showChat() {
    this.deviceSelector.hideLobby();
    this.deviceSelector.showChat();
    this.enableChat();
  }

  /**
   * Adds a message to the chat display.
   */
  addMessage(content: string | Blob, type: "sent" | "received" | "system") {
    this.chatRenderer.addMessage(content, type);
    
    // Immediately hide typing indicator when receiving a message (peer has finished typing)
    if (type === "received") {
      this.immediateHidePeerTyping();
    }
  }

  /**
   * Disables chat input when disconnected.
   */
  disableChat() {
    this.deviceSelector.disableChat();
  }

  /**
   * Enables chat input when connected.
   */
  enableChat() {
    this.deviceSelector.enableChat();
    (document.getElementById("messageInput") as HTMLInputElement).focus();
  }

  /**
   * Sets the local video stream (preview).
   */
  setLocalStream(stream: MediaStream) {
    const localVideo = document.getElementById("localVideo") as HTMLVideoElement;
    localVideo.srcObject = stream;
  }

  /**
   * Sets the remote video stream (peer's video).
   */
  setRemoteStream(stream: MediaStream) {
    const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
    remoteVideo.srcObject = stream;
  }

  /**
   * Updates the audio toggle button to reflect current state.
   */
  updateAudioStatus(enabled: boolean) {
    this.deviceSelector.updateAudioButton(enabled);
  }

  /**
   * Updates the video toggle button to reflect current state.
   */
  updateVideoStatus(enabled: boolean) {
    this.deviceSelector.updateVideoButton(enabled);
  }

  /**
   * Populates the camera dropdown with available devices.
   */
  setCameras(devices: MediaDeviceInfo[]) {
    this.deviceSelector.populateCameras(devices);
  }

  /**
   * Populates the microphone dropdown with available devices.
   */
  setMicrophones(devices: MediaDeviceInfo[]) {
    this.deviceSelector.populateMicrophones(devices);
  }

  /**
   * Displays the current latency (RTT) in milliseconds.
   */
  setLatency(ms: number | null) {
    this.statusDisplay.setLatency(ms);
  }

  /**
   * Plays a sound notification when a peer joins.
   */
  notifyPeerJoined() {
    this.soundPlayer.playJoinSound();
  }

  /**
   * Plays a sound notification when a peer leaves.
   */
  notifyPeerLeft() {
    this.soundPlayer.playLeaveSound();
  }

  // ===== Typing Indicator =====

  /**
   * Handles user typing in the message input.
   * Sends typing-start once when typing begins, and schedules typing-stop after 5s of inactivity.
   */
  private handleTypingInput() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.onTypingStart?.();
    }

    // Reset the timeout on each keystroke
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = window.setTimeout(() => {
      this.isTyping = false;
      this.onTypingStop?.();
      this.typingTimeout = null;
    }, 5000); // 5 second timeout
  }

  /**
   * Shows the peer typing indicator.
   */
  showPeerTyping() {
    this.typingIndicator.classList.remove("hidden", "fade-out");
  }

  /**
   * Hides the peer typing indicator with a fade-out animation.
   */
  hidePeerTyping() {
    this.typingIndicator.classList.add("fade-out");
    // After animation completes, hide the element
    setTimeout(() => {
      if (this.typingIndicator.classList.contains("fade-out")) {
        this.typingIndicator.classList.add("hidden");
      }
    }, 200); // Match the CSS transition duration
  }

  /**
   * Immediately hides the peer typing indicator without animation.
   * Used when a message is received, as the peer has finished typing.
   */
  immediateHidePeerTyping() {
    // Clear any pending fade-out timeout
    this.typingIndicator.classList.remove("fade-out");
    this.typingIndicator.classList.add("hidden");
  }

  /**
   * Shows a temporary toast notification.
   */
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
}
