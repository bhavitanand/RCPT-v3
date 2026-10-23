import { useCallback, useEffect, useState } from 'react';
import type { Band } from './types';

// ─── saved cases (browser-local; accounts come later) ───────────────────────
export interface SavedCase {
  key: string; // chain:address or demo:id
  address: string;
  chain: string;
  chainName: string;
  demo?: string;
  title: string;
  score: number;
  band: Band;
  prevScore?: number;
  txCount?: number;
  newTx?: number; // transactions seen since the previous check
  note: string;
  savedAt: number;
  checkedAt: number;
}

const KEY = 'rcpt.cases.v3';
const read = (): SavedCase[] => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedCase[]; } catch { return []; }
};
const write = (c: SavedCase[]) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage blocked */ } };

export const caseKey = (chain: string, address: string, demo?: string) => (demo ? `demo:${demo}` : `${chain}:${address}`);

export function useCases() {
  const [cases, setCases] = useState<SavedCase[]>(read);
  useEffect(() => {
    const on = () => setCases(read());
    window.addEventListener('storage', on);
    window.addEventListener('rcpt-cases', on);
    return () => { window.removeEventListener('storage', on); window.removeEventListener('rcpt-cases', on); };
  }, []);
  const commit = useCallback((next: SavedCase[]) => {
    write(next); setCases(next); window.dispatchEvent(new Event('rcpt-cases'));
  }, []);
  const upsert = useCallback((c: Omit<SavedCase, 'savedAt' | 'checkedAt' | 'note' | 'prevScore' | 'newTx'> & { note?: string }) => {
    const cur = read();
    const old = cur.find(x => x.key === c.key);
    const grew = old?.txCount !== undefined && c.txCount !== undefined && c.txCount > old.txCount ? c.txCount - old.txCount : undefined;
    const next: SavedCase = {
      ...c, note: c.note ?? old?.note ?? '', savedAt: old?.savedAt ?? Date.now(), checkedAt: Date.now(),
      prevScore: old && old.score !== c.score ? old.score : old?.prevScore,
      newTx: grew ?? (old?.txCount === c.txCount ? old?.newTx : undefined),
    };
    commit([next, ...cur.filter(x => x.key !== c.key)]);
  }, [commit]);
  const remove = useCallback((key: string) => commit(read().filter(x => x.key !== key)), [commit]);
  const setNote = useCallback((key: string, note: string) => commit(read().map(x => (x.key === key ? { ...x, note } : x))), [commit]);
  return { cases, upsert, remove, setNote };
}

// ─── your own wallet labels (what Arkham-style tools put behind a paywall) ───
const LKEY = 'rcpt.labels.v3';
const readLabels = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(LKEY) ?? '{}') as Record<string, string>; } catch { return {}; }
};

export function useMyLabels(chain: string) {
  const [all, setAll] = useState<Record<string, string>>(readLabels);
  useEffect(() => {
    const on = () => setAll(readLabels());
    window.addEventListener('rcpt-labels', on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener('rcpt-labels', on); window.removeEventListener('storage', on); };
  }, []);
  const k = (a: string) => `${chain}:${a}`;
  const get = (a: string) => all[k(a)] ?? '';
  const set = (a: string, name: string) => {
    const next = { ...readLabels() };
    if (name.trim()) next[k(a)] = name.trim().slice(0, 60); else delete next[k(a)];
    try { localStorage.setItem(LKEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    setAll(next); window.dispatchEvent(new Event('rcpt-labels'));
  };
  const mine = () => Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith(`${chain}:`)).map(([key, v]) => [key.slice(chain.length + 1), v]));
  return { get, set, mine };
}

// ─── tiny hash router: #/report?address=…&chain=… ───────────────────────────
export interface Route { page: 'home' | 'report' | 'batch' | 'cases' | 'learn' | 'status'; params: URLSearchParams }

const parse = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const page = (['report', 'batch', 'cases', 'learn', 'status'] as const).find(p => p === path) ?? 'home';
  return { page, params: new URLSearchParams(query) };
};

export function useRoute() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (page: Route['page'], params?: Record<string, string>) => {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  window.location.hash = `/${page === 'home' ? '' : page}${q}`;
};

export const reportHref = (p: Record<string, string>) => `#/report?${new URLSearchParams(p)}`;
