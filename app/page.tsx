"use client";

import { useState, useRef, useEffect } from "react";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "¿Cuáles son los horarios?",
  "¿Tienen delivery?",
  "¿Cuánto cuesta un latte?",
  "¿Tienen opciones veganas?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const userMessage = text.trim();
    if (!userMessage || isLoading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Placeholder para el streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("Error en la respuesta del servidor");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content:
            "Lo siento, hubo un problema al procesar tu mensaje. Por favor intentá de nuevo.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function renderWithLinks(text: string) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const parts = text.split(urlRegex);
    const matches = text.match(urlRegex) ?? [];
    return parts.flatMap((part, i) => {
      const nodes: React.ReactNode[] = [part];
      if (matches[i]) {
        nodes.push(
          <a
            key={i}
            href={matches[i]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-amber-700 hover:text-amber-900 break-all"
          >
            {matches[i]}
          </a>
        );
      }
      return nodes;
    });
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          OC
        </div>
        <div>
          <h1 className="font-semibold text-stone-800 leading-tight">
            Oli Café
          </h1>
          <p className="text-xs text-stone-500">Atención al cliente · En línea</p>
        </div>
      </header>

      {/* Mensajes */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-3xl">
              ☕
            </div>
            <div>
              <h2 className="text-xl font-semibold text-stone-700 mb-1">
                ¡Hola! ¿En qué te puedo ayudar?
              </h2>
              <p className="text-stone-500 text-sm max-w-xs">
                Preguntame sobre nuestro menú, horarios, delivery o cualquier
                otra cosa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-full text-sm text-stone-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 mr-2">
                    OC
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-500 text-white rounded-tr-sm"
                      : "bg-white border border-stone-200 text-stone-700 rounded-tl-sm shadow-sm"
                  }`}
                >
                  {msg.content === "" && msg.role === "assistant" ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{renderWithLinks(msg.content)}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <footer className="bg-white border-t border-stone-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu pregunta..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: "42px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            aria-label="Enviar mensaje"
          >
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-stone-400 mt-2">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </footer>
    </div>
  );
}
