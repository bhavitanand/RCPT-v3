export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
export type Band = 'high' | 'suspicious' | 'unusual' | 'ordinary';

export interface Label {
  name: string;
  category: string;
  categoryLabel: string;
  risk: number;
  tone: 'danger' | 'caution' | 'info';
  source: string;
}

export interface Flag {
  type: string;
  title: string;
  wallet: string;
  score: number;
  riskScore: number;
  severity: Severity;
  detail: string;
  plain: string;
  evidence: string[];
  usd?: number;
  path?: string[];
  label?: Label;
}

export interface Profile {
  wallet: string;
  riskScore: number;
  severity: Severity;
  flags: Omit<Flag, 'wallet' | 'riskScore' | 'severity' | 'title'>[];
}

export interface GraphNode {
  id: string;
  label: string;
  isTarget: boolean;
  riskScore: number;
  severity: Severity | null;
  category: string | null;
  labelName: string | null;
  txCount: number;
  volumeUsd: number;
}

export interface EdgeEvent { ts: number; amount: number; usd: number | null; hash: string }
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  symbol: string;
  amount: number;
  usd: number;
  events: EdgeEvent[];
}

export interface Tx {
  hash: string;
  from: string;
  to: string;
  amount: number;
  usd: number | null;
  symbol: string;
  token: string | null;
  timestamp: number;
  direction: 'in' | 'out';
  explorerUrl: string;
}

export interface Counterparty {
  address: string;
  sentUsd: number;
  receivedUsd: number;
  sent: number;
  received: number;
  txCount: number;
  firstTs: number;
  lastTs: number;
  label: Label | null;
  explorerUrl: string;
}

export interface Analysis {
  id: string;
  meta: {
    chain: string;
    chainName: string;
    symbol: string;
    address: string;
    explorerUrl: string;
    source: 'live' | 'demo';
    fetchedAt: number;
    truncated: boolean;
    priceSource: 'live' | 'approx';
    nativePriceUsd: number;
    balance: number | null;
    warnings: string[];
    depth?: number;
    followedWallets?: number;
    demoId?: string;
    demoTitle?: string;
  };
  verdict: { score: number; band: Band; label: string; headline: string; signals: number };
  linked: { addresses: string[]; transactions: number; basis: string } | null;
  stats: {
    txCount: number;
    totalSentUsd: number;
    totalReceivedUsd: number;
    byAsset: { symbol: string; sent: number; received: number; count: number }[];
    uniqueCounterparties: number;
    firstSeen: number | null;
    lastSeen: number | null;
  };
  counterparties: Counterparty[];
  outflow: { exchange: number; mixer: number; flagged: number; bridge: number; unlabelled: number };
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  transactions: Tx[];
  flags: Flag[];
  profiles: Profile[];
  patterns: Record<string, { title: string; short: string; why: string }>;
}

export interface Explanation {
  headline: string;
  tldr: string;
  story: { title: string; text: string }[];
  meaning: string;
  nextSteps: string[];
  jargon: { term: string; meaning: string }[];
  caveats: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ExplainResult {
  source: 'gemini' | 'offline';
  model: string | null;
  explanation: Explanation;
  note?: string;
}

export interface Health {
  ok: boolean;
  version: string;
  gemini: boolean;
  geminiModel: string | null;
  ransomwhere: { loaded: number; updatedAt: number | null; error: string | null };
  chains: { id: string; name: string; symbol: string; family: string; ready: boolean }[];
}

export interface Extracted {
  addresses: { address: string; chains: { id: string; name: string }[] }[];
  hashes: { hash: string; kind: 'evm' | 'hex64' | 'solana' }[];
}

export interface TxLookup {
  hash: string;
  network: string;
  networkName: string;
  time: number | null;
  transfers: { from: string; to: string; amount: number; symbol: string }[];
  note: string | null;
}

export interface BatchRow {
  address: string;
  chain?: string;
  chainName?: string;
  score?: number;
  band?: Band;
  label?: string;
  txCount?: number;
  receivedUsd?: number;
  top?: string[];
  error?: string;
}

export interface DemoInfo { id: string; title: string; blurb: string; chain: string }
export interface ChatMsg { role: 'user' | 'model'; text: string }
