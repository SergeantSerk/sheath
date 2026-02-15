import rateLimit from "express-rate-limit";

/**
 * Creates a rate limiter middleware for HTTP requests.
 * Prevents abuse by limiting each IP to 100 requests per 15 minutes.
 */
export function createRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in standard headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
  });
}
