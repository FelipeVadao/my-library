'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Loader2, Send } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { askLibraryAssistant, getAssistantHistory, clearAssistantHistory } from './actions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

const THINKING = '__thinking__';

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAssistantHistory()
      .then((history) => setMessages(history))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: THINKING }]);
    setInput('');
    setLoading(true);

    try {
      const result = await askLibraryAssistant(question);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = result.error
          ? { role: 'assistant', content: result.error, isError: true }
          : { role: 'assistant', content: result.answer ?? '' };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Erro de conexão.',
          isError: true,
        };
        return next;
      });
    }
    setLoading(false);
  }

  async function handleClearHistory() {
    setConfirmClear(false);
    await clearAssistantHistory();
    setMessages([]);
  }

  return (
    <main className="min-h-screen bg-paper text-ink p-6 flex flex-col">
      <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
        <div className="lamp-glow mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold">Melvilinho</h1>
            <p className="text-ink-muted text-sm mt-1">
              Pergunte sobre os livros da sua biblioteca — homenagem a Melvil Dewey.
            </p>
          </div>
          {!historyLoading &&
            messages.length > 0 &&
            (!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="shrink-0 bg-tan hover:bg-border text-ink text-sm font-medium px-3 py-2 rounded-md transition"
              >
                Apagar conversa
              </button>
            ) : (
              <div className="shrink-0 flex gap-2 items-center">
                <span className="text-oxblood-bright text-sm">Confirmar?</span>
                <button
                  onClick={handleClearHistory}
                  className="bg-oxblood hover:bg-oxblood-hover text-ink text-sm font-medium px-3 py-2 rounded-md transition"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="bg-tan hover:bg-border text-ink text-sm font-medium px-3 py-2 rounded-md transition"
                >
                  Não
                </button>
              </div>
            ))}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-lg border border-border bg-paper-card p-4 mb-4 min-h-[50vh] max-h-[60vh]"
        >
          {historyLoading ? null : messages.length === 0 ? (
            <EmptyState icon={MessageCircle} message="Faça uma pergunta sobre sua biblioteca." />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-brass-strong text-on-accent'
                        : m.isError
                        ? 'bg-paper border border-oxblood text-oxblood-bright'
                        : 'bg-paper border border-border text-ink'
                    }`}
                  >
                    {m.content === THINKING ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Pensando...
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            Sua pergunta
          </label>
          <input
            id="assistant-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre seus livros..."
            disabled={loading}
            className="flex-1 bg-paper-card border border-border rounded-md px-4 py-3 text-ink placeholder-ink-muted focus:outline-none focus:border-brass-strong disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Enviar pergunta"
            className="shrink-0 px-4 py-3 rounded-md bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-40 text-on-accent transition"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </main>
  );
}
