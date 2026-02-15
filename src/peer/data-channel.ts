import { CHUNK_SIZE, MAX_BUFFERED_AMOUNT, FileHeader } from "../config/constants";

/**
 * Handles WebRTC data channel operations.
 * - Text message sending/receiving
 * - File chunking and reassembly
 * - Flow control via buffered amount monitoring
 */
export class DataChannelHandler {
  private dc: RTCDataChannel;
  private callbacks: {
    onMessage: (message: string | Blob) => void;
  };
  private incomingChunks: Blob[] = [];
  private expectedChunks = 0;

  /**
   * Creates a new DataChannelHandler.
   * @param dc - The RTCDataChannel to wrap
   * @param callbacks - Callback for received messages
   */
  constructor(dc: RTCDataChannel, callbacks: { onMessage: (message: string | Blob) => void }) {
    this.dc = dc;
    this.callbacks = callbacks;
    this.setupChannel();
  }

  /**
   * Sets up data channel event handlers.
   * - onopen: Connection established
   * - onclose: Connection closed
   * - onmessage: Handles both text and binary (chunked file) data
   */
  private setupChannel() {
    this.dc.binaryType = "blob";

    this.dc.onopen = () => {
      // Connection established - ready to send
    };

    this.dc.onclose = () => {
      // Connection closed - cleanup if needed
    };

    this.dc.onmessage = async (event) => {
      const data = event.data;

      if (typeof data === "string") {
        // Text message or file header
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "file-header") {
            // Start receiving file chunks
            const header = parsed as FileHeader;
            this.incomingChunks = [];
            this.expectedChunks = header.chunks;
            return;
          }
        } catch {
          // Not JSON, treat as plain text
        }
        this.callbacks.onMessage(data);
      } else if (data instanceof Blob) {
        // File chunk - reassemble when complete
        if (this.expectedChunks > 0) {
          this.incomingChunks.push(data);
          if (this.incomingChunks.length === this.expectedChunks) {
            const fullBlob = new Blob(this.incomingChunks);
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
   * 1. Send file header with metadata
   * 2. Send chunks, waiting if buffer is full
   */
  private async sendBlobInChunks(blob: Blob) {
    const numChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const header: FileHeader = {
      type: "file-header",
      chunks: numChunks,
      size: blob.size,
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
