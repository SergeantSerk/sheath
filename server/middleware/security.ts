import helmet from "helmet";

/**
 * Configures security middleware for the Express app.
 * Uses helmet to set various HTTP headers for security.
 * Note: Content Security Policy is disabled because it's handled
 * in the client-side index.html for the SPA.
 */
export function configureSecurity(app: any) {
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP handled in index.html for SPA
    })
  );
}
