import React from 'react';
import { useWizard } from '../store.jsx';

const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', desc: '200+ models, single key. Easiest if you want options.' },
  { id: 'nous', name: 'Nous Portal', desc: 'Native provider for Hermes. Recommended.' },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude models directly.' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT models directly.' },
  { id: 'nvidia', name: 'NVIDIA NIM', desc: 'NIM-hosted open models.' },
];

export default function Provider() {
  const { state, update, next, back } = useWizard();

  return (
    <div className="screen">
      <h2>Choose an LLM provider</h2>
      <p className="lede">Hermes is provider-agnostic — pick one to start. You can change or add more later.</p>

      <div className="choice-grid">
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className={`choice ${state.provider === p.id ? 'selected' : ''}`}
            onClick={() => update({ provider: p.id })}
          >
            <h4>{p.name}</h4>
            <p>{p.desc}</p>
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
