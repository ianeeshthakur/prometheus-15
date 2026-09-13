import React, { useState } from 'react';
import VariableCard from '../components/VariableCard';
import './HomePage.css';

const themeVariables = [
  {
    name: '--bg-primary',
    value: '#ffffff',
    description: 'Main card, panel, and surface background',
    previewStyle: { backgroundColor: 'var(--bg-primary)' },
  },
  {
    name: '--bg-secondary',
    value: '#f8fafc',
    description: 'Page background & subtle secondary container canvas',
    previewStyle: { backgroundColor: 'var(--bg-secondary)' },
  },
  {
    name: '--text-primary',
    value: '#0f172a',
    description: 'High-contrast primary heading & body text',
    previewStyle: { backgroundColor: 'var(--text-primary)' },
  },
  {
    name: '--text-secondary',
    value: '#475569',
    description: 'Subtle captions, metadata & secondary descriptions',
    previewStyle: { backgroundColor: 'var(--text-secondary)' },
  },
  {
    name: '--accent',
    value: '#0284c7',
    description: 'Vibrant clean blue accent for interactive elements',
    previewStyle: { backgroundColor: 'var(--accent)' },
  },
  {
    name: '--border-color',
    value: '#e2e8f0',
    description: 'Clean subtle divider & outline borders',
    previewStyle: { backgroundColor: 'var(--border-color)' },
  },
  {
    name: '--shadow',
    value: '0 4px 6px -1px rgba(...)',
    description: 'Soft subtle elevation shadow for light surfaces',
    previewStyle: {
      backgroundColor: 'var(--bg-primary)',
      boxShadow: 'var(--shadow)',
    },
  },
];

function HomePage() {
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="header-inner">
          <div className="logo-group">
            <span className="theme-badge">Light Theme</span>
            <span className="app-title">Surveillance AI Starter</span>
          </div>
          <a
            href="#tokens"
            className="header-link"
          >
            Tokens Checklist
          </a>
        </div>
      </header>

      <main className="home-main">
        {/* Hero Section */}
        <section className="hero-card">
          <h1 className="hero-title">Hello World</h1>
          <p className="hero-subtitle">
            The light theme foundation is loaded and active. All CSS custom variables
            are cleanly defined without third-party frameworks.
          </p>

          <div className="hero-actions">
            <button
              className="accent-btn"
              onClick={() => setClickCount((prev) => prev + 1)}
            >
              Interactive Accent Button
            </button>
            <span className="interaction-status">
              Clicked: <strong>{clickCount}</strong> {clickCount === 1 ? 'time' : 'times'}
            </span>
          </div>
        </section>

        {/* Theme Variables Inspection Grid */}
        <section id="tokens" className="tokens-section">
          <div className="section-header">
            <h2 className="section-title">Active Theme Variables</h2>
            <p className="section-desc">
              Direct verification of theme custom properties mapped from <code>theme.css</code>:
            </p>
          </div>

          <div className="tokens-grid">
            {themeVariables.map((item) => (
              <VariableCard
                key={item.name}
                name={item.name}
                value={item.value}
                description={item.description}
                previewStyle={item.previewStyle}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <p>Clean Light Theme • Vite + React • Zero External UI Libraries</p>
      </footer>
    </div>
  );
}

export default HomePage;
