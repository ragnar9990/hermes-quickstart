import React, { useEffect, useState } from 'react';
import { useWizard } from '../store.jsx';

export default function Welcome() {
  const { update, next, state } = useWizard();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const os = await window.hermes.detect.os();
      const wsl = await window.hermes.detect.wsl();
      const hermes = await window.hermes.detect.hermes();
      update({ os, wsl, hermes });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="screen">
      <h2>Welcome</h2>
      <p className="lede">
        This wizard will install and configure Hermes Agent on your machine.
        It takes about 5 minutes for first-time setup.
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <label>Detected system</label>
            <div style={{ fontSize: 16 }}>
              {loading ? 'Detecting…' : `${state.os?.label} (${state.os?.arch})`}
            </div>
          </div>
          {state.hermes?.onPath && <span className="tag ok">Hermes already installed</span>}
        </div>

        {state.os?.platform === 'win32' && state.wsl && (
          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <div>
              <label>WSL2</label>
              <div>{state.wsl.installed ? 'Installed' : 'Not installed — will be set up next'}</div>
            </div>
            {state.wsl.installed
              ? <span className="tag ok">Ready</span>
              : <span className="tag warn">Needs install</span>}
          </div>
        )}
      </div>

      <div className="actions">
        <span />
        <button className="btn primary" onClick={next} disabled={loading}>
          Get started
        </button>
      </div>
    </div>
  );
}
