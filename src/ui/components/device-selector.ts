/**
 * DeviceSelector manages device selection UI elements.
 * Handles camera/microphone dropdowns and remote video controls.
 */
export class DeviceSelector {
  private cameraSelect!: HTMLSelectElement;
  private micSelect!: HTMLSelectElement;
  private joinInput!: HTMLInputElement;
  private muteBtn!: HTMLButtonElement;
  private cameraBtn!: HTMLButtonElement;
  private screenshareBtn!: HTMLButtonElement;
  private remoteMuteBtn!: HTMLButtonElement;
  private remoteHideBtn!: HTMLButtonElement;

  /**
   * Caches DOM element references for device controls.
   */
  initialize() {
    this.cameraSelect = document.getElementById("cameraSelect") as HTMLSelectElement;
    this.micSelect = document.getElementById("micSelect") as HTMLSelectElement;
    this.joinInput = document.getElementById("joinInput") as HTMLInputElement;
    this.muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;
    this.cameraBtn = document.getElementById("cameraBtn") as HTMLButtonElement;
    this.screenshareBtn = document.getElementById("screenshareBtn") as HTMLButtonElement;
    this.remoteMuteBtn = document.getElementById("remoteMuteBtn") as HTMLButtonElement;
    this.remoteHideBtn = document.getElementById("remoteHideBtn") as HTMLButtonElement;
  }

  /**
   * Gets the room code from the join input.
   */
  getJoinCode(): string {
    return this.joinInput.value.trim();
  }

  /**
   * Gets the selected camera device ID.
   */
  getSelectedCamera(): string {
    return this.cameraSelect.value;
  }

  /**
   * Gets the selected microphone device ID.
   */
  getSelectedMicrophone(): string {
    return this.micSelect.value;
  }

  /**
   * Shows the room code display after room creation.
   */
  showRoomCode() {
    document.getElementById("roomCodeDisplay")?.classList.remove("hidden");
  }

  /**
   * Hides the lobby view when joining a room.
   */
  hideLobby() {
    document.getElementById("lobbyView")?.classList.add("hidden");
  }

  /**
   * Shows the chat view when connection is established.
   */
  showChat() {
    document.getElementById("chatView")?.classList.remove("hidden");
  }

  /**
   * Disables chat input controls when disconnected.
   */
  disableChat() {
    const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
    const imageBtn = document.getElementById("imageBtn") as HTMLButtonElement;
    const emojiBtn = document.getElementById("emojiBtn") as HTMLButtonElement;
    const messageInput = document.getElementById("messageInput") as HTMLInputElement;

    sendBtn.disabled = true;
    imageBtn.disabled = true;
    emojiBtn.disabled = true;
    messageInput.disabled = true;
    document.getElementById("emojiPicker")?.classList.add("hidden");
  }

  /**
   * Enables chat input controls when connected.
   */
  enableChat() {
    const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
    const imageBtn = document.getElementById("imageBtn") as HTMLButtonElement;
    const emojiBtn = document.getElementById("emojiBtn") as HTMLButtonElement;
    const messageInput = document.getElementById("messageInput") as HTMLInputElement;

    sendBtn.disabled = false;
    imageBtn.disabled = false;
    emojiBtn.disabled = false;
    messageInput.disabled = false;
  }

  /**
   * Updates the audio toggle button icon.
   * @param enabled - Whether audio is currently enabled
   */
  updateAudioButton(enabled: boolean) {
    const iconOn = this.muteBtn.querySelector(".icon-on");
    const iconOff = this.muteBtn.querySelector(".icon-off");
    if (iconOn) iconOn.classList.toggle("hidden", !enabled);
    if (iconOff) iconOff.classList.toggle("hidden", enabled);
  }

  /**
   * Updates the video toggle button icon.
   * @param enabled - Whether video is currently enabled
   */
  updateVideoButton(enabled: boolean) {
    const iconOn = this.cameraBtn.querySelector(".icon-on");
    const iconOff = this.cameraBtn.querySelector(".icon-off");
    if (iconOn) iconOn.classList.toggle("hidden", !enabled);
    if (iconOff) iconOff.classList.toggle("hidden", enabled);
  }

  /**
   * Updates the screenshare toggle button icon.
   * @param enabled - Whether screenshare is currently enabled
   */
  updateScreenshareButton(enabled: boolean) {
    const iconOn = this.screenshareBtn.querySelector(".icon-on");
    const iconOff = this.screenshareBtn.querySelector(".icon-off");
    if (iconOn) iconOn.classList.toggle("hidden", !enabled);
    if (iconOff) iconOff.classList.toggle("hidden", enabled);
    this.screenshareBtn.classList.toggle("active-accent", enabled);
  }

  /**
   * Populates the camera dropdown with available devices.
   * Shows device ID prefix if label is not available.
   */
  populateCameras(devices: MediaDeviceInfo[]) {
    this.cameraSelect.innerHTML = devices
      .map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1} (${d.deviceId.slice(0, 4)})`}</option>`)
      .join("");
  }

  /**
   * Populates the microphone dropdown with available devices.
   * Shows device ID prefix if label is not available.
   */
  populateMicrophones(devices: MediaDeviceInfo[]) {
    this.micSelect.innerHTML = devices
      .map((d, i) => `<option value="${d.deviceId}">${d.label || `Microphone ${i + 1} (${d.deviceId.slice(0, 4)})`}</option>`)
      .join("");
  }

  /**
   * Toggles the remote mute button icon.
   */
  toggleRemoteMuteIcon(muted: boolean) {
    const iconOn = this.remoteMuteBtn.querySelector(".icon-on");
    const iconOff = this.remoteMuteBtn.querySelector(".icon-off");
    if (iconOn) iconOn.classList.toggle("hidden", muted);
    if (iconOff) iconOff.classList.toggle("hidden", !muted);
    this.remoteMuteBtn.classList.toggle("active", muted);
  }

  /**
   * Toggles the remote video hide button icon.
   */
  toggleRemoteHideIcon(hidden: boolean) {
    const iconOn = this.remoteHideBtn.querySelector(".icon-on");
    const iconOff = this.remoteHideBtn.querySelector(".icon-off");
    if (iconOn) iconOn.classList.toggle("hidden", hidden);
    if (iconOff) iconOff.classList.toggle("hidden", !hidden);
    this.remoteHideBtn.classList.toggle("active", hidden);
  }
}
