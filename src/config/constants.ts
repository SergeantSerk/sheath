/**
 * Extend Window interface for optional runtime ICE server configuration.
 */
declare global {
  interface Window {
    SHEATH_ICE_SERVERS?: RTCIceServer[];
  }
}

/**
 * Default public STUN servers for network discovery.
 * Multiple STUN servers provide redundancy.
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.stunprotocol.org:3478" },
];

/**
 * Returns configured ICE servers, checking window.SHEATH_ICE_SERVERS first
 * to allow external TURN/STUN server injection without rebuilding.
 */
export function getIceServers(): RTCIceServer[] {
  if (typeof window !== "undefined" && window.SHEATH_ICE_SERVERS && Array.isArray(window.SHEATH_ICE_SERVERS)) {
    return window.SHEATH_ICE_SERVERS;
  }
  return DEFAULT_ICE_SERVERS;
}

/**
 * ICE (Interactive Connectivity Establishment) servers.
 * Used by WebRTC to discover network paths between peers.
 */
export const ICE_SERVERS: RTCIceServer[] = getIceServers();

/**
 * Chunk size for file transfers over WebRTC data channels.
 * 16KB chosen for maximum compatibility across networks.
 */
export const CHUNK_SIZE = 16384; // 16KB for maximum compatibility

/**
 * Maximum buffered amount before waiting for drain.
 * Prevents memory bloat and ensures smooth transmission.
 */
export const MAX_BUFFERED_AMOUNT = 64 * 1024; // Keep buffer under 64KB

/**
 * Status indicator colors for UI.
 * Maps connection states to visual colors.
 */
export const STATUS_COLORS: Record<string, string> = {
  idle: "#6b7280",        // Gray - waiting for action
  connecting: "#f59e0b",  // Amber - connecting in progress
  connected: "#10b981",   // Green - connected successfully
  disconnected: "#ef4444", // Red - connection lost
  failed: "#ef4444",      // Red - connection failed
  error: "#ef4444",       // Red - error occurred
};

/**
 * Header sent before file transfer.
 * Used to reassemble chunked blobs on the receiving end.
 */
export type FileHeader = {
  type: "file-header";
  chunks: number;     // Total number of chunks
  size: number;       // Total file size in bytes
  mimeType?: string;  // MIME type (e.g. image/jpeg, image/png)
  name?: string;      // Optional file name
};

