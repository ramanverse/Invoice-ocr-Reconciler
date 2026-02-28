import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileText, GitMerge, BarChart2,
  Settings, Zap, Clock, CheckCircle, AlertTriangle, Trash2
} from 'lucide-react';

import Dashboard from './pages/Dashboard.jsx';
import UploadInvoice from './pages/UploadInvoice.jsx';
import InvoiceList from './pages/InvoiceList.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Reconciliation from './pages/Reconciliation.jsx';
import Reports from './pages/Reports.jsx';

const navItems = [
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { path: '/upload', icon: <Upload size={18} />, label: 'Upload Invoice' },
  { path: '/invoices', icon: <FileText size={18} />, label: 'Invoices' },
  { path: '/reconcile', icon: <GitMerge size={18} />, label: 'Reconciliation' },
  { path: '/reports', icon: <BarChart2 size={18} />, label: 'Reports' },
];

export default function App() {
  const location = useLocation();

  const getPageMeta = () => {
    const map = {
      '/': { title: 'Dashboard', subtitle: 'Overview of your invoice processing pipeline' },
      '/upload': { title: 'Upload Invoices', subtitle: 'Upload PDF or image invoices for OCR extraction' },
      '/invoices': { title: 'Invoice Library', subtitle: 'All extracted and processed invoices' },
      '/reconcile': { title: 'Reconciliation Engine', subtitle: 'Match invoices against payment register' },
      '/reports': { title: 'Reports & Analytics', subtitle: 'Export and analyze reconciliation results' },
    };
    return map[location.pathname] || { title: 'Invoice OCR', subtitle: '' };
  };

  const meta = getPageMeta();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status" title="Backend connected · Port 5001">
            <div className="status-dot" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <header className="main-header">
          <div>
            <div className="header-title">{meta.title}</div>
            <div className="header-subtitle">{meta.subtitle}</div>
          </div>
          <div className="header-actions">
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 12,
              padding: '8px 16px',
              fontSize: 13,
              color: 'var(--accent-primary)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Zap size={14} fill="var(--accent-primary)" />
              PRO OCR ACTIVE
            </div>
          </div>
        </header>

        <main className="page-content fade-in">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadInvoice />} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/reconcile" element={<Reconciliation />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
