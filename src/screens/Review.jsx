import React, { useEffect, useState } from 'react';
import { useWizard } from '../store.jsx';

export default function Review() {
  const { state, next, back } = useWizard();
  const [yaml, setYaml] = useState('');

  useEffect(() => {
    (async () => {
      const cfg = {
        provider: state.provider,
        model: state.model,
        sandbox: state.sandbox,
        platforms: state.platforms,
      };
      const text = await window.hermes.config.preview(cfg);
      setYaml(text);
    })();
  }, [state]);

  return (
    <div className="screen">
      <h2>Review</h2>
      <p className="lede">Here's the config that will be written to <code>~/.hermes/config.yaml</code>.</p>

      <div className="card">
        <label>config.yaml preview</label>
        <pre className="log" style={{ maxHeight: 280 }}>{yaml}</pre>
      </div>

      <div className="card">
        <label>Secrets (stored in OS keychain)</label>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)' }}>
          <li>{state.provider} API key</li>
          {Object.entries(state.platforms).filter(([, v]) => v.enabled).map(([k]) => (
            <li key={k}>{k} bot token</li>
          ))}
        </ul>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn primary" onClick={next}>Install Hermes</button>
      </div>
    </div>
  );
}
