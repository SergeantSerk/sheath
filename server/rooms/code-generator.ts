/**
 * Character set for room codes.
 * Excludes ambiguous characters: 0, O, 1, I, 8, B
 * Uses uppercase alphanumeric for readability.
 */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generates a random 6-character room code.
 * Codes are URL-safe and easy to dictate verbally.
 */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}
