import type { Analysis, BatchRow, ChatMsg, DemoInfo, ExplainResult, Extracted, Health, TxLookup } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error('Cannot reach the RCPT server. Is the backend running?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  health: () => req<Health>('/api/health'),
  demos: () => req<{ demos: DemoInfo[] }>('/api/demos').then(r => r.demos),
  detect: (address: string) =>
    req<{ valid: boolean; chains: { id: string; name: string }[] }>(`/api/detect?address=${encodeURIComponent(address)}`),
  analyze: (p: { address?: string; chain?: string; demo?: string; depth?: number }) => {
    const q = new URLSearchParams();
    if (p.demo) q.set('demo', p.demo);
    else {
      q.set('address', p.address ?? '');
      if (p.chain) q.set('chain', p.chain);
      if (p.depth) q.set('depth', String(p.depth));
    }
    return req<Analysis>(`/api/analyze?${q}`);
  },
  scan: (address: string) =>
    req<{ networks: { id: string; name: string; active: boolean | null; lastSeen?: number | null; error?: string }[] }>(
      `/api/scan?address=${encodeURIComponent(address)}`,
    ),
  extract: (text: string) => req<Extracted>('/api/extract', { method: 'POST', body: JSON.stringify({ text }) }),
  tx: (hash: string) => req<TxLookup>(`/api/tx?hash=${encodeURIComponent(hash)}`),
  batch: (addresses: string[]) => req<{ rows: BatchRow[] }>('/api/batch', { method: 'POST', body: JSON.stringify({ addresses }) }).then(r => r.rows),
  explain: (id: string, audience: 'simple' | 'analyst', language: string) =>
    req<ExplainResult>('/api/explain', { method: 'POST', body: JSON.stringify({ id, audience, language }) }),
  chat: (id: string, question: string, history: ChatMsg[]) =>
    req<{ answer: string; source: 'gemini' | 'offline' }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ id, question, history }),
    }),
};
