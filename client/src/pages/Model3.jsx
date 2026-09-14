import React from 'react';

// Deliberately not built -- not a gap, a decision. The hackathon's Model 3
// (VMS Federation/middleware) was evaluated and explicitly rejected for this
// project's architecture (server's integration-model decision, docs/prd.md §15):
// it would duplicate what the adapter factory already does and contradicts Model 2's
// "no middleware" requirement, which this project pairs with Model 1 instead. Building
// real federation middleware here would contradict a decision already made elsewhere
// in the system -- so this page says that honestly instead of shipping either an
// empty heading or a fake feature.
function Model3() {
  return (
    <div style={{ maxWidth: 560, padding: '24px 4px' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        Model 3 · VMS Federation
      </span>
      <h1 style={{ margin: '8px 0 12px', fontSize: '1.3rem', color: 'var(--text-primary)' }}>Not built -- by design, not by omission</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
        This project's integration-model decision is Model 1 (mandatory registry) + Model 2 (direct
        per-protocol adapters, no middleware) + Model 4 elements (a centralized AI/intelligence
        layer). Model 3's federation/middleware layer was evaluated and rejected: it would duplicate
        what the adapter factory already does, and directly contradicts Model 2's "no intermediate
        middleware" requirement -- the model this project actually pairs with Model 1.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginTop: 12 }}>
        Building real VMS federation here would mean reversing that decision, not filling a gap.
        See <code>docs/prd.md</code> §15's decision log for the full rationale.
      </p>
    </div>
  );
}

export default Model3;
