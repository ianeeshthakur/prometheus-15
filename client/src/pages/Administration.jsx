import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './Administration.css';

// docs/frontend.md §5's last remaining stub, mapped to prd.md's "Administration"
// requirement: users & roles, audit log, and the DPDP-aware facial-recognition
// privacy toggle (docs/backend.md §7 -- explicit authorization required, never a
// default). All three tabs below are real (server/routers/auth.py's /users,
// server/routers/admin.py's /audit-log and /facial-recognition), admin-only on the
// backend -- an OPERATOR account gets a real 403, shown honestly, not a silent
// empty table pretending they have no data.

const TABS = ['Users & Roles', 'Audit Log', 'Facial Recognition'];

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'OPERATOR', department_scope: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api
      .getUsers()
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.username || !form.password) {
      setFormError('Username and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createUser({ ...form, department_scope: form.department_scope || null });
      setForm({ username: '', password: '', full_name: '', role: 'OPERATOR', department_scope: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <p className="admin-permission-error">Could not load users: {error}. Admin access is required.</p>;

  return (
    <div>
      <div className="admin-tab-toolbar">
        <span>{loading ? 'Loading…' : `${users.length} users`}</span>
        <button type="button" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add user'}</button>
      </div>

      {showForm && (
        <form className="admin-inline-form" onSubmit={handleSubmit}>
          <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input placeholder="Full name (optional)" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="OPERATOR">OPERATOR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <input placeholder="Department scope (operators only)" value={form.department_scope} onChange={(e) => setForm({ ...form, department_scope: e.target.value })} />
          <button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</button>
          {formError && <p className="admin-form-error">{formError}</p>}
        </form>
      )}

      <table className="admin-table">
        <thead><tr><th>Username</th><th>Full name</th><th>Role</th><th>Department scope</th><th>Last login</th><th>Active</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="mono">{u.username}</td>
              <td>{u.full_name || '—'}</td>
              <td>{u.role}</td>
              <td>{u.department_scope || '—'}</td>
              <td>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
              <td><StatusBadge status={u.active ? 'active' : 'inactive'} size="sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditLogTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getAuditLog(200)
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="admin-permission-error">Could not load audit log: {error}. Admin access is required.</p>;

  return (
    <div>
      <div className="admin-tab-toolbar"><span>{loading ? 'Loading…' : `${entries.length} entries`}</span></div>
      <table className="admin-table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Resource</th><th>Detail</th></tr></thead>
        <tbody>
          {entries.length === 0 && !loading && <tr><td colSpan={5}>No audit entries yet.</td></tr>}
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="mono">{new Date(e.created_at).toLocaleString()}</td>
              <td>{e.username || '—'}</td>
              <td>{e.action}</td>
              <td>{e.resource_type ? `${e.resource_type} ${e.resource_id || ''}` : '—'}</td>
              <td>{e.detail || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FacialRecognitionTab() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .getFacialRecognitionStatus()
      .then(setStatus)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleToggle = async () => {
    if (!reason.trim()) {
      setActionError('A stated reason is required to change this setting -- see backend/schemas/admin_settings.py.');
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      await api.setFacialRecognitionAuthorization(!status.currently_enabled, reason);
      setReason('');
      load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <p className="admin-permission-error">Could not load facial-recognition status: {error}. Admin access is required.</p>;
  if (loading || !status) return <p>Loading…</p>;

  return (
    <div>
      <div className="fr-status-card">
        <div>
          <strong>Facial recognition is currently {status.currently_enabled ? 'ENABLED' : 'DISABLED'}</strong>
          <p>
            Off by default per India's DPDP Act 2023 / the Puttaswamy privacy judgment (docs/backend.md §7). Never
            toggled automatically -- every change here requires a stated reason and is logged, on or off.
          </p>
        </div>
        <StatusBadge status={status.currently_enabled ? 'active' : 'inactive'} />
      </div>

      <div className="admin-inline-form" style={{ marginTop: 14 }}>
        <input
          placeholder="Reason for this change (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ flex: 1, minWidth: 260 }}
        />
        <button type="button" onClick={handleToggle} disabled={submitting}>
          {submitting ? 'Submitting…' : status.currently_enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
      {actionError && <p className="admin-form-error">{actionError}</p>}

      <h3 style={{ marginTop: 20, fontSize: '0.85rem' }}>Authorization history</h3>
      <table className="admin-table">
        <thead><tr><th>When</th><th>By</th><th>Change</th><th>Reason</th></tr></thead>
        <tbody>
          {status.history.length === 0 && <tr><td colSpan={4}>No authorization changes recorded.</td></tr>}
          {status.history.map((h) => (
            <tr key={h.id}>
              <td className="mono">{new Date(h.created_at).toLocaleString()}</td>
              <td>{h.authorized_by}</td>
              <td>{h.enabled ? 'Enabled' : 'Disabled'}</td>
              <td>{h.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Administration() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="administration-page">
      <header className="admin-header">
        <span className="section-eyebrow">PLATFORM / ADMINISTRATION</span>
        <h1>{t('admin_title')}</h1>
        <p>{t('admin_subtitle')}</p>
      </header>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={activeTab === t ? 'active' : ''} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      <div className="admin-tab-content">
        {activeTab === 'Users & Roles' && <UsersTab />}
        {activeTab === 'Audit Log' && <AuditLogTab />}
        {activeTab === 'Facial Recognition' && <FacialRecognitionTab />}
      </div>
    </div>
  );
}

export default Administration;
