import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { api } from '../api';
import type { ChatMsg } from '../types';
import { Spinner } from './ui';

const SUGGEST = ['Why is this risky?', 'Where did the money go?', 'What should I do now?', 'Is it safe to send money here?'];

export default function ChatDrawer({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs([]); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy, open]);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = msgs;
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setText(''); setBusy(true);
    try {
      const r = await api.chat(id, q, history);
      setMsgs(m => [...m, { role: 'model', text: r.answer }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'model', text: e instanceof Error ? e.message : 'Something went wrong.' }]);
    } finally { setBusy(false); }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(text); };

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Ask a question about this wallet">
          <MessageCircle size={18} /> Ask about this wallet
        </button>
      )}
      {open && (
        <aside className="chat" aria-label="Ask about this wallet">
          <header>
            <strong>Ask about this wallet</strong>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
          </header>
          <div className="chat-log">
            {msgs.length === 0 && (
              <div className="chat-hint">
                <p className="muted">Ask in your own words. Answers only use what this investigation found.</p>
                <div className="chips">{SUGGEST.map(s => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}
            {busy && <div className="bubble model"><Spinner /></div>}
            <div ref={end} />
          </div>
          <form onSubmit={submit}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a question…" maxLength={400} aria-label="Your question" />
            <button className="btn btn-primary" type="submit" disabled={busy} aria-label="Send"><Send size={15} /></button>
          </form>
        </aside>
      )}
    </>
  );
}
