import { STATUS_COLORS } from "../../config/constants";

/**
 * Manages the status indicator display in the header.
 * Shows connection state, latency, and detailed status messages.
 */
export class StatusDisplay {
  private statusDot!: HTMLElement;
  private statusText!: HTMLElement;
  private detailText!: HTMLElement;
  private latencyLabel!: HTMLSpanElement;

  /**
   * Initializes DOM element references.
   * Called after HTML is rendered.
   */
  initialize() {
    this.statusDot = document.getElementById("statusDot")!;
    this.statusText = document.getElementById("statusText")!;
    this.detailText = document.getElementById("detailText")!;
    this.latencyLabel = document.getElementById("latencyValue") as HTMLSpanElement;
  }

  /**
   * Updates the status display with new state.
   * @param level - Status level (idle, connecting, connected, etc.)
   * @param text - Main status text
   * @param detail - Optional detailed status message
   */
  update(level: string, text: string, detail?: string) {
    this.statusDot.style.background = STATUS_COLORS[level] || STATUS_COLORS.idle;
    this.statusDot.classList.toggle("pulse", level === "connecting");
    this.statusText.textContent = text;
    this.detailText.textContent = detail || "";
  }

  /**
   * Shows or hides latency information.
   * @param ms - Round-trip time in milliseconds, or null to hide
   */
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
