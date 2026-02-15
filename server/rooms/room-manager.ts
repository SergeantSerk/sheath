import { WebSocket } from "ws";
import { generateRoomCode } from "./code-generator.js";

/**
 * Represents a room with host and guest WebSocket connections.
 */
export interface Room {
  host: WebSocket | null;
  guest: WebSocket | null;
}

/**
 * Manages room lifecycle: creation, joining, and cleanup.
 * Thread-safe for single-threaded Node.js event loop.
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Creates a new room with the given host WebSocket.
   * @param host - The host's WebSocket connection
   * @returns The generated room code
   */
  create(host: WebSocket): string {
    const code = this.generateUniqueCode();
    this.rooms.set(code, { host, guest: null });
    return code;
  }

  /**
   * Adds a guest to an existing room.
   * @param code - Room code (case-insensitive)
   * @param guest - The guest's WebSocket connection
   * @returns true if joined successfully, false if room not found or full
   */
  join(code: string, guest: WebSocket): boolean {
    const room = this.rooms.get(code);
    if (!room || room.guest) return false;
    room.guest = guest;
    return true;
  }

  /**
   * Gets the peer (other participant) for a given WebSocket.
   * @param ws - The WebSocket to find the peer for
   * @returns The peer's WebSocket, or null if not found
   */
  getPeer(ws: WebSocket): WebSocket | null {
    for (const room of this.rooms.values()) {
      if (room.host === ws) return room.guest;
      if (room.guest === ws) return room.host;
    }
    return null;
  }

  /**
   * Removes a WebSocket from its room and cleans up empty rooms.
   * @param ws - The WebSocket to remove
   * @returns Object with room code and whether the room was full, or null
   */
  remove(ws: WebSocket): { code: string; wasFull: boolean } | null {
    for (const [code, room] of this.rooms.entries()) {
      if (room.host === ws) {
        room.host = null;
        const wasFull = room.guest !== null;
        if (!room.guest) {
          this.rooms.delete(code);
        }
        return { code, wasFull };
      }
      if (room.guest === ws) {
        room.guest = null;
        const wasFull = room.host !== null;
        if (!room.host) {
          this.rooms.delete(code);
        }
        return { code, wasFull };
      }
    }
    return null;
  }

  /**
   * Checks if a room exists.
   */
  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  /**
   * Checks if a room is full (has both host and guest).
   */
  isFull(code: string): boolean {
    const room = this.rooms.get(code);
    return room ? room.guest !== null : true;
  }

  /**
   * Generates a unique room code not already in use.
   */
  private generateUniqueCode(): string {
    let code;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));
    return code;
  }
}
