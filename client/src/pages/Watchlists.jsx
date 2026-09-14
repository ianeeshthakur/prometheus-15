import React, { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import api from '../api/client';
import './Watchlists.css';

const CATEGORIES = [
  { value: 'STOLEN_VEHICLE', label: 'Stolen Vehicles' },
  { value: 'WANTED_PERSON', label: 'Wanted & Missing Persons' },
  { value: 'CUSTOM', label: 'Custom' },
];

const RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const RISK_VARIANT = { CRITICAL: 'red', HIGH: 'amber', MEDIUM: 'blue', LOW: 'gray' };

const emptyForm = { identifier: '', category: 'STOLEN_VEHICLE', description: '', risk_level: 'MEDIUM', source: '', added_by: '' };

function Watchlists() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = () => {
    setLoading(true);
    api
      .getWatchlistEntries()
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const filteredEntries = useMemo(
    () => (activeCategory === 'ALL' ? entries : entries.filter((e) => e.category === activeCategory)),
    [entries, activeCategory]
  );

  const criticalCount = entries.filter((e) => e.risk_level === 'CRITICAL').length;
  const totalMatches = entries.reduce((sum, e) => sum + (e.match_count || 0), 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.identifier.trim()) {
      setSubmitError('Identifier is required.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.createWatchlistEntry(form);
      setForm(emptyForm);
      setShowForm(false);
      loadEntries();
    } catch (err) {
      setSubmitError(err.message || 'Failed to add watchlist entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'identifier', label: 'Identifier', sortable: true, render: (val) => <span className="watchlist-identifier">{val}</span> },
      {
        key: 'category',
        label: 'Category',
        sortable: true,
        render: (val) => CATEGORIES.find((c) => c.value === val)?.label || val,
      },
      {
        key: 'risk_level',
        label: 'Risk',
        sortable: true,
        render: (val) => <StatusBadge status={val} label={val} variant={RISK_VARIANT[val] || 'gray'} pulse={val === 'CRITICAL'} />,
      },
      { key: 'description', label: 'Description', render: (val) => val || '—' },
      { key: 'source', label: 'Source', render: (val) => val || '—' },
      { key: 'added_by', label: 'Added by', render: (val) => val || '—' },
      {
        key: 'match_count',
        label: 'Matches',
        sortable: true,
        align: 'right',
        render: (val) => <span className="watchlist-match-count">{val ?? 0}</span>,
      },
      {
        key: 'active',
        label: 'Status',
        render: (val) => <StatusBadge status={val ? 'active' : 'inactive'} />,
      },
    ],
    []
  );

  return (
    <div className="watchlists-page">
      <header className="watchlists-header">
        <div>
          <span className="section-eyebrow">INTELLIGENCE / WATCHLISTS</span>
          <h1>Watchlists</h1>
          <p>Manage the identifiers the alert engine matches every incoming plate/person read against.</p>
        </div>
        <button type="button" className="watchlists-add-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add entry'}
        </button>
      </header>

      <div className="watchlists-stats">
        <StatCard label="Total entries" value={entries.length} accent="blue" />
        <StatCard label="Critical risk" value={criticalCount} accent="red" />
        <StatCard label="Total matches recorded" value={totalMatches} accent="amber" />
      </div>

      {showForm && (
        <form className="watchlist-form" onSubmit={handleSubmit}>
          <div className="watchlist-form-grid">
            <label>
              <span>Identifier *</span>
              <input
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                placeholder="e.g. GJ01AB4521"
              />
            </label>
            <label>
              <span>Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Risk level</span>
              <select value={form.risk_level} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Source</span>
              <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. FIR-2026-3312" />
            </label>
            <label>
              <span>Added by</span>
              <input value={form.added_by} onChange={(e) => setForm({ ...form, added_by: e.target.value })} placeholder="Officer name/badge" />
            </label>
            <label className="watchlist-form-description">
              <span>Description</span>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional context" />
            </label>
          </div>
          {submitError && <p className="watchlist-form-error">{submitError}</p>}
          <button type="submit" className="watchlist-form-submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add to watchlist'}
          </button>
        </form>
      )}

      <div className="watchlist-tabs">
        <button type="button" className={activeCategory === 'ALL' ? 'active' : ''} onClick={() => setActiveCategory('ALL')}>
          All ({entries.length})
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} type="button" className={activeCategory === c.value ? 'active' : ''} onClick={() => setActiveCategory(c.value)}>
            {c.label} ({entries.filter((e) => e.category === c.value).length})
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={filteredEntries}
        rowKey="id"
        searchable
        searchPlaceholder="Search identifier, description, source..."
        emptyMessage={loading ? 'Loading watchlist entries…' : 'No watchlist entries yet.'}
      />
    </div>
  );
}

export default Watchlists;
