import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Serves static files from the dist directory.
 * This includes the built client assets (JS, CSS, images).
 */
export function configureStaticFiles(app: any) {
  app.use(express.static(path.join(__dirname, "../../dist")));
}

/**
 * SPA fallback route - serves index.html for all unknown routes.
 * This allows client-side routing to work correctly.
 */
export function configureSPAFallback(app: any) {
  app.get("*", (req: any, res: any) => {
    res.sendFile(path.join(__dirname, "../../dist/index.html"));
  });
}
