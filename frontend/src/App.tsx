import { BookOpen, Bookmark, Activity, ListChecks, Search } from 'lucide-react';
import BatchPage from './pages/BatchPage';
import { go, useCases, useRoute } from './store';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import CasesPage from './pages/CasesPage';
import LearnPage from './pages/LearnPage';
import StatusPage from './pages/StatusPage';

export default function App() {
  const route = useRoute();
  const { cases } = useCases();
  const nav = [
    { id: 'home' as const, label: 'Trace', icon: Search },
    { id: 'batch' as const, label: 'Batch', icon: ListChecks },
    { id: 'cases' as const, label: 'Cases', icon: Bookmark, badge: cases.length || undefined },
    { id: 'learn' as const, label: 'Learn', icon: BookOpen },
    { id: 'status' as const, label: 'Status', icon: Activity },
  ];
  const active = route.page === 'report' ? 'home' : route.page;

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="RCPT home">
          <img src="/logo.png" alt="" width={28} height={28} />
          <span>RCPT</span>
          <small>Ransomware Crypto Payment Tracker</small>
        </button>
        <nav aria-label="Main">
          {nav.map(n => (
            <button key={n.id} className={active === n.id ? 'on' : ''} onClick={() => go(n.id)} aria-current={active === n.id ? 'page' : undefined}>
              <n.icon size={16} /> <span>{n.label}</span>
              {n.badge && <b className="count">{n.badge}</b>}
            </button>
          ))}
        </nav>
      </header>
      <div id="main">
        {route.page === 'home' && <HomePage />}
        {route.page === 'report' && <ReportPage params={route.params} />}
        {route.page === 'batch' && <BatchPage />}
        {route.page === 'cases' && <CasesPage />}
        {route.page === 'learn' && <LearnPage />}
        {route.page === 'status' && <StatusPage />}
      </div>
      <footer className="footer">
        <span>RCPT v3 · read-only analysis of public blockchain data · for education and research</span>
      </footer>
    </div>
  );
}
