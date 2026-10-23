import { Check } from 'lucide-react';

import { STAGES } from '../lib';

export default function Pipeline({ stage, address }: { stage: number; address: string }) {
  return (
    <div className="pipeline card" aria-live="polite">
      <h2>Tracing {address.length > 24 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address}</h2>
      <p className="muted">This usually takes a few seconds. We never ask for keys or move any money; everything here is read-only.</p>
      <ol>
        {STAGES.map((s, i) => {
          const state = i < stage ? 'done' : i === stage ? 'active' : 'todo';
          return (
            <li key={s.title} className={`pl-${state}`}>
              <span className="pl-dot">{state === 'done' ? <Check size={13} /> : i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <span>{s.detail}</span>
              </div>
              {state === 'active' && <span className="pl-bar" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
