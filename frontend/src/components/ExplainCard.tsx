import { Sparkles, Lightbulb, ListChecks, AlertCircle, Languages } from 'lucide-react';
import type { ExplainResult } from '../types';
import { LANGUAGES } from '../lib';
import { Pill, Rich, Spinner } from './ui';

export type Audience = 'simple' | 'analyst';

export default function ExplainCard({
  state, audience, onAudience, language, onLanguage,
}: {
  state: { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; data: ExplainResult };
  audience: Audience;
  onAudience: (a: Audience) => void;
  language: string;
  onLanguage: (l: string) => void;
}) {
  return (
    <section className="card explain">
      <header className="explain-head">
        <div className="explain-title">
          <Sparkles size={18} />
          <h2>In plain English</h2>
          {state.status === 'done' && (
            <Pill tone={state.data.source === 'gemini' ? 'info' : 'neutral'}>
              {state.data.source === 'gemini' ? 'Written by Gemini' : 'Built-in explainer'}
            </Pill>
          )}
        </div>
        <div className="explain-tools">
          <label className="chip-select" title="Gemini translates the explanation. The built-in explainer is English only.">
            <Languages size={14} />
            <select value={language} onChange={e => onLanguage(e.target.value)} aria-label="Language">
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <div className="seg" role="group" aria-label="Explanation style">
            <button className={audience === 'simple' ? 'on' : ''} onClick={() => onAudience('simple')}>Simple</button>
            <button className={audience === 'analyst' ? 'on' : ''} onClick={() => onAudience('analyst')}>Analyst</button>
          </div>
        </div>
      </header>

      {state.status === 'loading' && (
        <div className="skeleton" aria-busy="true">
          <p className="muted"><Spinner /> Writing the explanation…</p>
          <span /><span /><span className="short" />
        </div>
      )}

      {state.status === 'error' && <p className="form-err">{state.message}</p>}

      {state.status === 'done' && (() => {
        const e = state.data.explanation;
        return (
          <div className="explain-body">
            <p className="tldr"><Rich text={e.tldr} /></p>

            <ol className="story">
              {e.story.map((s, i) => (
                <li key={i}>
                  <span className="story-n">{i + 1}</span>
                  <div><strong>{s.title}</strong><p><Rich text={s.text} /></p></div>
                </li>
              ))}
            </ol>

            {e.meaning && (
              <div className="callout">
                <Lightbulb size={16} />
                <p><Rich text={e.meaning} /></p>
              </div>
            )}

            {e.nextSteps.length > 0 && (
              <div className="next">
                <h3><ListChecks size={16} /> What to do next</h3>
                <ul>{e.nextSteps.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}

            {e.jargon.length > 0 && (
              <details className="jargon">
                <summary>Words used here ({e.jargon.length})</summary>
                <dl>{e.jargon.map(j => <div key={j.term}><dt>{j.term}</dt><dd>{j.meaning}</dd></div>)}</dl>
              </details>
            )}

            <footer className="caveats">
              <AlertCircle size={14} />
              <span>
                {e.caveats.join(' ')} <em>Confidence: {e.confidence}.</em>
                {state.data.note ? ` ${state.data.note}` : ''}
              </span>
            </footer>
          </div>
        );
      })()}
    </section>
  );
}
