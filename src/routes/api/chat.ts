import { createFileRoute } from "@tanstack/react-router";
import { handleStudentChat } from "@/lib/chat.server";

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: ({ request }) => handleStudentChat(request) } },
});