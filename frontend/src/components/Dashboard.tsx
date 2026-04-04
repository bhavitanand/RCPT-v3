import { useState } from 'react';
import axios from 'axios';
import { Search, Activity, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { WalletData, Flag, RiskProfile } from '../types';

interface DashboardProps {
  walletData:         WalletData | null;
  setWalletData:      (data: WalletData | null) => void;
  searchedAddress:    string;
  setSearchedAddress: (address: string) => void;
}

// ─── severity helpers ────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, React.CSSProperties> = {
  HIGH:   { backgroundColor: 'rgba(220,38,38,0.15)',  color: '#ef4444', border: '1px solid rgba(220,38,38,0.3)'  },
  MEDIUM: { backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' },
  LOW:    { backgroundColor: 'rgba(234,179,8,0.15)',  color: '#eab308', border: '1px solid rgba(234,179,8,0.3)'  },
};

const SCORE_COLOR = (score: number) =>
  score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#eab308';

const FLAG_LABELS: Record<string, string> = {
  splitting:    'Splitting',
  chaining:     'Chaining',
  large:        'Large Transfer',
  velocity:     'High Velocity',
  round_amount: 'Round Amount',
};

// ─── risk score ring ─────────────────────────────────────────────────────────
function RiskRing({ score }: { score: number }) {
  const r   = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const col  = SCORE_COLOR(score);

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1e1e1e" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={col} strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ color: col }}>{score}</span>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────
export default function Dashboard({
  walletData, setWalletData, searchedAddress, setSearchedAddress,
}: DashboardProps) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState('');

  const handleSearch = async () => {
    if (!address.trim()) { setError('Please enter a wallet address'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get<WalletData>(`${import.meta.env.VITE_API_URL}/wallet/${address}`);
      setWalletData(response.data);
      setSearchedAddress(address);
    } catch {
      setError('Failed to fetch wallet data. Please check the address and try again.');
      setWalletData(null);
    } finally {
      setLoading(false);
    }
  };

  // Highest risk score across all profiles
  const topScore = walletData?.profiles?.length
    ? Math.max(...walletData.profiles.map(p => p.riskScore))
    : 0;

  const topSeverity = topScore >= 70 ? 'HIGH' : topScore >= 40 ? 'MEDIUM' : 'LOW';

  const generateInsights = (data: WalletData): string[] => {
    const insights: string[] = [];
    const types = new Set(data.flags.map(f => f.type));

    if (types.has('splitting'))    insights.push('Wallet distributes funds across many addresses within short time windows');
    if (types.has('chaining'))     insights.push('Rapid fund-forwarding detected — classic layering behaviour');
    if (types.has('large'))        insights.push('High-value transactions observed — potential cash-out flow');
    if (types.has('velocity'))     insights.push('Unusually high transaction frequency — automated wallet suspected');
    if (types.has('round_amount')) insights.push('Round ETH amounts used — known structuring / laundering signal');

    if (data.stats.totalSent > data.stats.totalReceived * 0.9)
      insights.push('Outflow dominates — behaviour consistent with ransomware disbursement');
    if (data.stats.txCount > 50)
      insights.push('High overall transaction volume');
    if (insights.length === 0)
      insights.push('No significant suspicious patterns detected');

    return insights;
  };

  // Deduplicate flags by type for the summary panel
  const uniqueFlagTypes = walletData
    ? Array.from(new Map(walletData.flags.map(f => [f.type, f])).values())
    : [];

  return (
    <div className="p-8" style={{ backgroundColor: '#000000', minHeight: '100%' }}>

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>Investigation Dashboard</h2>
        <p style={{ color: '#888888' }}>Blockchain forensics and ransomware payment tracking</p>
      </div>

      {/* Search */}
      <div className="rounded-lg p-6 mb-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
        <label className="block text-sm font-medium mb-3" style={{ color: '#888888' }}>Wallet Address</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearch()}
            placeholder="Enter wallet address (e.g. 0x123...)"
            style={{
              flex: 1, backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: '8px', padding: '12px 16px',
              color: '#ffffff', outline: 'none',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#2a2a2a' : '#ffffff',
              color: '#000000', padding: '12px 24px',
              borderRadius: '8px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
            }}
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Analyzing...</> : <><Search className="w-5 h-5" />Analyze</>}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-sm flex items-center gap-2" style={{ color: '#ef4444' }}>
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!walletData && !loading && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 mx-auto mb-4" style={{ color: '#333333' }} />
          <h3 className="text-xl font-medium mb-2" style={{ color: '#aaaaaa' }}>Enter a wallet address to begin analysis</h3>
          <p style={{ color: '#666666' }}>Investigate blockchain transactions and detect suspicious patterns</p>
        </div>
      )}

      {walletData && (
        <div className="space-y-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            {/* Risk score card with ring */}
            <div className="rounded-lg p-6 flex flex-col items-center justify-center"
              style={{ backgroundColor: '#0d0d0d', border: `1px solid ${SCORE_COLOR(topScore)}44` }}>
              <span className="text-sm font-medium mb-3" style={{ color: '#888888' }}>Risk Score</span>
              <RiskRing score={topScore} />
              <div
                className="mt-3 px-3 py-1 rounded text-xs font-bold tracking-wider"
                style={SEVERITY_STYLE[topSeverity]}
              >
                {topSeverity} RISK
              </div>
            </div>

            <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
              <span className="text-sm font-medium" style={{ color: '#888888' }}>Total Sent</span>
              <div className="text-3xl font-bold mt-2" style={{ color: '#f97316' }}>
                {walletData.stats.totalSent.toFixed(4)}
              </div>
              <div className="text-xs mt-1" style={{ color: '#555555' }}>ETH</div>
            </div>

            <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
              <span className="text-sm font-medium" style={{ color: '#888888' }}>Total Received</span>
              <div className="text-3xl font-bold mt-2" style={{ color: '#ffffff' }}>
                {walletData.stats.totalReceived.toFixed(4)}
              </div>
              <div className="text-xs mt-1" style={{ color: '#555555' }}>ETH</div>
            </div>

            <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
              <span className="text-sm font-medium" style={{ color: '#888888' }}>Transaction Count</span>
              <div className="text-3xl font-bold mt-2" style={{ color: '#ffffff' }}>
                {walletData.stats.txCount}
              </div>
              <div className="text-xs mt-1" style={{ color: '#555555' }}>Total transactions</div>
            </div>

          </div>

          {/* ── Insights + Suspicious activity ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#ffffff' }}>Investigation Insights</h3>
              <div className="space-y-3">
                {generateInsights(walletData).map((insight, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#555555' }} />
                    <span className="text-sm" style={{ color: '#aaaaaa' }}>{insight}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#ffffff' }}>Suspicious Activity</h3>

              {uniqueFlagTypes.length === 0 ? (
                <p className="text-sm" style={{ color: '#555555' }}>No suspicious activity detected</p>
              ) : (
                <div className="space-y-3">
                  {uniqueFlagTypes.map((flag, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
                        <div>
                          <div className="text-sm font-medium" style={{ color: '#dddddd' }}>
                            {FLAG_LABELS[flag.type] || flag.type} detected
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: '#666666' }}>
                            {flag.detail}
                          </div>
                        </div>
                      </div>
                      <div
                        className="ml-4 flex-shrink-0 px-2 py-1 rounded text-xs font-bold tracking-wider"
                        style={SEVERITY_STYLE[flag.severity]}
                      >
                        {flag.severity}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ── Per-wallet risk profiles ── */}
          {walletData.profiles && walletData.profiles.length > 0 && (
            <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5" style={{ color: '#3b82f6' }} />
                <h3 className="text-lg font-semibold" style={{ color: '#ffffff' }}>Wallet Risk Profiles</h3>
              </div>

              <div className="space-y-3">
                {walletData.profiles
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .map((profile, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-4"
                      style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#cccccc' }}>
                          {profile.wallet.slice(0, 6)}...{profile.wallet.slice(-4)}
                        </code>
                        <div className="flex items-center gap-3">
                          {/* mini score bar */}
                          <div className="w-24 h-1.5 rounded-full" style={{ backgroundColor: '#2a2a2a' }}>
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${profile.riskScore}%`,
                                backgroundColor: SCORE_COLOR(profile.riskScore),
                                transition: 'width 0.5s ease',
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold w-8 text-right" style={{ color: SCORE_COLOR(profile.riskScore) }}>
                            {profile.riskScore}
                          </span>
                          <div
                            className="px-2 py-0.5 rounded text-xs font-bold tracking-wider"
                            style={SEVERITY_STYLE[profile.severity]}
                          >
                            {profile.severity}
                          </div>
                        </div>
                      </div>
                      {/* flag chips */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.flags.map((f, j) => (
                          <span
                            key={j}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#1a1a1a', color: '#888888', border: '1px solid #2a2a2a' }}
                          >
                            {FLAG_LABELS[f.type] || f.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
