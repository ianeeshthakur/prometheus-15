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

// Route pages are lazy-loaded for real code-splitting (each route is its own
// chunk, fetched only when navigated to).
const Dashboard = lazy(() => import('./pages/Dashboard'));
// Camera Intelligence (P1 + P2)
const CameraRegistry = lazy(() => import('./pages/CameraRegistry'));
const LiveCameras = lazy(() => import('./pages/LiveCameras'));       // Unified Video
const ProtocolHealth = lazy(() => import('./pages/ProtocolHealth'));
// AI & Intelligence (P3 + P4)
const AIAnalytics = lazy(() => import('./pages/AIAnalytics'));
const Watchlists = lazy(() => import('./pages/Watchlists'));
// Operations (P5 + System)
const Investigation = lazy(() => import('./pages/Investigation'));
const SystemNetwork = lazy(() => import('./pages/SystemNetwork'));
const Administration = lazy(() => import('./pages/Administration'));
const Settings = lazy(() => import('./pages/Settings'));

// Legacy Model1/2/3/4 page stubs — kept as thin redirect wrappers so any
// bookmarks or external links still work without 404s.
const Model1 = lazy(() => import('./pages/Model1'));
const Model2 = lazy(() => import('./pages/Model2'));
const Model3 = lazy(() => import('./pages/Model3'));
const Model4 = lazy(() => import('./pages/Model4'));

function App() {
  const location = useLocation();
  const isLoginRoute = location.pathname === '/login';

  if (!isLoginRoute && !api.hasSession()) {
    return <Navigate to="/login" replace />;
  }

  // Mobile nav toggle — sidebar becomes off-canvas overlay below 880px
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
                  {/* Primary routes */}
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />

                  {/* Camera Intelligence */}
                  <Route path="/registry" element={<CameraRegistry />} />
                  <Route path="/cameras" element={<Navigate to="/registry" replace />} />
                  <Route path="/cctv-registry" element={<Navigate to="/registry" replace />} />
                  <Route path="/unified-video" element={<LiveCameras />} />
                  <Route path="/protocol-health" element={<ProtocolHealth />} />

                  {/* AI & Intelligence */}
                  <Route path="/ai-analytics" element={<AIAnalytics />} />
                  <Route path="/watchlists" element={<Watchlists />} />

                  {/* Operations */}
                  <Route path="/investigation" element={<Investigation />} />
                  <Route path="/system" element={<SystemNetwork />} />
                  <Route path="/admin" element={<Administration />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* Legacy Model 1/2/3/4 compatibility routes */}
                  <Route path="/model-1" element={<Model1 />} />
                  <Route path="/model-2" element={<Model2 />} />
                  <Route path="/model-3" element={<AIAnalytics />} />
                  <Route path="/model-4" element={<Model4 />} />

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
