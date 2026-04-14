"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import FuriganaText from "./FuriganaText";
import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

interface VocabContext {
  word: string;
  reading: string;
  meaning: string;
  partsOfSpeech?: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  vocabContext?: VocabContext;
}

export default function TutorDrawer({ vocabContext }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", streaming: true },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, vocabContext }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Ollama unavailable" }));
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: err.error ?? "Error contacting Ollama." },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            const token = data?.message?.content ?? "";
            if (token) {
              setMessages((prev) => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: last.content + token };
                }
                return msgs;
              });
            }
          } catch {
            // incomplete JSON line — ignore
          }
        }
      }
    } finally {
      // Mark streaming done
      setMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, streaming: false };
        }
        return msgs;
      });
      setLoading(false);
    }
  }, [input, loading, vocabContext]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI tutor"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg font-medium text-sm transition-all hover:scale-105 active:scale-95"
      >
        <ChatIcon />
        Ask AI
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">AI Tutor</h2>
            {vocabContext && (
              <p className="text-xs text-zinc-400 mt-0.5">
                Context: {vocabContext.word} ({vocabContext.reading})
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Context banner */}
        {vocabContext && messages.length === 0 && (
          <div className="mx-4 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 shrink-0">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-1">
              Current word
            </p>
            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
              {vocabContext.word}
              <span className="text-sm font-normal text-zinc-400 ml-2">
                {vocabContext.reading}
              </span>
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{vocabContext.meaning}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_QUESTIONS(vocabContext.word).map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => send(), 0);
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
              <div className="text-4xl">🎌</div>
              <p className="text-zinc-400 text-sm">
                Ask anything about Japanese grammar, usage, or nuance.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <AssistantMessage content={msg.content} streaming={msg.streaming} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about grammar, usage, nuance…"
              disabled={loading}
              className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Send"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 text-white rounded-xl transition-colors font-medium text-sm"
            >
              {loading ? <SpinnerIcon /> : <SendIcon />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Streaming message renderer ────────────────────────────────────────────────

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g);
  
  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          // Block math
          const latex = part.slice(2, -2).trim();
          return <BlockMath key={i} math={latex} errorColor="#ef4444" />;
        } else if (part.startsWith("$") && part.endsWith("$")) {
          // Inline math
          const latex = part.slice(1, -1).trim();
          return <InlineMath key={i} math={latex} errorColor="#ef4444" />;
        } else if (part.trim()) {
          // Regular markdown
          return (
            <ReactMarkdown
              key={i}
              components={{
                p: ({ children }) => <p className="mb-2">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ className, children }) => {
                  const isInline = !className;
                  return isInline 
                    ? <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded text-xs">{children}</code>
                    : <code className={className}>{children}</code>;
                },
                pre: ({ children }) => <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs overflow-x-auto mb-2">{children}</pre>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-md font-semibold mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
              }}
            >
              {part}
            </ReactMarkdown>
          );
        }
        return null;
      })}
      {streaming && (
        <span className="inline-block w-1.5 h-4 bg-zinc-400 dark:bg-zinc-500 rounded-sm animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}

// ── Quick questions ───────────────────────────────────────────────────────────

function QUICK_QUESTIONS(word: string): string[] {
  return [
    `How is ${word} used in a sentence?`,
    `What's the nuance of ${word}?`,
    `What are common mistakes with ${word}?`,
  ];
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
