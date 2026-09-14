import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import AccessibilityBar from './components/AccessibilityBar';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import LoginScreen from './pages/LoginScreen';
import api from './api/client';
import './components/Layout.css';

// Route pages are lazy-loaded (real code-splitting, not just a Suspense wrapper for
// show): the pre-split production build was a single 1.2 MB chunk (Vite's own
// build-time warning), meaning a first-time visitor downloaded Investigation.jsx's
// map-trace logic and Administration.jsx's user-management UI before ever seeing the
// Dashboard. Each route is now its own chunk, fetched only when actually navigated to.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Model1 = lazy(() => import('./pages/Model1'));
const Model2 = lazy(() => import('./pages/Model2'));
const Model3 = lazy(() => import('./pages/Model3'));
const Model4 = lazy(() => import('./pages/Model4'));
const Investigation = lazy(() => import('./pages/Investigation'));
const Watchlists = lazy(() => import('./pages/Watchlists'));
const SystemNetwork = lazy(() => import('./pages/SystemNetwork'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  const location = useLocation();
  const isLoginRoute = location.pathname === '/login';

  // Real route protection -- previously every page rendered regardless of login
  // state (the login screen's own "success" was faked too, see LoginScreen.jsx).
  // hasSession() covers both a real backend token and a deliberate, honestly-labelled
  // mock-mode entry (docs/frontend.md §3.0's DEMO/LIVE distinction).
  if (!isLoginRoute && !api.hasSession()) {
    return <Navigate to="/login" replace />;
  }

  // Real mobile nav toggle -- a real Playwright screenshot at 375px width was the
  // first time this app was actually checked at phone width, and it showed the
  // 260px-wide Sidebar permanently occupying most of the screen, clipping every
  // page's content with no way to collapse it (no media query touched Sidebar.css
  // or Topbar.css at all before this). Below 880px (Sidebar.css/Topbar.css) the
  // sidebar becomes an off-canvas overlay, opened via Topbar's hamburger button and
  // closed by the backdrop, a nav link, or a route change.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={isLoginRoute ? '' : 'app-shell'}>
      {isLoginRoute ? <LoginScreen /> : (
        <>
          <AccessibilityBar />
          <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
          <div className="app-body">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="page-content" id="main-content" tabIndex={-1}>
              <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Loading…</div>}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/model-1" element={<Model1 />} />
                  <Route path="/registry" element={<Model1 />} />
                  <Route path="/cameras" element={<Model1 />} />
                  <Route path="/cctv-registry" element={<Model1 />} />
                  <Route path="/model-2" element={<Model2 />} />
                  <Route path="/model-3" element={<Model3 />} />
                  <Route path="/model-4" element={<Model4 />} />
                  <Route path="/investigation" element={<Investigation />} />
                  <Route path="/watchlists" element={<Watchlists />} />
                  <Route path="/system" element={<SystemNetwork />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
          <Footer />
        </>
      )}
    </div>
  );
}

function RoutedApp() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default RoutedApp;
