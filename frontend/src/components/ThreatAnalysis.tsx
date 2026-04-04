import { AlertTriangle, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { WalletData, Transaction, Flag } from '../types';

interface ThreatAnalysisProps {
  walletData: WalletData | null;
}

interface TimelineEvent {
  date:        string;
  type:        'transaction' | 'flag';
  description: string;
  severity?:   'HIGH' | 'MEDIUM' | 'LOW';
  amount?:     number;
}

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

export default function ThreatAnalysis({ walletData }: ThreatAnalysisProps) {

  const truncateAddress = (address: string) =>
    address.length <= 13 ? address : `${address.slice(0, 6)}...${address.slice(-4)}`;

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getDotColor = (severity?: string) =>
    severity === 'HIGH' ? '#ef4444' : severity === 'MEDIUM' ? '#f97316' : severity === 'LOW' ? '#eab308' : '#3b82f6';

  const generateTimeline = (transactions: Transaction[], flags: Flag[]): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    transactions.forEach(tx => {
      const txFlags = flags.filter(f => f.wallet === tx.from || f.wallet === tx.to);

      if (txFlags.length > 0) {
        txFlags.forEach(flag => {
          events.push({
            date:        tx.timestamp,
            type:        'flag',
            description: flag.detail || `${FLAG_LABELS[flag.type] || flag.type} pattern detected`,
            severity:    flag.severity,
            amount:      tx.amount,
          });
        });
      } else if (tx.amount > 1) {
        events.push({
          date:        tx.timestamp,
          type:        'transaction',
          description: `Transaction of ${tx.amount.toFixed(4)} ETH`,
          amount:      tx.amount,
        });
      }
    });

    // Deduplicate by date+description
    const seen = new Set<string>();
    return events
      .filter(e => {
        const k = `${e.date}|${e.description}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (!walletData) {
    return (
      <div className="p-8" style={{ backgroundColor: '#000000' }}>
        <div className="text-center py-20">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4" style={{ color: '#333333' }} />
          <h3 className="text-xl font-medium mb-2" style={{ color: '#aaaaaa' }}>No threat data available</h3>
          <p style={{ color: '#666666' }}>Search for a wallet address in the Dashboard to view threat analysis</p>
        </div>
      </div>
    );
  }

  const timeline = generateTimeline(walletData.transactions, walletData.flags);

  const highCount   = walletData.flags.filter(f => f.severity === 'HIGH').length;
  const mediumCount = walletData.flags.filter(f => f.severity === 'MEDIUM').length;
  const lowCount    = walletData.flags.filter(f => f.severity === 'LOW').length;

  // Deduplicate flags by wallet+type
  const uniqueFlags = Array.from(
    new Map(walletData.flags.map(f => [`${f.wallet}|${f.type}`, f])).values()
  );

  return (
    <div className="p-8" style={{ backgroundColor: '#000000' }}>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>Threat Analysis</h2>
        <p style={{ color: '#888888' }}>Detailed security alerts and timeline visualization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* ── Detailed Alerts ── */}
        <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
            <h3 className="text-lg font-semibold" style={{ color: '#ffffff' }}>Detailed Alerts</h3>
          </div>

          {uniqueFlags.length === 0 ? (
            <p className="text-sm" style={{ color: '#555555' }}>No security alerts detected</p>
          ) : (
            <div className="space-y-3">
              {uniqueFlags.map((flag, index) => (
                <div key={index} className="rounded-lg p-4" style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" style={{ color: '#eab308' }} />
                      <span className="text-sm font-medium capitalize" style={{ color: '#dddddd' }}>
                        {FLAG_LABELS[flag.type] || flag.type} Pattern Detected
                      </span>
                    </div>
                    <div className="px-2 py-1 rounded text-xs font-bold tracking-wider" style={SEVERITY_STYLE[flag.severity]}>
                      {flag.severity}
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5">
                    {flag.detail && (
                      <div style={{ color: '#666666' }}>{flag.detail}</div>
                    )}
                    <div>
                      <span style={{ color: '#555555' }}>Wallet:</span>
                      <code className="ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: '#1a1a1a', color: '#cccccc' }}>
                        {truncateAddress(flag.wallet)}
                      </code>
                    </div>

                    {/* Risk score mini bar */}
                    <div className="flex items-center gap-2 pt-1">
                      <span style={{ color: '#555555' }}>Risk score:</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: '#2a2a2a' }}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${flag.riskScore}%`, backgroundColor: SCORE_COLOR(flag.riskScore) }}
                        />
                      </div>
                      <span className="font-bold text-xs w-6 text-right" style={{ color: SCORE_COLOR(flag.riskScore) }}>
                        {flag.riskScore}
                      </span>
                    </div>

                    {flag.amount !== undefined && (
                      <div>
                        <span style={{ color: '#555555' }}>Amount:</span>
                        <span className="ml-2" style={{ color: '#cccccc' }}>{flag.amount.toFixed(4)} ETH</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Activity Summary ── */}
        <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5" style={{ color: '#3b82f6' }} />
            <h3 className="text-lg font-semibold" style={{ color: '#ffffff' }}>Activity Summary</h3>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Total Alerts',    value: walletData.flags.length, color: '#ef4444' },
              { label: 'High Severity',   value: highCount,               color: '#ef4444' },
              { label: 'Medium Severity', value: mediumCount,             color: '#f97316' },
              { label: 'Low Severity',    value: lowCount,                color: '#eab308' },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className="flex items-center justify-between pb-4"
                style={i < arr.length - 1 ? { borderBottom: '1px solid #1e1e1e' } : {}}
              >
                <span className="text-sm" style={{ color: '#888888' }}>{row.label}</span>
                <span className="text-lg font-bold" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Pattern breakdown */}
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid #1e1e1e' }}>
            <p className="text-xs font-medium mb-3" style={{ color: '#555555' }}>PATTERN BREAKDOWN</p>
            <div className="space-y-2">
              {Object.entries(FLAG_LABELS).map(([key, label]) => {
                const count = walletData.flags.filter(f => f.type === key).length;
                if (count === 0) return null;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5" style={{ color: '#555555' }} />
                      <span className="text-xs" style={{ color: '#aaaaaa' }}>{label}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: '#ffffff' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Timeline ── */}
      <div className="rounded-lg p-6" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5" style={{ color: '#3b82f6' }} />
          <h3 className="text-lg font-semibold" style={{ color: '#ffffff' }}>Timeline View</h3>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#555555' }}>No timeline events to display</p>
        ) : (
          <div className="space-y-4">
            {timeline.map((event, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getDotColor(event.type === 'flag' ? event.severity : undefined) }}
                  />
                  {index < timeline.length - 1 && (
                    <div className="w-px flex-1 mt-2" style={{ backgroundColor: '#2a2a2a' }} />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: '#cccccc' }}>
                      {formatDate(event.date)}
                    </span>
                    {event.severity && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold tracking-wider" style={SEVERITY_STYLE[event.severity]}>
                        {event.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: '#666666' }}>{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
