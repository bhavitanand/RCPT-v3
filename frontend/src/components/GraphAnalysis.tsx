import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { Network, AlertCircle } from 'lucide-react';
import { WalletData, Flag } from '../types';

cytoscape.use(dagre);

interface GraphAnalysisProps {
  walletData: WalletData | null;
  searchedAddress: string;
}

export default function GraphAnalysis({ walletData, searchedAddress }: GraphAnalysisProps) {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!walletData || !cyRef.current) return;

    const suspiciousWallets = new Set(
      walletData.flags.map(flag => flag.wallet)
    );

    const elements = [
      ...walletData.graph.nodes.map(node => ({
        data: { id: node.id },
        classes: node.id === searchedAddress
          ? 'target'
          : suspiciousWallets.has(node.id)
            ? 'suspicious'
            : 'normal'
      })),
      ...walletData.graph.edges.map((edge, index) => ({
        data: {
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target,
          amount: edge.amount
        }
      }))
    ];

    if (cyInstance.current) {
      cyInstance.current.destroy();
    }

    cyInstance.current = cytoscape({
      container: cyRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#1a1a1a',
            'label': 'data(id)',
            'color': '#ffffff',
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': '40px',
            'height': '40px',
            'border-width': '2px',
            'border-color': '#555555',
            'text-wrap': 'ellipsis',
            'text-max-width': '60px'
          }
        },
        {
          selector: 'node.target',
          style: {
            'background-color': '#ffffff',
            'border-color': '#cccccc',
            'border-width': '3px',
            'color': '#000000',
            'width': '50px',
            'height': '50px'
          }
        },
        {
          selector: 'node.suspicious',
          style: {
            'background-color': '#dc2626',
            'border-color': '#ef4444',
            'border-width': '3px',
            'color': '#ffffff'
          }
        },
        {
          selector: 'node.normal',
          style: {
            'background-color': '#1a1a1a',
            'border-color': '#555555',
            'color': '#dddddd'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': (ele: cytoscape.EdgeSingular) => {
              const amount = ele.data('amount') || 0;
              return Math.max(1, Math.min(amount * 2, 10));
            },
            'line-color': '#555555',
            'target-arrow-color': '#888888',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.5
          }
        }
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 150,
        padding: 50
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    cyInstance.current.on('tap', 'node', (evt) => {
      const node = evt.target;
      console.log('Node clicked:', node.id());
    });

    return () => {
      if (cyInstance.current) {
        cyInstance.current.destroy();
        cyInstance.current = null;
      }
    };
  }, [walletData, searchedAddress]);

  if (!walletData) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <Network className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-300 mb-2">No wallet data to visualize</h3>
          <p className="text-gray-500">Search for a wallet address in the Dashboard to view its transaction graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 h-full flex flex-col" style={{ backgroundColor: '#000000' }}>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Graph Analysis</h2>
        <p className="text-gray-400">Interactive visualization of wallet transactions</p>
      </div>

      {/* Legend */}
      <div
        className="rounded-lg p-4 mb-4"
        style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-white border-2 border-gray-300" />
            <span className="text-sm text-gray-300">Target Wallet</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: '#dc2626', borderColor: '#ef4444' }} />
            <span className="text-sm text-gray-300">Suspicious Wallet</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2" style={{ backgroundColor: '#1a1a1a', borderColor: '#555555' }} />
            <span className="text-sm text-gray-300">Normal Wallet</span>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            {walletData.graph.nodes.length} nodes, {walletData.graph.edges.length} edges
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div
        className="flex-1 rounded-lg overflow-hidden"
        style={{ backgroundColor: '#000000', border: '1px solid #2a2a2a' }}
      >
        <div ref={cyRef} className="w-full h-full" style={{ backgroundColor: '#000000' }} />
      </div>

      {/* Alert */}
      {walletData.flags.length > 0 && (
        <div
          className="mt-4 rounded-lg p-4"
          style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}
        >
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Suspicious nodes detected in graph</span>
          </div>
          <p className="text-xs text-gray-500">
            Red nodes indicate wallets flagged for suspicious activity
          </p>
        </div>
      )}
    </div>
  );
}