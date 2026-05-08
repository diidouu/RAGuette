"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface Source {
  number: number;
  title: string;
  url: string;
  fetched_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Typewriter queue ---
  // When Gemini sends a big chunk ("Les cotisations sociales s'élèvent..."),
  // we don't dump it into the message all at once. Instead we push the
  // characters into this queue, and a timer drains it char by char.
  // This gives a smooth typing effect even when Gemini sends fat chunks.
  const charQueueRef = useRef<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSourcesRef = useRef<Source[] | null>(null);
  const streamDoneRef = useRef(false);

  // Append one character from the queue to the last message
  const drainOneChar = useCallback(() => {
    if (charQueueRef.current.length > 0) {
      // Pull characters in small batches (3 at a time) for speed
      // Pure char-by-char at 15ms = 66 chars/sec which feels too slow
      // 3 chars × 66 ticks/sec = ~200 chars/sec — snappy but readable
      const batch = charQueueRef.current.splice(0, 3).join("");
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, content: last.content + batch };
        return updated;
      });
    } else if (streamDoneRef.current) {
      // Queue is empty and stream is done — attach sources and stop
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (pendingSourcesRef.current) {
        const sources = pendingSourcesRef.current;
        pendingSourcesRef.current = null;
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, sources };
          return updated;
        });
      }
      setIsLoading(false);
    }
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Reset typewriter state
    charQueueRef.current = [];
    pendingSourcesRef.current = null;
    streamDoneRef.current = false;

    // Add user message + an empty assistant message that we'll fill char by char
    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);

    // Start the typewriter timer — drains the queue every 15ms
    intervalRef.current = setInterval(drainOneChar, 15);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) throw new Error("API error");

      // --- Read the SSE stream ---
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload);

              if (parsed.type === "token") {
                // Push characters into the queue — the timer will drain them
                charQueueRef.current.push(...parsed.text.split(""));
              }

              if (parsed.type === "sources") {
                // Hold sources until the typewriter finishes
                pendingSourcesRef.current = parsed.sources;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      }

      // Stream is done — tell the timer to stop once queue is empty
      streamDoneRef.current = true;

    } catch {
      // Stop typewriter on error
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: "Désolé, une erreur est survenue. Réessayez." };
        } else {
          updated.push({ role: "assistant", content: "Désolé, une erreur est survenue. Réessayez." });
        }
        return updated;
      });
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function onSelectSuggestion(text: string) {
    setInput(text);
    textareaRef.current?.focus();
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header — frosted glass */}
      <header
        className="sticky top-0 z-50 flex items-center justify-center px-6 py-4 border-b"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🥖</span>
          <h1
            className="text-base font-semibold tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            RAGuette
          </h1>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onSelectSuggestion={onSelectSuggestion} />
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && messages[messages.length - 1]?.content === "" && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input area — pinned to bottom */}
      <div
        className="sticky bottom-0 border-t px-4 py-4"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex items-end gap-3"
        >
          <div
            className="flex-1 rounded-2xl px-4 py-3 transition-shadow duration-200"
            style={{
              background: "var(--surface-solid)",
              border: "1px solid var(--border)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              rows={1}
              className="w-full resize-none bg-transparent outline-none text-[15px] leading-relaxed placeholder:text-[var(--muted)]"
              style={{ color: "var(--foreground)" }}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:scale-95"
            style={{
              background: "var(--accent)",
              color: "var(--user-text)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--accent)")
            }
          >
            <ArrowUpIcon />
          </button>
        </form>
        <p
          className="text-center text-xs mt-3"
          style={{ color: "var(--muted)" }}
        >
          Informations indicatives uniquement. Consultez un expert-comptable.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

function EmptyState({ onSelectSuggestion }: { onSelectSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6">
      <div className="text-5xl mb-5">🥖</div>
      <h2
        className="text-2xl font-semibold tracking-tight mb-2"
        style={{ color: "var(--foreground)" }}
      >
        RAGuette
      </h2>
      <p
        className="text-center text-[15px] max-w-sm leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        Assistant fiscal pour freelances en France.
        <br />
        Posez vos questions sur la micro-entreprise, la TVA, les cotisations...
      </p>

      <div className="mt-8 grid gap-2.5 w-full max-w-sm">
        <SuggestionChip text="Quel est le plafond de CA en micro-entreprise ?" onSelect={onSelectSuggestion} />
        <SuggestionChip text="Quand dois-je facturer la TVA ?" onSelect={onSelectSuggestion} />
        <SuggestionChip text="What are the social contributions for freelancers?" onSelect={onSelectSuggestion} />
      </div>
    </div>
  );
}

function SuggestionChip({ text, onSelect }: { text: string; onSelect: (text: string) => void }) {
  return (
    <button
      className="w-full text-left px-4 py-3 rounded-xl text-[14px] transition-colors duration-150"
      style={{
        background: "var(--source-chip)",
        color: "var(--foreground)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--source-chip-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "var(--source-chip)")
      }
      onClick={() => onSelect(text)}
    >
      {text}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  // Don't render empty assistant bubbles (they're placeholders for streaming)
  if (!isUser && !message.content && !message.sources?.length) return null;

  return (
    <div
      className={`message-enter flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
            isUser ? "rounded-br-md" : "rounded-bl-md"
          }`}
          style={{
            background: isUser ? "var(--user-bubble)" : "var(--assistant-bubble)",
            color: isUser ? "var(--user-text)" : "var(--assistant-text)",
          }}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Source chips */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {deduplicateSources(message.sources).map((source) => (
              <a
                key={source.number}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors duration-150"
                style={{
                  background: "var(--source-chip)",
                  color: "var(--muted)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--source-chip-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--source-chip)")
                }
              >
                <span style={{ color: "var(--accent)" }} className="font-medium">
                  [{source.number}]
                </span>
                <span className="truncate max-w-[200px]">{source.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start message-enter">
      <div
        className="rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5"
        style={{ background: "var(--assistant-bubble)" }}
      >
        <div
          className="w-2 h-2 rounded-full typing-dot"
          style={{ background: "var(--muted)" }}
        />
        <div
          className="w-2 h-2 rounded-full typing-dot"
          style={{ background: "var(--muted)" }}
        />
        <div
          className="w-2 h-2 rounded-full typing-dot"
          style={{ background: "var(--muted)" }}
        />
      </div>
    </div>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 14V2M8 2L3 7M8 2L13 7" />
    </svg>
  );
}

// =============================================================================
// UTILS
// =============================================================================

function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
