import { createClient } from "@supabase/supabase-js";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Database, Json } from "@/integrations/supabase/types";
import { chatMessageSchema, chatRequestSchema, ownsThread } from "./chat-policy";

export async function handleStudentChat(request: Request) {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const gatewayKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["UDC_GROQ_API_KEY"];
  if (!url || !publishableKey || !gatewayKey || !connectionKey) {
    return Response.json({ error: "Chat is not connected yet." }, { status: 503 });
  }
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ error: "Please sign in to chat." }, { status: 401 });
  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const userId = auth.user.id;
  let input;
  try { input = chatRequestSchema.parse(await request.json()); }
  catch { return Response.json({ error: "Invalid chat request." }, { status: 400 }); }
  const { data: thread, error: threadError } = await client.from("chat_threads")
    .select("id,user_id,title").eq("id", input.threadId).eq("user_id", userId).maybeSingle();
  if (threadError || !thread || !ownsThread(thread.user_id, userId)) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }
  const incoming = chatMessageSchema.safeParse(input.messages.at(-1));
  if (!incoming.success || incoming.data.role !== "user" || !incoming.data.parts.some((p) => p.text.trim())) {
    return Response.json({ error: "Please enter a message." }, { status: 400 });
  }
  const { data: history, error: historyError } = await client.from("chat_messages")
    .select("message,message_id").eq("thread_id", thread.id).eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (historyError) return Response.json({ error: "Could not read saved messages." }, { status: 500 });
  const messages = history.map((row) => row.message as unknown as UIMessage);
  const userMessage: UIMessage = incoming.data;
  if (!history.some((row) => row.message_id === userMessage.id)) {
    const { error } = await client.from("chat_messages").insert({
      thread_id: thread.id, user_id: userId, message_id: userMessage.id, message: userMessage as unknown as Json,
    });
    if (error) return Response.json({ error: "Could not save your message. Please try again." }, { status: 500 });
    messages.push(userMessage);
  }
  const title = thread.title === "New conversation"
    ? incoming.data.parts.map((p) => p.text).join(" ").slice(0, 80) : thread.title;
  const { error: titleError } = await client.from("chat_threads")
    .update({ title, updated_at: new Date().toISOString() }).eq("id", thread.id).eq("user_id", userId);
  if (titleError) return Response.json({ error: "Could not update your conversation." }, { status: 500 });

  const provider = createOpenAICompatible({
    name: "groq", baseURL: "https://connector-gateway.lovable.dev/udc_groq/openai/v1",
    headers: { Authorization: `Bearer ${gatewayKey}`, "X-Connection-Api-Key": connectionKey },
  });
  const result = streamText({
    model: provider("openai/gpt-oss-20b"), maxRetries: 0, abortSignal: request.signal,
    system: `You are Think Sync's student support assistant. Help students, employees and campus stakeholders with campus queries, study questions and practical guidance. Reply in the user's language, including Assamese or English. Be helpful, clear and concise; acknowledge uncertainty. Think Sync lets people report campus issues in multiple categories: Roads & Transportation, Cleanliness & Waste Management, Landscaping & Campus Maintenance, Buildings & Infrastructure, Laboratories & Academic Resources, Language Barriers for International Students, and Other Suggestions. Reporting requires a name and a description of at least 10 characters; email, location and one photo are optional. The home page has report and tracking sections. Users get a tracking code after submission and can see the team's response by tracking it. Contact: thinksync11@gmail.com. You cannot submit complaints, access private complaints, change statuses, or speak for admins. Never invent campus-specific rules, timetables, contacts or decisions. Direct emergencies to local emergency services or campus security without inventing phone numbers. Do not claim answers are official university advice.`,
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: (error) => {
      if (error instanceof Error) return error.message;
      return "Chat could not finish. Please try again.";
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage.parts.length) return;
      const { error } = await client.from("chat_messages").upsert({
        thread_id: thread.id, user_id: userId, message_id: responseMessage.id,
        message: responseMessage as unknown as Json,
      }, { onConflict: "thread_id,message_id" });
      if (error) throw new Error("The answer could not be saved. Please keep a copy before leaving.");
      const { error: updateError } = await client.from("chat_threads").update({ updated_at: new Date().toISOString() })
        .eq("id", thread.id).eq("user_id", userId);
      if (updateError) throw new Error("The conversation could not be updated.");
    },
  });
}