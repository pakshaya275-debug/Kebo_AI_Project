import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { EMOTIONS, type Message } from '../types/kebo';

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
}

const STARTER_PROMPTS = [
  'Do you remember me?',
  'How are you feeling?',
  "Let's play!",
  'Tell me something about yourself.',
];

/** Show a timestamp label if this message is the first, or 5+ min after the previous. */
function shouldShowTimestamp(msg: Message, prev: Message | undefined): boolean {
  if (!prev) return true;
  return msg.createdAt - prev.createdAt > 5 * 60 * 1000;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({ messages, isThinking, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages / thinking state
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const submit = () => {
    if (!input.trim() || isThinking) return;
    onSend(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleStarterPrompt = (prompt: string) => {
    onSend(prompt);
  };

  const canSend = input.trim().length > 0 && !isThinking;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto kebo-scroll px-2 py-3 space-y-1"
      >
        {/* Empty state */}
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4 gap-5">
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl select-none">🌱</span>
              <h3 className="text-base font-semibold text-slate-200">Hi, I'm Kebo</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[220px]">
                Your AI companion with memory, emotions and personality.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Try saying…</p>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleStarterPrompt(prompt)}
                  className="text-left text-xs px-3.5 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-all duration-200"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showTs = shouldShowTimestamp(msg, prev);
          return (
            <div key={msg.id}>
              {showTs && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] text-slate-600 bg-white/[0.04] px-2.5 py-0.5 rounded-full">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              )}
              <Bubble msg={msg} />
            </div>
          );
        })}

        {/* Typing indicator */}
        {isThinking && <TypingBubble />}
      </div>

      {/* Input area */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="mt-2 flex items-end gap-2 rounded-2xl bg-slate-800/70 px-3 py-2.5 border border-slate-700/60 focus-within:border-emerald-500/50 transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Kebo…"
          rows={1}
          className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500 resize-none leading-relaxed kebo-textarea"
          style={{ maxHeight: '120px' }}
          disabled={isThinking}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="shrink-0 grid place-items-center h-8 w-8 rounded-xl bg-emerald-500 text-white disabled:opacity-30 hover:bg-emerald-400 active:scale-95 transition-all mb-0.5"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>
      <p className="text-center text-[10px] text-slate-700 mt-1.5">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const isKebo = msg.sender === 'kebo';
  const e = EMOTIONS[msg.emotion];

  if (!isKebo) {
    // User bubble — right aligned
    return (
      <div className="flex justify-end msg-in">
        <div className="max-w-[78%] min-w-0 break-words whitespace-pre-wrap rounded-2xl rounded-br-md bg-emerald-600 text-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          {msg.text}
        </div>
      </div>
    );
  }

  // Kebo bubble — left aligned with avatar
  return (
    <div className="flex items-end gap-2 msg-in">
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-bold mb-0.5 shadow"
        style={{ background: `${e.colorSoft}33`, border: `1px solid ${e.color}44` }}
        aria-hidden="true"
      >
        🌱
      </div>

      {/* Bubble */}
      <div
        className="max-w-[78%] min-w-0 break-words whitespace-pre-wrap rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed shadow-sm"
        style={{ backgroundColor: `${e.colorSoft}14`, border: `1px solid ${e.color}2a` }}
      >
        {/* Emotion header */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs leading-none" aria-hidden="true">{e.emoji}</span>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: e.color }}>
            {e.label}
          </span>
        </div>
        <p className="text-slate-100">{msg.text}</p>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 msg-in">
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm mb-0.5 bg-emerald-900/40 border border-emerald-700/30">
        🌱
      </div>
      {/* Bubble */}
      <div className="rounded-2xl rounded-bl-md bg-slate-800/60 border border-slate-700/50 px-4 py-3">
        <p className="text-[11px] text-slate-400 mb-2 font-medium">Kebo is thinking…</p>
        <div className="flex items-center gap-1">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animationDelay: '150ms' }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
