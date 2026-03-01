import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Upload, FileText, GitMerge, BarChart2,
  Settings, Zap, Clock, CheckCircle, AlertTriangle, Trash2, LogOut
} from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';

import Dashboard from './pages/Dashboard.jsx';
import UploadInvoice from './pages/UploadInvoice.jsx';
import InvoiceList from './pages/InvoiceList.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Reconciliation from './pages/Reconciliation.jsx';
import Reports from './pages/Reports.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

const navItems = [
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { path: '/upload', icon: <Upload size={18} />, label: 'Upload Invoice' },
  { path: '/invoices', icon: <FileText size={18} />, label: 'Invoices' },
  { path: '/reconcile', icon: <GitMerge size={18} />, label: 'Reconciliation' },
  { path: '/reports', icon: <BarChart2 size={18} />, label: 'Reports' },
];

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <Zap size={48} className="accent-text spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  return children;
};

function AppContent() {
  const location = useLocation();
  const { user, loading, logout } = useAuth();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

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

  if (isAuthPage) {
    if (user && !loading) return <Navigate to="/" />;
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    );
  }

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
          {user && (
            <button className="nav-link logout-btn" onClick={logout} title="Logout">
              <span className="nav-icon"><LogOut size={18} /></span>
            </button>
          )}
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
            {user && (
              <div className="user-profile-header">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="user-avatar-small" />
                ) : (
                  <div className="user-initials-small">{user.name?.charAt(0)}</div>
                )}
                <span className="user-name-header">{user.name}</span>
              </div>
            )}
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
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadInvoice /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoiceList /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/reconcile" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "PASTE_YOUR_GOOGLE_CLIENT_ID_HERE";

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
