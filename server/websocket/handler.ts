import { WebSocket, WebSocketServer } from "ws";
import { MessageRouter } from "./message-router";

/**
 * Handles WebSocket connections for the signalling server.
 * Delegates message routing to MessageRouter.
 */
export class WebSocketHandler {
  private wss: WebSocketServer;
  private router: MessageRouter;

  /**
   * Creates a new WebSocketHandler attached to the given HTTP server.
   * @param server - The underlying HTTP server
   */
  constructor(server: any) {
    this.router = new MessageRouter();
    this.wss = new WebSocketServer({ server });
    this.setupConnectionHandlers();
  }

  /**
   * Sets up event handlers for WebSocket connections.
   * - 'message': Routes to MessageRouter for processing
   * - 'close': Handles disconnection cleanup
   */
  private setupConnectionHandlers() {
    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("message", (data: Buffer) => {
        this.router.handleMessage(ws, data);
      });

      ws.on("close", () => {
        this.router.handleDisconnection(ws);
      });
    });
  }
}
