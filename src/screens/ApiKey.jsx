import React from 'react';
import { useWizard } from '../store.jsx';

const PROVIDER_GUIDE = {
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-',
    steps: [
      'Sign up or log in at openrouter.ai',
      'Click "Keys" in the left sidebar',
      'Click "Create Key", give it a name (e.g. "Hermes")',
      'Copy the key — starts with sk-or- — and paste it below',
      'Add credit at openrouter.ai/credits ($5 minimum is plenty for testing)',
    ],
  },
  nous: {
    name: 'Nous Portal',
    url: 'https://portal.nousresearch.com',
    keyPrefix: '',
    steps: [
      'Sign up at portal.nousresearch.com',
      'Go to API Keys in your account settings',
      'Generate a new key and copy it',
      'Paste below — Nous Portal is the native provider for Hermes',
    ],
  },
  anthropic: {
    name: 'Anthropic',
    url: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    steps: [
      'Log in at console.anthropic.com',
      'Go to Settings → API Keys',
      'Click "Create Key", name it (e.g. "Hermes")',
      'Copy the key — starts with sk-ant- — and paste below',
      'Make sure you have credits at console.anthropic.com/settings/billing',
    ],
  },
  openai: {
    name: 'OpenAI',
    url: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    steps: [
      'Log in at platform.openai.com',
      'Go to API keys (gear icon → API keys)',
      'Click "Create new secret key", give it a name',
      'Copy the key (you won\'t see it again) — starts with sk-',
      'Paste below. You need a paid account with credit',
    ],
  },
  nvidia: {
    name: 'NVIDIA NIM',
    url: 'https://build.nvidia.com',
    keyPrefix: 'nvapi-',
    steps: [
      'Sign in at build.nvidia.com',
      'Pick any model (e.g. z-ai/glm-5.1) and click it',
      'On the right, click "Get API Key"',
      'Copy the key — starts with nvapi- — and paste below',
      'Free tier gives you 1,000 requests; paid plans on top',
    ],
  },
};

export default function ApiKey() {
  const { state, update, next, back } = useWizard();
  const guide = PROVIDER_GUIDE[state.provider];
  const valid = state.apiKey.trim().length > 10;

  function openLink(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="screen">
      <h2>{guide.name} API key</h2>
      <p className="lede">
        Follow the steps below to get a key. It's stored in your OS keychain — never plaintext on disk.
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <label style={{ margin: 0 }}>How to get your key</label>
          <button className="btn" onClick={() => openLink(guide.url)}>
            Open {guide.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')} ↗
          </button>
        </div>
        <ol className="steps">
          {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>

      <div className="card">
        <label>Paste your API key</label>
        <input
          type="password"
          value={state.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder={guide.keyPrefix ? `${guide.keyPrefix}…` : 'paste here'}
          autoFocus
          spellCheck={false}
        />
        {guide.keyPrefix && state.apiKey && !state.apiKey.startsWith(guide.keyPrefix) && (
          <p style={{ color: 'var(--live)', fontSize: 12, margin: '8px 0 0' }}>
            Heads up — {guide.name} keys usually start with <code>{guide.keyPrefix}</code>. Double-check you copied the right one.
          </p>
        )}
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn primary" onClick={next} disabled={!valid}>Continue</button>
      </div>
    </div>
  );
}
