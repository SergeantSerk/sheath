/**
 * MediaManager handles all media device operations.
 * - Device enumeration (cameras, microphones)
 * - Stream acquisition with optional device selection
 * - Secure context validation
 */

export class MediaManager {
  private isSupported: boolean;

  constructor() {
    this.isSupported = this.checkMediaSupport();
  }

  isMediaSupported(): boolean {
    return this.isSupported;
  }

  private checkMediaSupport(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    if (!this.isSupported) {
      throw new Error("Media devices API not available");
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices;
    } catch (err) {
      console.error("Failed to enumerate devices", err);
      throw err;
    }
  }

  async getCameras(): Promise<MediaDeviceInfo[]> {
    const devices = await this.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput");
  }

  async getMicrophones(): Promise<MediaDeviceInfo[]> {
    const devices = await this.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }

  async acquireAudio(deviceId?: string): Promise<MediaStream> {
    if (!this.isSupported) {
      throw new Error("Audio access requires a secure context (HTTPS or localhost)");
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err) {
      console.error("Failed to acquire audio", err);
      throw err;
    }
  }

  async acquireVideo(deviceId?: string): Promise<MediaStream> {
    if (!this.isSupported) {
      throw new Error("Video access requires a secure context (HTTPS or localhost)");
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (err) {
      console.error("Failed to acquire video", err);
      throw err;
    }
  }

  async acquireScreen(): Promise<MediaStream> {
    if (!this.isSupported || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error("Screen sharing is not supported in this browser or context");
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // We handle audio separately via getUserMedia
      });
      return stream;
    } catch (err) {
      console.error("Failed to acquire screen", err);
      throw err;
    }
  }
}
