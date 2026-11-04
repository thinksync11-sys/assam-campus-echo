import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { threadIdSchema } from "./chat-policy";
import type { UIMessage } from "ai";

export const listChatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("chat_threads")
      .select("id,title,updated_at").eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load saved conversations.");
    return data;
  });

export const createChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("chat_threads")
      .insert({ user_id: context.userId }).select("id").single();
    if (error) throw new Error("Could not create a conversation.");
    return data;
  });

export const getChatThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth]).inputValidator((input: unknown) => threadIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase.from("chat_threads")
      .select("id,title").eq("id", data.threadId).eq("user_id", context.userId).maybeSingle();
    if (error || !thread) throw new Error("Conversation not found.");
    const { data: rows, error: messagesError } = await context.supabase.from("chat_messages")
      .select("message").eq("thread_id", data.threadId).eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (messagesError) throw new Error("Could not load conversation messages.");
    return { thread, messages: rows.map((row) => row.message as unknown as UIMessage) };
  });

export const deleteChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((input: unknown) => threadIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete()
      .eq("id", data.threadId).eq("user_id", context.userId);
    if (error) throw new Error("Could not delete the conversation.");
    return { success: true };
  });