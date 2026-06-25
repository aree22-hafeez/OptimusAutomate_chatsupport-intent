import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useThreadStore } from "@/lib/thread-store";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const threads = useThreadStore((s) => s.threads);
  const createThread = useThreadStore((s) => s.createThread);

  useEffect(() => {
    const existing = threads[0];
    const target = existing ?? createThread();
    navigate({ to: "/$threadId", params: { threadId: target.id }, replace: true });
  }, []);

  return null;
}
