import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatWindow } from "@/components/chat-window";
import { ThreadSidebar } from "@/components/thread-sidebar";
import { useThreadStore } from "@/lib/thread-store";

export const Route = createFileRoute("/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = useParams({ from: "/$threadId" });
  const thread = useThreadStore((s) => s.getThread(threadId));
  const threads = useThreadStore((s) => s.threads);

  useEffect(() => {
    if (!thread) {
      // Re-create a placeholder thread with this exact id so direct URL hits work.
      useThreadStore.setState({
        threads: [
          {
            id: threadId,
            title: "New conversation",
            createdAt: Date.now(),
            messages: [],
          },
          ...threads,
        ],
      });
    }
  }, [thread, threadId, threads]);

  return (
    <div className="flex min-h-screen w-full">
      <ThreadSidebar />
      <ChatWindow key={threadId} threadId={threadId} />
    </div>
  );
}