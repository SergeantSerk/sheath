import { WebSocket } from "ws";
import { MessageSchema, ClientMessage } from "../validation/schemas";
import { RoomManager } from "../rooms/room-manager";

/**
 * Routes WebSocket messages to appropriate handlers.
 * Validates messages using Zod schemas and coordinates with RoomManager.
 */
export class MessageRouter {
  private roomManager: RoomManager;

  constructor() {
    this.roomManager = new RoomManager();
  }

  /**
   * Handles incoming WebSocket messages.
   * Parses JSON, validates schema, and routes to appropriate handler.
   */
  handleMessage(ws: WebSocket, rawData: Buffer) {
    let msg: any;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      this.sendError(ws, "Invalid JSON");
      return;
    }

    const result = MessageSchema.safeParse(msg);
    if (!result.success) {
      this.sendError(ws, "Invalid message format");
      return;
    }

    const validMsg = result.data;
    this.routeMessage(ws, validMsg);
  }

  /**
   * Routes validated messages to specific handlers.
   */
  private routeMessage(ws: WebSocket, msg: ClientMessage) {
    switch (msg.type) {
      case "create-room":
        this.handleCreateRoom(ws);
        break;
      case "join-room":
        this.handleJoinRoom(ws, msg.code);
        break;
      case "offer":
      case "answer":
      case "ice-candidate":
        this.handleSignalToPeer(ws, msg);
        break;
      case "typing-start":
      case "typing-stop":
        this.handleTyping(ws, msg.type);
        break;
    }
  }

  /**
   * Handles room creation request.
   * Cleans up any existing room the socket belongs to, generates a unique code, and registers the host.
   */
  private handleCreateRoom(host: WebSocket) {
    this.handleDisconnection(host);
    const code = this.roomManager.create(host);
    this.send(host, { type: "room-created", code });
  }

  /**
   * Handles room join request.
   * Validates room exists and is not full before adding guest.
   */
  private handleJoinRoom(guest: WebSocket, code: string) {
    const normalizedCode = code.toUpperCase();
    if (!this.roomManager.hasRoom(normalizedCode)) {
      this.sendError(guest, "Room not found");
      return;
    }
    if (this.roomManager.isFull(normalizedCode)) {
      this.sendError(guest, "Room is full");
      return;
    }
    this.handleDisconnection(guest);
    this.roomManager.join(normalizedCode, guest);
    this.send(guest, { type: "room-joined", code: normalizedCode });
    const host = this.roomManager.getPeer(guest);
    if (host) {
      this.send(host, { type: "peer-joined" });
    }
  }

  /**
   * Forwards signalling messages (offer/answer/ice) to the peer.
   */
  private handleSignalToPeer(ws: WebSocket, msg: ClientMessage) {
    const peer = this.roomManager.getPeer(ws);
    if (peer && peer.readyState === WebSocket.OPEN) {
      this.send(peer, msg);
    }
  }

  /**
   * Forwards typing indicators to the peer.
   */
  private handleTyping(ws: WebSocket, type: "typing-start" | "typing-stop") {
    const peer = this.roomManager.getPeer(ws);
    if (peer && peer.readyState === WebSocket.OPEN) {
      this.send(peer, { type });
    }
  }

  /**
   * Handles WebSocket disconnection.
   * Notifies peer and cleans up room if empty.
   * Looks up the peer BEFORE removing the socket so the notification can be delivered.
   * @returns Room code and whether peer was notified, or null
   */
  handleDisconnection(ws: WebSocket): { code: string; peerLeft: boolean } | null {
    // Crucial: get the peer BEFORE removing ws from the room, otherwise getPeer returns null!
    const peer = this.roomManager.getPeer(ws);
    const result = this.roomManager.remove(ws);
    if (!result) return null;

    const { code, wasFull } = result;
    if (peer && peer.readyState === WebSocket.OPEN) {
      this.send(peer, { type: "peer-left" });
    }

    return { code, peerLeft: wasFull };
  }

  /**
   * Safely sends data to a WebSocket if it's still open.
   */
  private send(ws: WebSocket, data: object) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Sends an error message to the client.
   */
  private sendError(ws: WebSocket, message: string) {
    this.send(ws, { type: "error", message });
  }
}
