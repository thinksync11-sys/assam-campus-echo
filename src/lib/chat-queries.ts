import { queryOptions } from "@tanstack/react-query";
import { getChatThread, listChatThreads } from "./chat.functions";

export const chatThreadsOptions = queryOptions({
  queryKey: ["chat-threads"], queryFn: () => listChatThreads(), staleTime: 0,
});
export const chatThreadOptions = (threadId: string) => queryOptions({
  queryKey: ["chat-thread", threadId], queryFn: () => getChatThread({ data: { threadId } }), staleTime: 0,
});