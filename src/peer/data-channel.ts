import { CHUNK_SIZE, MAX_BUFFERED_AMOUNT, FileHeader } from "../config/constants";

/**
 * Callbacks for data channel lifecycle and message events.
 */
export type DataChannelCallbacks = {
  onMessage: (message: string | Blob) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Handles WebRTC data channel operations.
 * - Text message sending/receiving
 * - File chunking and reassembly (supports both Blob and ArrayBuffer for Safari/WebKit)
 * - Lifecycle tracking (onopen/onclose events)
 * - Flow control via buffered amount monitoring
 */
export class DataChannelHandler {
  private dc: RTCDataChannel;
  private callbacks: DataChannelCallbacks;
  private incomingChunks: (Blob | ArrayBuffer)[] = [];
  private expectedChunks = 0;
  private currentMimeType = "image/png";

  /**
   * Creates a new DataChannelHandler.
   * @param dc - The RTCDataChannel to wrap
   * @param callbacks - Callbacks for message and lifecycle events
   */
  constructor(dc: RTCDataChannel, callbacks: DataChannelCallbacks) {
    this.dc = dc;
    this.callbacks = callbacks;
    this.setupChannel();
  }

  /**
   * Sets up data channel event handlers.
   * - onopen: Connection established (ready to send)
   * - onclose: Connection closed
   * - onmessage: Handles both text and binary (chunked file) data across all browsers
   */
  private setupChannel() {
    this.dc.binaryType = "blob";

    this.dc.onopen = () => {
      this.callbacks.onOpen?.();
    };

    this.dc.onclose = () => {
      this.callbacks.onClose?.();
    };

    // If channel is already open when wrapped, notify callback
    if (this.dc.readyState === "open") {
      queueMicrotask(() => this.callbacks.onOpen?.());
    }

    this.dc.onmessage = async (event) => {
      const data = event.data;

      if (typeof data === "string") {
        // Text message or file header
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed.type === "file-header") {
            // Start receiving file chunks
            const header = parsed as FileHeader;
            this.incomingChunks = [];
            this.expectedChunks = header.chunks;
            this.currentMimeType = header.mimeType || "image/png";
            return;
          }
        } catch {
          // Not JSON, treat as plain text
        }
        this.callbacks.onMessage(data);
      } else if (data instanceof Blob || data instanceof ArrayBuffer) {
        // File chunk - supports both Blob and ArrayBuffer (crucial for iOS Safari / WebKit)
        if (this.expectedChunks > 0) {
          this.incomingChunks.push(data);
          if (this.incomingChunks.length === this.expectedChunks) {
            const fullBlob = new Blob(this.incomingChunks, { type: this.currentMimeType });
            this.callbacks.onMessage(fullBlob);
            this.incomingChunks = [];
            this.expectedChunks = 0;
          }
        }
      }
    };
  }

  /**
   * Sends a message (text or binary) over the data channel.
   * Binary data is automatically chunked.
   */
  async sendMessage(message: string | Blob) {
    if (this.dc.readyState !== "open") return;

    if (typeof message === "string") {
      this.dc.send(message);
    } else {
      await this.sendBlobInChunks(message);
    }
  }

  /**
   * Sends a large blob in chunks with flow control.
   * 1. Send file header with metadata (size, chunks, mimeType)
   * 2. Send chunks, waiting if buffer is full
   */
  private async sendBlobInChunks(blob: Blob) {
    const numChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const header: FileHeader = {
      type: "file-header",
      chunks: numChunks,
      size: blob.size,
      mimeType: blob.type || "image/png",
    };

    // Send metadata first
    this.dc.send(JSON.stringify(header));

    // Send data in chunks
    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);

      // Flow control: wait if buffer is too full
      while (this.dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await new Promise((r) => setTimeout(r, 50));
        if (this.dc.readyState !== "open") return;
      }

      this.dc.send(await chunk.arrayBuffer());
    }
  }

  /**
   * Gets the current data channel state.
   */
  getState(): RTCDataChannelState {
    return this.dc.readyState;
  }

  /**
   * Closes the data channel.
   */
  close() {
    this.dc.close();
  }
}
