import React, { useEffect, useState } from 'react';
import { useWizard } from '../store.jsx';

const CUSTOM = '__custom__';

const MODELS = {
  openrouter: [
    'anthropic/claude-opus-4-7',
    'anthropic/claude-sonnet-4-6',
    'openai/gpt-4o',
    'meta-llama/llama-3.1-405b-instruct',
    'nousresearch/hermes-3-llama-3.1-405b',
    'zai-org/glm-4.5',
    'deepseek/deepseek-r1',
    'qwen/qwen-2.5-72b-instruct',
  ],
  nous: ['hermes-3-405b', 'hermes-3-70b'],
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1'],
  nvidia: [
    'z-ai/glm-5.1',
    'z-ai/glm4.7',
    'z-ai/glm5',
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-405b-instruct',
    'meta/llama-3.1-70b-instruct',
    'meta/llama-4-maverick-17b-128e-instruct',
    'mistralai/mixtral-8x22b-instruct-v0.1',
    'mistralai/mixtral-8x7b-instruct-v0.1',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    'deepseek-ai/deepseek-v3.2',
    'qwen/qwen3-coder-480b-a35b-instruct',
    'qwen/qwen2.5-coder-32b-instruct',
    'moonshotai/kimi-k2-thinking',
    'openai/gpt-oss-120b',
  ],
};

export default function Model() {
  const { state, update, next, back } = useWizard();
  const options = MODELS[state.provider] || [];
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    setIsCustom(false);
    setCustomValue('');
    if (options.length > 0) update({ model: options[0] });
  }, [state.provider]);

  function onSelect(e) {
    const val = e.target.value;
    if (val === CUSTOM) {
      setIsCustom(true);
      update({ model: customValue });
    } else {
      setIsCustom(false);
      update({ model: val });
    }
  }

  function onCustomChange(e) {
    const v = e.target.value;
    setCustomValue(v);
    update({ model: v });
  }

  const valid = state.model && state.model.trim().length > 0;

  return (
    <div className="screen">
      <h2>Pick a model</h2>
      <p className="lede">
        You can swap this anytime via <code>hermes model</code>. Don't see your model? Pick <strong>Custom</strong> and paste the exact model ID.
      </p>

      <div className="card">
        <label>Model</label>
        <select value={isCustom ? CUSTOM : state.model} onChange={onSelect}>
          {options.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value={CUSTOM}>Custom...</option>
        </select>

        {isCustom && (
          <div style={{ marginTop: 12 }}>
            <label>Custom model ID</label>
            <input
              type="text"
              value={customValue}
              onChange={onCustomChange}
              placeholder="e.g. zai-org/glm-4.5 or anthropic/claude-opus-4-7"
              autoFocus
              spellCheck={false}
            />
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '6px 0 0' }}>
              Paste exactly as it appears in your provider's docs — case-sensitive, including any prefix.
            </p>
          </div>
        )}
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={back}>Back</button>
        <button className="btn primary" onClick={next} disabled={!valid}>Continue</button>
      </div>
    </div>
  );
}
