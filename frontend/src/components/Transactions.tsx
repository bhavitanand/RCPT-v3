import { useState } from 'react';
import { List, Copy, Check, ArrowUpRight, ArrowDownLeft, ExternalLink } from 'lucide-react';
import { WalletData } from '../types';

interface TransactionsProps {
  walletData: WalletData | null;
  searchedAddress: string;
}

export default function Transactions({ walletData, searchedAddress }: TransactionsProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const truncateAddress = (address: string): string => {
    if (address.length <= 13) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!walletData) {
    return (
      <div className="p-8" style={{ backgroundColor: '#000000' }}>
        <div className="text-center py-20">
          <List className="w-16 h-16 mx-auto mb-4" style={{ color: '#444444' }} />
          <h3 className="text-xl font-medium mb-2" style={{ color: '#aaaaaa' }}>No transaction data available</h3>
          <p style={{ color: '#666666' }}>Search for a wallet address in the Dashboard to view transactions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" style={{ backgroundColor: '#000000' }}>
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2" style={{ color: '#ffffff' }}>Transactions</h2>
        <p style={{ color: '#888888' }}>Complete transaction history for {truncateAddress(searchedAddress)}</p>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#666666' }}>
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#666666' }}>
                  From
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#666666' }}>
                  To
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#666666' }}>
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#666666' }}>
                  Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#666666' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {walletData.transactions.map((tx, index) => {
                const isIncoming = tx.to.toLowerCase() === searchedAddress.toLowerCase();

                return (
                  <tr
                    key={index}
                    style={{ borderBottom: '1px solid #1a1a1a' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#141414')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Type */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isIncoming ? (
                        <div className="flex items-center gap-2" style={{ color: '#ffffff' }}>
                          <ArrowDownLeft className="w-4 h-4" />
                          <span className="text-sm font-medium">IN</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2" style={{ color: '#f97316' }}>
                          <ArrowUpRight className="w-4 h-4" />
                          <span className="text-sm font-medium">OUT</span>
                        </div>
                      )}
                    </td>

                    {/* From */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code
                          className="text-sm px-2 py-1 rounded"
                          style={{ color: '#cccccc', backgroundColor: '#1a1a1a' }}
                        >
                          {truncateAddress(tx.from)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(tx.from)}
                          style={{ color: '#555555' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#aaaaaa')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
                          title="Copy address"
                        >
                          {copiedAddress === tx.from ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* To */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code
                          className="text-sm px-2 py-1 rounded"
                          style={{ color: '#cccccc', backgroundColor: '#1a1a1a' }}
                        >
                          {truncateAddress(tx.to)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(tx.to)}
                          style={{ color: '#555555' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#aaaaaa')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
                          title="Copy address"
                        >
                          {copiedAddress === tx.to ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="text-sm font-medium"
                        style={{ color: isIncoming ? '#ffffff' : '#f97316' }}
                      >
                        {isIncoming ? '+' : '-'}{tx.amount.toFixed(4)} ETH
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm" style={{ color: '#888888' }}>
                        {formatTimestamp(tx.timestamp)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`https://etherscan.io/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 transition-colors"
                        style={{ color: '#3b82f6' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#60a5fa')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#3b82f6')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {walletData.transactions.length === 0 && (
          <div className="text-center py-12">
            <p style={{ color: '#555555' }}>No transactions found</p>
          </div>
        )}
      </div>

      {walletData.transactions.length > 0 && (
        <div className="mt-4 text-sm text-center" style={{ color: '#555555' }}>
          Showing {walletData.transactions.length} transaction{walletData.transactions.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}