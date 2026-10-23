import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Info, ShieldAlert } from 'lucide-react';
import { STAGES, download } from '../lib';
import { buildEvidencePack } from '../evidencePack';
import { api } from '../api';
import type { Analysis, ExplainResult } from '../types';
import { caseKey, go, useCases, useMyLabels } from '../store';
import Pipeline from '../components/Pipeline';
import VerdictHero from '../components/VerdictHero';
import ExplainCard, { type Audience } from '../components/ExplainCard';
const MoneyMapLazy = lazy(() => import('../components/MoneyMap'));
const MoneyMap = (props: { a: Analysis }) => (
  <Suspense fallback={<div className="card section muted"><Spinner /> Drawing the map…</div>}>
    <MoneyMapLazy {...props} />
  </Suspense>
);
import ActivityTab from '../components/ActivityTab';
import PeopleTab from '../components/PeopleTab';
import EvidenceTab from '../components/EvidenceTab';
import ChatDrawer from '../components/ChatDrawer';
import { Section, Spinner } from '../components/ui';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; a: Analysis };
type Ex = { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; data: ExplainResult };
const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'map', label: 'Money map' },
  { id: 'activity', label: 'Activity' },
  { id: 'people', label: 'Where it went' },
  { id: 'evidence', label: 'Why flagged' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export default function ReportPage({ params }: { params: URLSearchParams }) {
  const address = params.get('address') ?? '';
  const chain = params.get('chain') ?? 'auto';
  const demo = params.get('demo') ?? '';
  const depth = params.get('depth') === '2' ? 2 : 1;
  const paramKey = `${address}|${chain}|${demo}|${depth}`;

  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [ex, setEx] = useState<Ex>({ status: 'loading' });
  const [stage, setStage] = useState(0);
  const [tab, setTab] = useState<Tab>('summary');
  const [audience, setAudience] = useState<Audience>('simple');
  const [language, setLanguage] = useState('English');
  const [scan, setScan] = useState<{ id: string; name: string; active: boolean | null; error?: string }[] | null>(null);
  const { cases, upsert } = useCases();
  const myLabels = useMyLabels(load.status === 'done' ? load.a.meta.chain : '');
  const run = useRef(0);

  // run analysis whenever the URL parameters change
  useEffect(() => {
    const my = ++run.current;
    setLoad({ status: 'loading' }); setEx({ status: 'loading' }); setStage(0); setTab('summary'); setScan(null);
    const timer = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 2)), 1100);
    (async () => {
      try {
        const a = await api.analyze(demo ? { demo } : { address, chain, depth });
        if (run.current !== my) return;
        clearInterval(timer);
        setStage(STAGES.length - 1);
        setLoad({ status: 'done', a });
      } catch (e) {
        if (run.current !== my) return;
        clearInterval(timer);
        setLoad({ status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    })();
    return () => clearInterval(timer);
  }, [paramKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // explanation (re-fetched when the audience toggles)
  const analysisId = load.status === 'done' ? load.a.id : null;
  useEffect(() => {
    if (!analysisId) return;
    let live = true;
    setEx({ status: 'loading' });
    api.explain(analysisId, audience, language)
      .then(data => live && setEx({ status: 'done', data }))
      .catch(e => live && setEx({ status: 'error', message: e instanceof Error ? e.message : 'Could not write the explanation.' }));
    return () => { live = false; };
  }, [analysisId, audience, language]);

  const a = load.status === 'done' ? load.a : null;
  const key = a ? caseKey(a.meta.chain, a.meta.address, a.meta.demoId) : '';
  const saved = !!a && cases.some(c => c.key === key);
  const prev = a ? cases.find(c => c.key === key) : undefined;

  // remember the score as it was when this analysis first rendered, before the save effect refreshes it
  const movedRef = useRef<{ id: string; prev?: number }>({ id: '' });
  if (a && movedRef.current.id !== a.id) {
    movedRef.current = { id: a.id, prev: prev && prev.score !== a.verdict.score ? prev.score : undefined };
  }

  const save = useCallback(() => {
    if (!a) return;
    upsert({ key, address: a.meta.address, chain: a.meta.chain, chainName: a.meta.chainName, demo: a.meta.demoId, title: a.meta.demoTitle ?? '', score: a.verdict.score, band: a.verdict.band, txCount: a.stats.txCount });
  }, [a, key, upsert]);

  const exportPack = useCallback(async () => {
    if (!a) return;
    const html = await buildEvidencePack(a, ex.status === 'done' ? ex.data.explanation : null, myLabels.mine(), cases.find(c => c.key === key)?.note ?? '');
    download(`rcpt-evidence-${a.meta.address.slice(0, 10)}.html`, html, 'text/html');
  }, [a, ex, myLabels, cases, key]);

  // keep a saved case's score fresh whenever it is re-checked
  useEffect(() => { if (a && saved) save(); }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (load.status === 'loading') {
    return (
      <main className="page narrow">
        <Pipeline stage={stage} address={demo ? 'a simulated sample' : address} />
      </main>
    );
  }

  if (load.status === 'error') {
    return (
      <main className="page narrow">
        <div className="card error-card" role="alert">
          <AlertTriangle size={26} />
          <h2>We couldn't complete that check</h2>
          <p>{load.message}</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => go('home')}><ArrowLeft size={16} /> Try another address</button>
            <button className="btn btn-ghost" onClick={() => go('report', { demo: 'ransomware' })}>See a sample investigation</button>
          </div>
        </div>
      </main>
    );
  }

  const data = load.a;
  const moved = movedRef.current.id === data.id ? movedRef.current.prev : undefined;
  const evmAddr = data.meta.chain !== 'bitcoin' && data.meta.chain !== 'solana' && data.meta.chain !== 'tron';

  return (
    <main className="page">
      <VerdictHero
        a={data}
        saved={saved}
        onSave={save}
        onPack={exportPack}
        onDeeper={data.meta.source === 'live' && (data.meta.depth ?? 1) < 2 ? () => go('report', { address: data.meta.address, chain: data.meta.chain, depth: '2' }) : undefined}
        onScan={data.meta.source === 'live' && evmAddr ? () => api.scan(data.meta.address).then(r => setScan(r.networks)).catch(() => setScan([])) : undefined}
        scan={scan}
      />

      {moved !== undefined && (
        <p className="notice"><Info size={15} /> Score changed from {moved} to {data.verdict.score} since you last saved this case.</p>
      )}
      {data.meta.warnings.length > 0 && (
        <div className={`notice ${data.meta.source === 'demo' ? 'notice-demo' : ''}`} role="note">
          <Info size={15} />
          <div>{data.meta.warnings.map((w, i) => <p key={i}>{w}</p>)}{data.meta.truncated && <p>Only the most recent transactions were analysed. Older history is not included.</p>}</div>
        </div>
      )}

      {data.verdict.score >= 40 && data.meta.source === 'live' && (
        <div className="notice notice-warn" role="note">
          <ShieldAlert size={15} />
          <p><strong>Beware of "recovery" services.</strong> If money was lost, anyone who contacts you offering to recover it for a fee is almost certainly a second scam. Real recovery only happens through police and the exchanges involved. Keep this report's evidence pack and report it.</p>
        </div>
      )}

      <nav className="tabs" role="tablist" aria-label="Report sections">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}
            {t.id === 'evidence' && data.flags.filter(f => f.score > 0).length > 0 && <span className="count">{data.flags.filter(f => f.score > 0).length}</span>}
          </button>
        ))}
      </nav>

      <div className="tab-panel" role="tabpanel">
        {tab === 'summary' && (
          <div className="stack">
            <ExplainCard state={ex} audience={audience} onAudience={setAudience} language={language} onLanguage={setLanguage} />
            <Section title="The shape of the money" hint="Each circle is a wallet. Arrows show money moving. Red means more suspicious. Press play to watch it unfold in order.">
              <MoneyMap a={data} />
            </Section>
          </div>
        )}
        {tab === 'map' && <MoneyMap a={data} />}
        {tab === 'activity' && <ActivityTab a={data} />}
        {tab === 'people' && <PeopleTab a={data} />}
        {tab === 'evidence' && <EvidenceTab a={data} />}
      </div>

      <footer className="disclaimer">
        RCPT reads public blockchain data only. Scores come from fixed rules and show patterns, not proof of a crime or who owns a wallet. Do not rely on this alone for legal or financial decisions.
      </footer>
      <ChatDrawer id={data.id} />
    </main>
  );
}
