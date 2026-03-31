import { useState } from 'react';
import axios from 'axios';
import { Search, TrendingUp, TrendingDown, Activity, Loader2, AlertCircle } from 'lucide-react';
import { WalletData, Flag } from '../types';

interface DashboardProps {
  walletData: WalletData | null;
  setWalletData: (data: WalletData | null) => void;
  searchedAddress: string;
  setSearchedAddress: (address: string) => void;
}

interface GroupedFlag {
  type: string;
  count: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export default function Dashboard({ walletData, setWalletData, searchedAddress, setSearchedAddress }: DashboardProps) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!address.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get<WalletData>(`http://localhost:5000/wallet/${address}`);
      setWalletData(response.data);
      setSearchedAddress(address);
    } catch (err) {
      setError('Failed to fetch wallet data. Please check the address and try again.');
      setWalletData(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateRiskScore = (flags: Flag[]): number => {
    const score = flags.length * 10;
    return Math.min(score, 100);
  };

  const getRiskLevel = (score: number): { label: string; color: string } => {
    if (score <= 30) return { label: 'Low Risk', color: 'text-success' };
    if (score <= 60) return { label: 'Medium Risk', color: 'text-warning' };
    return { label: 'High Risk', color: 'text-danger' };
  };

  const generateInsights = (data: WalletData): string[] => {
    const insights: string[] = [];
    const { stats, flags, transactions } = data;

    if (flags.some(f => f.type === 'splitting')) {
      insights.push('Wallet is distributing funds across multiple addresses');
    }

    if (flags.some(f => f.type === 'chaining')) {
      insights.push('Potential laundering pattern detected');
    }

    if (flags.some(f => f.type === 'large')) {
      insights.push('High-value transactions observed');
    }

    if (stats.totalSent > stats.totalReceived * 0.9) {
      insights.push('Behavior resembles ransomware cash-out flow');
    }

    if (transactions.length > 50) {
      insights.push('High transaction volume detected');
    }

    if (insights.length === 0) {
      insights.push('No significant suspicious patterns detected');
    }

    return insights;
  };

  const groupFlags = (flags: Flag[]): GroupedFlag[] => {
    const grouped = flags.reduce((acc, flag) => {
      if (!acc[flag.type]) {
        acc[flag.type] = { count: 0, flags: [] };
      }
      acc[flag.type].count++;
      acc[flag.type].flags.push(flag);
      return acc;
    }, {} as Record<string, { count: number; flags: Flag[] }>);

    return Object.entries(grouped).map(([type, data]) => ({
      type,
      count: data.count,
      severity: type === 'large' ? 'HIGH' : type === 'chaining' ? 'MEDIUM' : 'LOW',
    }));
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'HIGH': return 'bg-danger/20 text-danger border-danger/30';
      case 'MEDIUM': return 'bg-warning/20 text-warning border-warning/30';
      case 'LOW': return 'bg-secondary/20 text-secondary border-secondary/30';
      default: return 'bg-border/20 text-secondary border-border/30';
    }
  };

  const riskScore = walletData ? calculateRiskScore(walletData.flags) : 0;
  const riskLevel = getRiskLevel(riskScore);

  return (
    <div className="p-8">

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-primary mb-2">Investigation Dashboard</h2>
        <p className="text-secondary">Blockchain forensics and ransomware payment tracking</p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <label className="block text-sm font-medium text-secondary mb-3">Wallet Address</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter wallet address (e.g., 0x123...)"
            className="flex-1 bg-[#1a1a1a] border border-border rounded-lg px-4 py-3 text-primary placeholder-secondary focus:outline-none focus:border-border"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-primary text-black px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors hover:bg-gray-300 disabled:bg-border"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Analyze
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-danger text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {!walletData && !loading && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 text-secondary mx-auto mb-4" />
          <h3 className="text-xl font-medium text-secondary mb-2">Enter a wallet address to begin analysis</h3>
          <p className="text-secondary">Investigate blockchain transactions and detect suspicious patterns</p>
        </div>
      )}

      {walletData && (
        <div className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            <div className="bg-card rounded-lg border border-border p-6">
              <span className="text-secondary text-sm font-medium">Risk Score</span>
              <div className={`text-4xl font-bold ${riskLevel.color} mt-2`}>{riskScore}</div>
              <div className="mt-2 text-xs">{riskLevel.label}</div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
              <span className="text-secondary text-sm font-medium">Total Sent</span>
              <div className="text-3xl font-bold text-warning mt-2">{walletData.stats.totalSent.toFixed(4)}</div>
              <div className="text-xs text-secondary mt-1">ETH</div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
              <span className="text-secondary text-sm font-medium">Total Received</span>
              <div className="text-3xl font-bold text-success mt-2">{walletData.stats.totalReceived.toFixed(4)}</div>
              <div className="text-xs text-secondary mt-1">ETH</div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
              <span className="text-secondary text-sm font-medium">Transaction Count</span>
              <div className="text-3xl font-bold text-primary mt-2">{walletData.stats.txCount}</div>
              <div className="text-xs text-secondary mt-1">Total transactions</div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-primary mb-4">Investigation Insights</h3>
              <div className="space-y-3">
                {generateInsights(walletData).map((insight, index) => (
                  <div key={index} className="flex items-start gap-3 text-secondary">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                    <span className="text-sm">{insight}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-primary mb-4">Suspicious Activity</h3>

              {walletData.flags.length === 0 ? (
                <p className="text-secondary text-sm">No suspicious activity detected</p>
              ) : (
                <div className="space-y-3">
                  {groupFlags(walletData.flags).map((flag, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-danger" />
                        <div>
                          <div className="text-sm font-medium text-primary capitalize">
                            {flag.type} detected
                          </div>
                          <div className="text-xs text-secondary">
                            {flag.count} occurrence{flag.count > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className={`px-3 py-1 rounded border text-xs font-medium ${getSeverityColor(flag.severity)}`}>
                        {flag.severity}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>

        </div>
      )}
    </div>
  );
}