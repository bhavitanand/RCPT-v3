import { useState } from 'react';
import { Shield, Network, List, AlertTriangle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GraphAnalysis from './components/GraphAnalysis';
import Transactions from './components/Transactions';
import ThreatAnalysis from './components/ThreatAnalysis';
import { WalletData } from './types';

type Page = 'dashboard' | 'graph' | 'transactions' | 'threats';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [searchedAddress, setSearchedAddress] = useState<string>('');

  const navigationItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: Shield },
    { id: 'graph' as Page, label: 'Graph Analysis', icon: Network },
    { id: 'transactions' as Page, label: 'Transactions', icon: List },
    { id: 'threats' as Page, label: 'Threat Analysis', icon: AlertTriangle },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            walletData={walletData}
            setWalletData={setWalletData}
            searchedAddress={searchedAddress}
            setSearchedAddress={setSearchedAddress}
          />
        );
      case 'graph':
        return <GraphAnalysis walletData={walletData} searchedAddress={searchedAddress} />;
      case 'transactions':
        return <Transactions walletData={walletData} searchedAddress={searchedAddress} />;
      case 'threats':
        return <ThreatAnalysis walletData={walletData} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-bg">

      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border flex flex-col">

        {/* Logo / Title */}
        <div className="p-6 border-b border-border text-center">
          <div className="flex justify-center mb-2">
            <Shield className="w-6 h-6 text-primary" />
          </div>

          <h1 className="text-base font-bold text-primary">
            Ransomware Crypto Payments Tracker
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all ${
                currentPage === item.id
                  ? 'bg-[#1a1a1a] text-primary border border-border'
                  : 'text-secondary hover:bg-[#1a1a1a] hover:text-primary'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer Status */}
        <div className="p-4 border-t border-border">
          <div className="text-xs text-secondary">
            <div className="flex justify-between mb-1">
              <span>Status</span>
              <span className="text-success">● Online</span>
            </div>
            <div className="flex justify-between">
              <span>API</span>
              <span className="text-primary">localhost:5000</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {renderPage()}
      </div>

    </div>
  );
}

export default App;
