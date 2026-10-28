import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, ArrowRightLeft, CalendarDays, Receipt,
  Settings, DownloadCloud, Menu, X, TrendingUp, Target, Calculator, Landmark
} from 'lucide-react';
import { useStore } from './store/StoreContext';
import { checkAndNotifyMaturities, checkAndNotifyDividends } from './utils/maturityNotifications';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Operations = lazy(() => import('./pages/Operations'));
const Dividends = lazy(() => import('./pages/Dividends'));
const Taxes = lazy(() => import('./pages/Taxes'));
const SyncAndBackup = lazy(() => import('./pages/SyncAndBackup'));
const Configs = lazy(() => import('./pages/Configs'));
const AssetDetail = lazy(() => import('./pages/AssetDetail'));
const Goals = lazy(() => import('./pages/Goals'));
const Simulator = lazy(() => import('./pages/Simulator'));
const FixedIncome = lazy(() => import('./pages/FixedIncome'));
const FixedIncomeSimulator = lazy(() => import('./pages/FixedIncomeSimulator'));
const FixedIncomeDetail = lazy(() => import('./pages/FixedIncomeDetail'));

/* ─── Nav config ─── */
const NAV_MAIN = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/carteira', label: 'Carteira', Icon: Wallet },
  { to: '/renda-fixa', label: 'Renda Fixa', Icon: Landmark },
  { to: '/operacoes', label: 'Operações', Icon: ArrowRightLeft },
  { to: '/proventos', label: 'Proventos', Icon: CalendarDays },
  { to: '/imposto', label: 'Imposto de Renda', Icon: Receipt },
];

const NAV_TOOLS = [
  { to: '/simulador', label: 'Simulador de Aportes', Icon: Calculator },
  { to: '/metas', label: 'Metas de Alocação', Icon: Target },
];

const NAV_UTILS = [
  { to: '/backup', label: 'Backup', Icon: DownloadCloud },
  { to: '/configuracoes', label: 'Configurações', Icon: Settings },
];

/* ─── Reusable NavItem ─── */
const NavItem = ({ to, label, Icon, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
  >
    <span className="nav-icon"><Icon size={17} /></span>
    {label}
  </NavLink>
);

/* ─── Sidebar (Desktop) ─── */
const Sidebar = () => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <div className="sidebar-logo-icon">
        <TrendingUp size={18} color="#000" />
      </div>
      <span className="sidebar-logo-text">InvestK</span>
    </div>

    <nav className="sidebar-nav">
      <span className="sidebar-section-label">Principal</span>
      {NAV_MAIN.map(n => <NavItem key={n.to} {...n} />)}

      <span className="sidebar-section-label" style={{ marginTop: 8 }}>Estratégia</span>
      {NAV_TOOLS.map(n => <NavItem key={n.to} {...n} />)}

      <span className="sidebar-section-label" style={{ marginTop: 8 }}>Configurar</span>
      {NAV_UTILS.map(n => (
        <NavItem key={n.to} {...n} />
      ))}
    </nav>


  </aside>
);

/* ─── Mobile Header + Drawer ─── */
const MobileMenu = () => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <header className="header-mobile">
        <div className="flex items-center gap-3">
          <div className="sidebar-logo-icon" style={{ width: 30, height: 30 }}>
            <TrendingUp size={14} color="#000" />
          </div>
          <span className="sidebar-logo-text" style={{ fontSize: '1rem' }}>InvestK</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(v => !v)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {open && (
        <>
          <div className="mobile-menu-overlay" onClick={close} />
          <div className="mobile-sidebar">
            <div className="sidebar-logo" style={{ marginBottom: 16 }}>
              <div className="sidebar-logo-icon">
                <TrendingUp size={18} color="#000" />
              </div>
              <span className="sidebar-logo-text">InvestK</span>
              <button className="btn btn-ghost btn-icon ml-auto" onClick={close}><X size={18} /></button>
            </div>
            <div className="sidebar-nav" style={{ flex: 1 }}>
              <span className="sidebar-section-label">Principal</span>
              {NAV_MAIN.map(n => <NavItem key={n.to} {...n} onClick={close} />)}
              <span className="sidebar-section-label" style={{ marginTop: 8 }}>Estratégia</span>
              {NAV_TOOLS.map(n => <NavItem key={n.to} {...n} onClick={close} />)}
              <span className="sidebar-section-label" style={{ marginTop: 8 }}>Configurar</span>
              {NAV_UTILS.map(n => <NavItem key={n.to} {...n} onClick={close} />)}
            </div>
          </div>
        </>
      )}
    </>
  );
};

/* ─── App Content ─── */
const AppContent = () => {
  const location = useLocation();
  const { fixedIncome, fixedIncomeSettings, portfolioState, dividends } = useStore();

  // Dispatch PWA notifications on app mount for maturity + dividend alerts
  useEffect(() => {
    if (fixedIncomeSettings?.enableBrowserNotifications) {
      // Check maturity notifications
      checkAndNotifyMaturities(fixedIncome || [], fixedIncomeSettings);
      // Check dividend delay notifications
      const { positions } = portfolioState || {};
      if (positions && Object.keys(positions).length > 0) {
        checkAndNotifyDividends(positions, dividends || [], fixedIncomeSettings);
      }
    }
  }, [fixedIncome, fixedIncomeSettings, portfolioState, dividends]);

  return (
    <div className="app-container">
      <MobileMenu />
      <Sidebar />

      <main className="main-content">
        <div key={location.pathname} className="page-wrapper anim-slide-up">
          <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="text-muted">Carregando Tela...</div></div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/carteira" element={<Portfolio />} />
              <Route path="/ativo/:id" element={<AssetDetail />} />
              <Route path="/renda-fixa" element={<FixedIncome />} />
              <Route path="/renda-fixa/simulador" element={<FixedIncomeSimulator />} />
              <Route path="/renda-fixa/:id" element={<FixedIncomeDetail />} />
              <Route path="/operacoes" element={<Operations />} />
              <Route path="/proventos" element={<Dividends />} />
              <Route path="/imposto" element={<Taxes />} />
              <Route path="/simulador" element={<Simulator />} />
              <Route path="/metas" element={<Goals />} />
              <Route path="/backup" element={<SyncAndBackup />} />
              <Route path="/configuracoes" element={<Configs />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
