import { WebSocket, WebSocketServer } from "ws";
import { MessageRouter } from "./message-router";

/**
 * Extended WebSocket interface to track heartbeat state.
 */
interface HeartbeatWebSocket extends WebSocket {
  isAlive?: boolean;
}

/**
 * Handles WebSocket connections for the signalling server.
 * Delegates message routing to MessageRouter and manages connection heartbeats.
 */
export class WebSocketHandler {
  private wss: WebSocketServer;
  private router: MessageRouter;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new WebSocketHandler attached to the given HTTP server.
   * @param server - The underlying HTTP server
   */
  constructor(server: any) {
    this.router = new MessageRouter();
    this.wss = new WebSocketServer({ server });
    this.setupConnectionHandlers();
    this.setupHeartbeat();
  }

  /**
   * Sets up event handlers for WebSocket connections.
   * - 'message': Routes to MessageRouter for processing
   * - 'close': Handles disconnection cleanup
   * - 'pong': Heartbeat response to keep mobile/cellular sockets alive
   */
  private setupConnectionHandlers() {
    this.wss.on("connection", (ws: HeartbeatWebSocket) => {
      // Mark as alive upon initial connection
      ws.isAlive = true;

      // Handle pong reply from client
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (data: Buffer) => {
        this.router.handleMessage(ws, data);
      });

      ws.on("close", () => {
        this.router.handleDisconnection(ws);
      });

      ws.on("error", (err) => {
        console.error("[WebSocket] Client error:", err.message);
      });
    });
  }

  /**
   * Sets up a periodic heartbeat interval (every 25 seconds).
   * Cellular NAT gateways drop idle TCP connections after 30-60s.
   * Sending pings ensures the connection stays alive and broken sockets are pruned.
   */
  private setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((client) => {
        const ws = client as HeartbeatWebSocket;
        if (ws.isAlive === false) {
          // Socket failed to respond to the previous ping, terminate it
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 25000);

    this.wss.on("close", () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    });
  }
}
