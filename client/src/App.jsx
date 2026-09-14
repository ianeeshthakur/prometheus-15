import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AccessibilityBar from './components/AccessibilityBar';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Model1 from './pages/Model1';
import Model2 from './pages/Model2';
import Model3 from './pages/Model3';
import Model4 from './pages/Model4';
import Investigation from './pages/Investigation';
import Watchlists from './pages/Watchlists';
import Settings from './pages/Settings';
import LoginScreen from './pages/LoginScreen';
import api from './api/client';
import './components/Layout.css';

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

  return (
    <div className={isLoginRoute ? '' : 'app-shell'}>
      {isLoginRoute ? <LoginScreen /> : (
        <>
          <AccessibilityBar />
          <Topbar />
          <div className="app-body">
            <Sidebar />
            <main className="page-content" id="main-content" tabIndex={-1}>
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
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </>
      )}
    </div>
  );
}

function RoutedApp() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

export default RoutedApp;
