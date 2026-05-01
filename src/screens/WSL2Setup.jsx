import React from 'react';
import { useWizard } from '../store.jsx';

export default function WSL2Setup() {
  const { state, next, back } = useWizard();
  const installed = state.wsl?.installed;

  return (
    <div className="screen">
      <h2>WSL2</h2>
      <p className="lede">
        Hermes runs on Linux. On Windows, this wizard installs WSL2 + Ubuntu and runs Hermes inside it.
      </p>

      <div className="card">
        {installed ? (
          <>
            <span className="tag ok">WSL2 detected</span>
            <p style={{ marginTop: 12 }}>You're all set. Continue to choose your LLM provider.</p>
          </>
        ) : (
          <>
            <span className="tag warn">WSL2 will be installed</span>
            <ul style={{ marginTop: 12, color: 'var(--muted)' }}>
              <li>Requires admin rights — Windows will prompt you.</li>
              <li>A reboot may be required after install.</li>
              <li>If reboot is needed, reopen this wizard afterwards to continue.</li>
            </ul>
          </>
        )}
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn primary" onClick={next}>Continue</button>
      </div>
    </div>
  );
}
