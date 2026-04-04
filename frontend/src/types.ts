export interface WalletStats {
  totalSent: number;
  totalReceived: number;
  txCount: number;
}

export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  timestamp: string;
}

export type FlagType = 'splitting' | 'chaining' | 'large' | 'velocity' | 'round_amount';

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Flag {
  type:      FlagType;
  wallet:    string;
  riskScore: number;   // 0–100 wallet-level score
  severity:  Severity;
  detail:    string;   // human-readable explanation
  amount?:   number;
}

export interface RiskProfile {
  wallet:    string;
  riskScore: number;
  severity:  Severity;
  flags:     Omit<Flag, 'wallet' | 'riskScore' | 'severity'>[];
}

export interface WalletData {
  stats:        WalletStats;
  graph:        Graph;
  transactions: Transaction[];
  flags:        Flag[];
  profiles:     RiskProfile[];
}
