import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { Download, Maximize2, Pause, Play, X } from 'lucide-react';
import type { Analysis, GraphNode } from '../types';
import { fmtDateTime, fmtUsd } from '../lib';
import { useMyLabels } from '../store';
import { Addr, LabelEditor, Pill } from './ui';

cytoscape.use(dagre);

const C = {
  ink: '#101731', line: '#cfcdc2', paper: '#fffef9',
  danger: '#d93a45', orange: '#e0702b', caution: '#c98a1c', safe: '#2e9e6b', info: '#2f5bd8', mixer: '#6d1f2c',
};
const MAX_NODES = 140;

function nodeColor(n: GraphNode) {
  if (n.category === 'exchange') return C.info;
  if (n.category && n.category !== 'bridge' && n.category !== 'service') return C.mixer;
  if (n.severity === 'HIGH') return C.danger;
  if (n.severity === 'MEDIUM') return C.orange;
  if (n.severity === 'LOW') return C.caution;
  return '#e9e7dc';
}

export default function MoneyMap({ a }: { a: Analysis }) {
  const host = useRef<HTMLDivElement>(null);
  const cy = useRef<cytoscape.Core | null>(null);
  const [selected, setSelected] = useState<string | null>(a.meta.address);
  const my = useMyLabels(a.meta.chain);
  const [focus, setFocus] = useState(false); // dim everything but the clicked wallet's neighbourhood
  const [onlyRisky, setOnlyRisky] = useState(false);
  const [playing, setPlaying] = useState(false);

  const { nodes, edges, trimmed } = useMemo(() => {
    let ns = a.graph.nodes;
    let trimmed = 0;
    if (ns.length > MAX_NODES) {
      const keep = new Set([...ns].sort((x, y) => Number(y.isTarget) - Number(x.isTarget) || y.riskScore - x.riskScore || y.volumeUsd - x.volumeUsd).slice(0, MAX_NODES).map(n => n.id));
      trimmed = ns.length - keep.size;
      ns = ns.filter(n => keep.has(n.id));
    }
    const ids = new Set(ns.map(n => n.id));
    return { nodes: ns, edges: a.graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)), trimmed };
  }, [a]);

  const [tMin, tMax] = useMemo(() => {
    const ts = edges.flatMap(e => e.events.map(v => v.ts));
    return [Math.min(...ts), Math.max(...ts)];
  }, [edges]);
  const [t, setT] = useState(tMax);
  useEffect(() => setT(tMax), [tMax]);

  // build graph
  useEffect(() => {
    if (!host.current) return;
    const g = cytoscape({
      container: host.current,
      elements: [
        ...nodes.map(n => ({ data: { id: n.id, label: n.isTarget ? 'Investigated' : n.labelName ?? n.label, color: nodeColor(n), size: n.isTarget ? 54 : 26 + Math.min(18, Math.log10(1 + n.volumeUsd) * 3), target: n.isTarget ? 1 : 0, dark: n.severity === 'HIGH' || n.category ? 1 : 0 } })),
        ...edges.map(e => ({ data: { id: e.id, source: e.source, target: e.target, w: Math.max(1.5, Math.min(9, Math.log10(1 + (e.usd || e.amount * 100)) * 1.6)), first: Math.min(...e.events.map(v => v.ts)) } })),
      ],
      style: [
        { selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', width: 'data(size)', height: 'data(size)', 'font-size': 10, 'font-family': 'Inter, sans-serif', color: C.ink, 'text-valign': 'bottom', 'text-margin-y': 5, 'text-wrap': 'ellipsis', 'text-max-width': '96px', 'border-width': 1.5, 'border-color': '#b9b7aa' } },
        { selector: 'node[target = 1]', style: { 'border-width': 4, 'border-color': C.ink, 'font-weight': 700, 'font-size': 11 } },
        { selector: 'edge', style: { width: 'data(w)', 'line-color': '#c9c7ba', 'target-arrow-color': '#a9a79a', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'arrow-scale': 0.9, opacity: 0.9 } },
        { selector: '.faded', style: { opacity: 0.12 } },
        { selector: '.hidden', style: { display: 'none' } },
        { selector: ':selected', style: { 'border-width': 4, 'border-color': C.danger } },
        { selector: 'edge.hot', style: { 'line-color': C.danger, 'target-arrow-color': C.danger, opacity: 1 } },
      ],
      layout: { name: 'dagre', rankDir: 'LR', nodeSep: 28, rankSep: 90, padding: 24 } as cytoscape.LayoutOptions,
      wheelSensitivity: 0.25,
      minZoom: 0.2,
      maxZoom: 2.5,
    });
    g.on('tap', 'node', evt => { setSelected(evt.target.id()); setFocus(true); });
    g.on('tap', evt => { if (evt.target === g) { setSelected(null); setFocus(false); } });
    cy.current = g;
    return () => { g.destroy(); cy.current = null; };
  }, [nodes, edges]);

  // time scrub + risky filter + selection highlight
  useEffect(() => {
    const g = cy.current;
    if (!g) return;
    g.batch(() => {
      g.edges().forEach(e => {
        const hide = (e.data('first') as number) > t;
        e.toggleClass('hidden', hide);
      });
      g.nodes().forEach(n => {
        const gn = nodes.find(x => x.id === n.id());
        const visibleEdges = n.connectedEdges().filter(e => !e.hasClass('hidden')).length;
        const risky = !!gn && (gn.isTarget || gn.severity === 'HIGH' || gn.severity === 'MEDIUM' || !!gn.category);
        n.toggleClass('hidden', (visibleEdges === 0 && !gn?.isTarget) || (onlyRisky && !risky));
      });
      g.edges().forEach(e => {
        if (e.source().hasClass('hidden') || e.target().hasClass('hidden')) e.addClass('hidden');
      });
      g.elements().removeClass('faded hot');
      if (selected && focus) {
        const n = g.getElementById(selected);
        if (n.nonempty()) {
          const hood = n.closedNeighborhood();
          g.elements().not(hood).addClass('faded');
          n.connectedEdges().addClass('hot');
        }
      }
    });
  }, [t, onlyRisky, selected, focus, nodes, edges]);

  // playback
  useEffect(() => {
    if (!playing) return;
    if (t >= tMax) setT(tMin);
    const step = Math.max((tMax - tMin) / 60, 1);
    const id = setInterval(() => {
      setT(cur => {
        if (cur + step >= tMax) { setPlaying(false); return tMax; }
        return cur + step;
      });
    }, 120);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, tMin, tMax]);

  const sel = nodes.find(n => n.id === selected) ?? null;
  const profile = a.profiles.find(p => p.wallet === selected);
  const flags = a.flags.filter(f => f.wallet === selected);
  const cp = a.counterparties.find(c => c.address === selected);

  const png = () => {
    const uri = cy.current?.png({ full: true, scale: 2, bg: C.paper });
    if (!uri) return;
    const link = Object.assign(document.createElement('a'), { href: uri, download: 'rcpt-money-map.png' });
    link.click();
  };

  return (
    <div className="map card">
      <div className="map-toolbar">
        <div className="legend">
          <span><i style={{ background: C.ink }} />Investigated</span>
          <span><i style={{ background: C.danger }} />High risk</span>
          <span><i style={{ background: C.orange }} />Medium</span>
          <span><i style={{ background: C.mixer }} />Watchlisted / mixer</span>
          <span><i style={{ background: C.info }} />Exchange</span>
          <span><i style={{ background: '#e9e7dc', border: '1px solid #b9b7aa' }} />Other</span>
        </div>
        <div className="map-tools">
          <label className="toggle"><input type="checkbox" checked={onlyRisky} onChange={e => setOnlyRisky(e.target.checked)} /> Only risky wallets</label>
          <button className="icon-btn" onClick={() => cy.current?.fit(undefined, 30)} title="Fit to screen" aria-label="Fit to screen"><Maximize2 size={15} /></button>
          <button className="icon-btn" onClick={png} title="Download image" aria-label="Download image"><Download size={15} /></button>
        </div>
      </div>

      <div className="map-body">
        <div className="map-canvas" ref={host} role="img" aria-label="Interactive map of money movement between wallets" />
        {sel && (
          <aside className="map-panel">
            <button className="icon-btn map-close" onClick={() => setSelected(null)} aria-label="Close"><X size={14} /></button>
            <h3>{sel.isTarget ? 'Investigated wallet' : sel.labelName ?? 'Wallet'}</h3>
            <Addr address={sel.id} url={a.meta.source === 'live' ? a.meta.explorerUrl.replace(a.meta.address, sel.id) : undefined} />
            <LabelEditor value={my.get(sel.id)} onSave={v => my.set(sel.id, v)} />
            <div className="map-pills">
              {sel.severity ? <Pill tone={sel.severity === 'HIGH' ? 'danger' : sel.severity === 'MEDIUM' ? 'orange' : 'caution'}>{sel.severity.toLowerCase()} risk · {sel.riskScore}</Pill> : <Pill tone="safe">no warning signs</Pill>}
              {sel.category && <Pill tone="danger">{sel.category.replace('_', ' ')}</Pill>}
            </div>
            <dl className="mini-stats">
              <div><dt>Payments</dt><dd>{sel.txCount}</dd></div>
              <div><dt>Volume</dt><dd>{fmtUsd(sel.volumeUsd)}</dd></div>
              {cp && <div><dt>Sent to it</dt><dd>{fmtUsd(cp.sentUsd)}</dd></div>}
              {cp && <div><dt>Got from it</dt><dd>{fmtUsd(cp.receivedUsd)}</dd></div>}
            </dl>
            {profile ? (
              <ul className="flag-mini">
                {flags.filter(f => f.score > 0).slice(0, 5).map((f, i) => (
                  <li key={i}><strong>{f.title}</strong><span>{f.detail}</span></li>
                ))}
              </ul>
            ) : <p className="muted small">Nothing unusual about how this wallet behaved in the data we could see.</p>}
          </aside>
        )}
      </div>

      <div className="scrub">
        <button className="icon-btn" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause replay' : 'Replay the money moving'}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <input type="range" min={tMin} max={tMax} step={Math.max(1, Math.round((tMax - tMin) / 200))} value={t}
          onChange={e => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="Time" />
        <span className="small muted">{t >= tMax ? 'All activity' : `Up to ${fmtDateTime(t)}`}</span>
      </div>
      {trimmed > 0 && <p className="small muted map-note">Showing the {MAX_NODES} most relevant of {a.graph.nodes.length} wallets so the map stays readable.</p>}
    </div>
  );
}
