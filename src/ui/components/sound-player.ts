/**
 * SoundPlayer handles audio notifications using Web Audio API.
 * Plays different sounds for join, leave, and message events.
 */
export class SoundPlayer {
  private audioContext: AudioContext | null = null;

  /**
   * Plays an ascending two-tone chime when a peer joins.
   * Frequency: 880Hz -> 1046Hz (A5 -> C6)
   */
  playJoinSound() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      // Ascending two-tone chime (880Hz -> 1046Hz)
      const now = this.audioContext.currentTime;
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      osc1.frequency.setValueAtTime(880, now);
      osc1.type = "sine";
      osc2.frequency.setValueAtTime(1046, now + 0.1);
      osc2.type = "sine";

      gainNode.gain.setValueAtTime(0.25, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.25);
    } catch {
      // Audio not supported or context unavailable
    }
  }

  /**
   * Plays a low beep when a peer leaves.
   */
  playLeaveSound() {
    this.playBeep(400, 0.2);
  }

  /**
   * Plays a notification sound for incoming messages.
   */
  playNotificationSound() {
    this.playBeep(800, 0.15);
  }

  /**
   * Plays a simple sine wave beep.
   * @param frequency - Frequency in Hz
   * @param duration - Duration in seconds
   */
  private playBeep(frequency: number, duration: number) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch {
      // Audio not supported
    }
  }
}
