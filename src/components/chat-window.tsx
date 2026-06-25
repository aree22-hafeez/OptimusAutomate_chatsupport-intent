import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import logo from "@/assets/shopbot-logo.png";
import { useThreadStore } from "@/lib/thread-store";

const SUGGESTIONS = [
  "Where's my order #1001?",
  "I'd like to return order 1003",
  "Tell me about the linen tee",
  "Do you ship to Canada?",
];

export function ChatWindow({ threadId }: { threadId: string }) {
  const thread = useThreadStore((s) => s.getThread(threadId));
  const setMessages = useThreadStore((s) => s.setMessages);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: thread?.messages ?? [],
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    setMessages(threadId, messages as UIMessage[]);
  }, [messages, threadId, setMessages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (msg: PromptInputMessage) => {
    const text = msg.text?.trim();
    if (!text) return;
    void sendMessage({ text });
  };

  const handleSuggestion = (text: string) => {
    void sendMessage({ text });
  };

  return (
    <div className="flex h-screen flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold">Customer support</h1>
          <p className="text-xs text-muted-foreground">
            Orders · Returns · Shipping · Product info
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Online
        </div>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-6">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={
                <img
                  src={logo}
                  alt="Shopbot"
                  width={80}
                  height={80}
                  className="h-20 w-20"
                />
              }
              title="Hi, I'm Shopbot"
              description="Ask me about an order, a return, shipping, or any product in our catalog."
            >
              <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="rounded-md border bg-card px-3 py-2 text-left text-sm text-foreground/80 transition hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent variant={m.role === "user" ? "contained" : "flat"}>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={i}
                        className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-ul:my-2"
                      >
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    );
                  }
                  if (part.type?.startsWith("tool-")) {
                    const tp = part as {
                      type: string;
                      state: "input-streaming" | "input-available" | "output-available" | "output-error";
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                      toolCallId: string;
                    };
                    return (
                      <Tool key={i} defaultOpen={false} className="my-2">
                        <ToolHeader type={tp.type as `tool-${string}`} state={tp.state} />
                        <ToolContent>
                          <ToolInput input={tp.input} />
                          <ToolOutput
                            output={
                              tp.output ? (
                                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                                  {JSON.stringify(tp.output, null, 2)}
                                </pre>
                              ) : null
                            }
                            errorText={tp.errorText}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent variant="flat">
                <Shimmer>Thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}

          {error && (
            <div className="mx-auto mt-2 max-w-md rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error.message || "Something went wrong. Please try again."}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-card px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Ask about an order, return, product…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={isLoading && !status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}