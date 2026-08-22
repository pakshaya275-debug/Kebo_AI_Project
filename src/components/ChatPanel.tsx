import { useEffect, useRef, useState } from 'react';
import { Send, Volume2 } from 'lucide-react';
import { EMOTIONS, type Message } from '../types/kebo';

interface ChatPanelProps {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, isThinking, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto kebo-scroll px-1 space-y-3 py-2">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-8 px-4">
            Say something to Kebo. Ask how it's feeling, suggest a game, or just say hi.
          </div>
        )}
        {messages.map((msg) => (
          <Bubble key={msg.id} msg={msg} />
        ))}
        {isThinking && <TypingBubble />}
      </div>

      <form onSubmit={submit} className="mt-2 flex items-center gap-2 rounded-2xl bg-slate-800/70 px-3 py-2 border border-slate-700/60 focus-within:border-emerald-500/60 transition-colors">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Talk to Kebo..."
          className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          className="grid place-items-center h-8 w-8 rounded-xl bg-emerald-500 text-white disabled:opacity-40 hover:bg-emerald-400 active:scale-95 transition-all"
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const isKebo = msg.sender === 'kebo';
  const e = EMOTIONS[msg.emotion];
  const speak = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg.text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => (
      /en/i.test(voice.lang) && /female|samantha|zira|aria|jenny|google us english/i.test(voice.name)
    )) || voices.find((voice) => /en/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.pitch = 1.35;
    utterance.rate = 1.04;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  };
  return (
    <div className={`flex msg-in ${isKebo ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[82%] min-w-0 break-words whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isKebo
            ? 'rounded-bl-md text-slate-100'
            : 'rounded-br-md bg-emerald-500 text-white'
        }`}
        style={isKebo ? { backgroundColor: e.colorSoft + '18', border: `1px solid ${e.color}33` } : undefined}
      >
        {isKebo && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs leading-none">{e.emoji}</span>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: e.color }}>{e.label}</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <p className="min-w-0 flex-1">{msg.text}</p>
          {isKebo && 'speechSynthesis' in window && (
            <button
              type="button"
              onClick={speak}
              className="shrink-0 text-slate-500 hover:text-emerald-300 transition-colors"
              aria-label="Read Kebo message aloud"
              title="Read aloud"
            >
              <Volume2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start msg-in">
      <div className="rounded-2xl rounded-bl-md bg-slate-800/70 border border-slate-700/60 px-4 py-3 flex items-center gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
