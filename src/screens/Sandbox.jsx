import React from 'react';
import { useWizard } from '../store.jsx';

const BACKENDS = [
  { id: 'local', name: 'Local', desc: 'Runs tools directly on your machine. Fastest, least isolated.' },
  { id: 'docker', name: 'Docker', desc: 'Isolated container per session. Recommended.' },
];

export default function Sandbox() {
  const { state, update, next, back } = useWizard();

  return (
    <div className="screen">
      <h2>Sandbox</h2>
      <p className="lede">Where Hermes runs the commands and code it generates. Local is fine for v1; Docker is safer.</p>

      <div className="choice-grid">
        {BACKENDS.map((b) => (
          <div
            key={b.id}
            className={`choice ${state.sandbox === b.id ? 'selected' : ''}`}
            onClick={() => update({ sandbox: b.id })}
          >
            <h4>{b.name}</h4>
            <p>{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn primary" onClick={next}>Continue</button>
      </div>
    </div>
  );
}
