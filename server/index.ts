import express from "express";
import { createServer } from "http";
import { WebSocketHandler } from "./websocket/handler";
import { configureSecurity } from "./middleware/security";
import { createRateLimiter } from "./middleware/rate-limiter";
import { configureStaticFiles } from "./middleware/static-files";
import { configureSPAFallback } from "./middleware/static-files";

/**
 * Sheath Signalling Server
 * 
 * Entry point for the Express + WebSocket server.
 * Handles:
 * - HTTP requests (static files, SPA fallback)
 * - WebSocket connections for signalling
 * - Security middleware (helmet, rate limiting)
 * - Room management via WebSocket handler
 */
const app = express();
app.set("trust proxy", 1); // Trust reverse proxy for rate limiting
const server = createServer(app);

// Apply security headers via helmet
configureSecurity(app);

// Apply rate limiting to HTTP requests
app.use(createRateLimiter());

// Serve static client files from dist directory
configureStaticFiles(app);
// SPA fallback: all unknown routes serve index.html
configureSPAFallback(app);

// Initialize WebSocket handler for signalling
new WebSocketHandler(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`[Sheath] Server running on http://localhost:${PORT}`);
});
