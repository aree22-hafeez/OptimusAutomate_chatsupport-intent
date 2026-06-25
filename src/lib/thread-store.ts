import { create } from "zustand";
import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  messages: UIMessage[];
};

type ThreadState = {
  threads: Thread[];
  createThread: () => Thread;
  deleteThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  setMessages: (id: string, messages: UIMessage[]) => void;
  getThread: (id: string) => Thread | undefined;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useThreadStore = create<ThreadState>((set, get) => ({
  threads: [],
  createThread: () => {
    const thread: Thread = {
      id: newId(),
      title: "New conversation",
      createdAt: Date.now(),
      messages: [],
    };
    set((s) => ({ threads: [thread, ...s.threads] }));
    return thread;
  },
  deleteThread: (id) =>
    set((s) => ({ threads: s.threads.filter((t) => t.id !== id) })),
  renameThread: (id, title) =>
    set((s) => ({
      threads: s.threads.map((t) => (t.id === id ? { ...t, title } : t)),
    })),
  setMessages: (id, messages) =>
    set((s) => ({
      threads: s.threads.map((t) => {
        if (t.id !== id) return t;
        let title = t.title;
        if (title === "New conversation" && messages.length > 0) {
          const first = messages.find((m) => m.role === "user");
          if (first) {
            const text = first.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim();
            if (text) title = text.slice(0, 40);
          }
        }
        return { ...t, messages, title };
      }),
    })),
  getThread: (id) => get().threads.find((t) => t.id === id),
}));