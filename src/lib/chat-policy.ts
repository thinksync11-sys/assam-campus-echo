import { z } from "zod";

export const threadIdSchema = z.object({ threadId: z.string().uuid() });
export const chatMessageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.object({ type: z.literal("text"), text: z.string().max(12000) })).min(1),
});
export const chatRequestSchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(z.unknown()).min(1).max(500),
});

export function authDestination(value: unknown): "/chat" | "/admin" {
  return value === "/chat" ? "/chat" : "/admin";
}

export function ownsThread(owner: string, userId: string) {
  return owner === userId;
}