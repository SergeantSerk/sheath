import { z } from "zod";

/**
 * Zod validation schemas for WebSocket messages.
 * These schemas ensure that incoming messages have the expected structure.
 */

/**
 * Message to create a new room (client -> server).
 * Example: { "type": "create-room" }
 */
export const CreateRoomSchema = z.object({ type: z.literal("create-room") });

/**
 * Message to join an existing room (client -> server).
 * Example: { "type": "join-room", "code": "ABC123" }
 */
export const JoinRoomSchema = z.object({ type: z.literal("join-room"), code: z.string().length(6) });

/**
 * WebRTC offer message (client -> server or server -> client).
 * Contains the SDP offer from the host to the guest.
 */
export const OfferSchema = z.object({ type: z.literal("offer"), sdp: z.any() });

/**
 * WebRTC answer message (client -> server or server -> client).
 * Contains the SDP answer from the guest to the host.
 */
export const AnswerSchema = z.object({ type: z.literal("answer"), sdp: z.any() });

/**
 * ICE candidate message (client -> server or server -> client).
 * Used to exchange network connectivity candidates.
 */
export const IceCandidateSchema = z.object({ type: z.literal("ice-candidate"), candidate: z.any() });

/**
 * Union type of all valid message schemas.
 * Used for runtime validation of incoming WebSocket messages from clients.
 */
export const MessageSchema = z.union([
  CreateRoomSchema,
  JoinRoomSchema,
  OfferSchema,
  AnswerSchema,
  IceCandidateSchema,
]);

/**
 * Messages sent from server to client (signalling events).
 */
export type SignallingEvent =
  | { type: "room-created"; code: string }
  | { type: "room-joined"; code: string }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "offer"; sdp: any }
  | { type: "answer"; sdp: any }
  | { type: "ice-candidate"; candidate: any }
  | { type: "error"; message: string };

/**
 * Messages received from client (incoming requests).
 */
export type ClientMessage =
  | { type: "create-room" }
  | { type: "join-room"; code: string }
  | { type: "offer"; sdp: any }
  | { type: "answer"; sdp: any }
  | { type: "ice-candidate"; candidate: any };
