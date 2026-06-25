import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import logo from "@/assets/shopbot-logo.png";
import { useThreadStore } from "@/lib/thread-store";
import { cn } from "@/lib/utils";

export function ThreadSidebar() {
  const threads = useThreadStore((s) => s.threads);
  const createThread = useThreadStore((s) => s.createThread);
  const deleteThread = useThreadStore((s) => s.deleteThread);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const handleNew = () => {
    const t = createThread();
    navigate({ to: "/$threadId", params: { threadId: t.id } });
  };

  const handleDelete = (id: string) => {
    deleteThread(id);
    if (id === activeId) {
      const remaining = useThreadStore.getState().threads;
      const next = remaining[0] ?? useThreadStore.getState().createThread();
      navigate({ to: "/$threadId", params: { threadId: next.id } });
    }
  };

  return (
    <aside className="flex h-screen w-72 flex-col border-r bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-4">
        <img
          src={logo}
          alt="Shopbot logo"
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg"
        />
        <div>
          <div className="text-sm font-semibold leading-tight">Shopbot</div>
          <div className="text-xs text-muted-foreground">Northbound Goods</div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <button
          onClick={handleNew}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {threads.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No conversations yet.
          </p>
        )}
        {threads.map((t) => {
          const isActive = t.id === activeId;
          return (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-2 text-sm transition",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted text-foreground/80",
              )}
            >
              <Link
                to="/$threadId"
                params={{ threadId: t.id }}
                className="flex flex-1 items-center gap-2 truncate"
              >
                <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{t.title}</span>
              </Link>
              <button
                onClick={() => handleDelete(t.id)}
                aria-label="Delete conversation"
                className="opacity-0 transition group-hover:opacity-100 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </nav>

      <div className="border-t px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Conversations are kept in this browser tab only and clear on refresh.
      </div>
    </aside>
  );
}