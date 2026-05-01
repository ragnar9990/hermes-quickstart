import React from 'react';
import { useWizard } from '../store.jsx';

const PLATFORMS = [
  { id: 'telegram', name: 'Telegram', help: 'Create a bot via @BotFather, paste the token.' },
  { id: 'discord', name: 'Discord', help: 'Create an app at discord.com/developers, paste bot token.' },
  { id: 'slack', name: 'Slack', help: 'Slack OAuth app token (xoxb-...).' },
];

export default function Platforms() {
  const { state, update, next, back } = useWizard();

  function toggle(id) {
    update({
      platforms: {
        ...state.platforms,
        [id]: { ...state.platforms[id], enabled: !state.platforms[id].enabled },
      },
    });
  }

  function setToken(id, token) {
    update({
      platforms: {
        ...state.platforms,
        [id]: { ...state.platforms[id], token },
      },
    });
  }

  return (
    <div className="screen">
      <h2>Chat platforms <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 14 }}>(optional)</span></h2>
      <p className="lede">Enable any platforms you want to message Hermes from. Skip if you only want CLI for now.</p>

      {PLATFORMS.map((p) => (
        <div key={p.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ margin: 0 }}>{p.name}</h4>
              <p style={{ color: 'var(--muted)', margin: '4px 0 0', fontSize: 12 }}>{p.help}</p>
            </div>
            <button
              className={`btn ${state.platforms[p.id].enabled ? 'primary' : ''}`}
              onClick={() => toggle(p.id)}
            >
              {state.platforms[p.id].enabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
          {state.platforms[p.id].enabled && (
            <div style={{ marginTop: 12 }}>
              <label>Bot token</label>
              <input
                type="password"
                value={state.platforms[p.id].token}
                onChange={(e) => setToken(p.id, e.target.value)}
                placeholder="paste token"
              />
            </div>
          )}
        </div>
      ))}

      <div className="actions">
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn primary" onClick={next}>Continue</button>
      </div>
    </div>
  );
}
