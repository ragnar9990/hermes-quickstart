import React, { useEffect, useRef, useState } from 'react';
import { useWizard } from '../store.jsx';

// Heuristics that map streaming installer output to a 0-100 progress estimate
// and a human-readable phase label. wsl --install is fairly opaque, so this is
// best-effort — but it's far better than a spinner with no context.
function phaseFor(log) {
  if (/distro ready|Default user set up|whoami|WSL2 \+ distro ready/i.test(log)) {
    return { label: 'Ready', detail: 'WSL2 + Ubuntu are set up', pct: 100 };
  }
  if (/Default user|Initializing default user|terminate Ubuntu/i.test(log)) {
    return { label: 'Configuring Ubuntu', detail: 'Setting up the default Linux user', pct: 90 };
  }
  if (/Ubuntu installed|installDistro|--install -d Ubuntu/i.test(log)) {
    return { label: 'Installing Ubuntu', detail: 'Downloading and unpacking the distro', pct: 70 };
  }
  if (/Install command completed|reboot is typically required/i.test(log)) {
    return { label: 'Reboot required', detail: 'Restart Windows then reopen this wizard', pct: 100 };
  }
  if (/Installing WSL2 \+ Ubuntu|Start-Process|RunAs/i.test(log)) {
    return { label: 'Installing WSL2', detail: 'Admin elevation in progress (UAC prompt)', pct: 35 };
  }
  if (/no distro found|Installing Ubuntu/i.test(log)) {
    return { label: 'Installing Ubuntu', detail: 'WSL2 is ready, installing the Linux distro', pct: 50 };
  }
  if (/Checking WSL2 status/i.test(log)) {
    return { label: 'Checking your system', detail: 'Probing for WSL and existing distros', pct: 10 };
  }
  return { label: 'Working...', detail: 'This can take a few minutes', pct: 20 };
}

export default function WSL2Setup() {
  const { state, update, next, back } = useWizard();
  const [status, setStatus] = useState(
    state.wsl?.installed && state.wsl?.hasDistro ? 'ready' : 'idle'
  );
  const [log, setLog] = useState('');
  const [error, setError] = useState('');
  const [needsReboot, setNeedsReboot] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    const off = window.hermes.wsl.onLog((chunk) => {
      setLog((cur) => cur + chunk);
    });
    return off;
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function startInstall() {
    setError('');
    setLog('');
    setStatus('running');
    try {
      const r = await window.hermes.wsl.install();
      if (r.rebooted) {
        setNeedsReboot(true);
        setStatus('reboot');
      } else {
        setStatus('ready');
        // refresh detection state in the wizard
        const wsl = await window.hermes.detect.wsl();
        update({ wsl });
      }
    } catch (err) {
      setError(err.message || 'Install failed.');
      setStatus('error');
    }
  }

  const phase = phaseFor(log);
  const canContinue = status === 'ready';

  return (
    <div className="screen">
      <h2>WSL2</h2>
      <p className="lede">
        Hermes runs on Linux. On Windows, this wizard installs WSL2 + Ubuntu and
        runs Hermes inside it. You can't continue until WSL is set up.
      </p>

      <div className="card">
        {status === 'ready' && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>WSL2 is ready</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  A working Linux distro is detected. Continue to the next step.
                </div>
              </div>
              <span className="tag ok">Ready</span>
            </div>
          </>
        )}

        {status === 'idle' && (
          <>
            <span className="tag warn">WSL2 not detected</span>
            <ul style={{ marginTop: 12, color: 'var(--muted)', lineHeight: 1.65 }}>
              <li>Click <strong>Install WSL2</strong> below to begin.</li>
              <li>Windows will show a UAC prompt — click <strong>Yes</strong> when it appears.</li>
              <li>If a reboot is needed, you'll be told. Reopen this wizard after restarting.</li>
              <li>This step can take 3–10 minutes depending on your connection.</li>
            </ul>
          </>
        )}

        {(status === 'running' || status === 'reboot' || status === 'error') && (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{phase.label}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>{phase.detail}</div>
              </div>
              {status === 'running' && <span className="tag">In progress</span>}
              {status === 'reboot' && <span className="tag warn">Reboot needed</span>}
              {status === 'error' && <span className="tag warn">Error</span>}
            </div>

            <div className="progress-bar">
              <div
                className={`progress-fill ${status === 'error' ? 'err' : ''}`}
                style={{ width: `${phase.pct}%` }}
              />
              <span className="progress-pct">{phase.pct}%</span>
            </div>

            <pre className="log" ref={logRef} style={{ marginTop: 18, maxHeight: 200 }}>{log || '...'}</pre>

            {status === 'reboot' && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.25)', borderRadius: 8, color: 'var(--text-2)', fontSize: 13 }}>
                <strong>Restart Windows</strong> to finish the WSL2 install. After your PC comes back up,
                reopen Hermes Quickstart and we'll pick up from here.
              </div>
            )}

            {status === 'error' && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.22)', borderRadius: 8, color: 'var(--live)', fontSize: 13 }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={back} disabled={status === 'running'}>Back</button>

        {status === 'idle' && (
          <button className="btn primary" onClick={startInstall}>Install WSL2</button>
        )}

        {status === 'running' && (
          <button className="btn primary" disabled>Installing...</button>
        )}

        {status === 'error' && (
          <button className="btn primary" onClick={startInstall}>Retry</button>
        )}

        {status === 'reboot' && (
          <button className="btn" onClick={() => window.close()}>Close until reboot</button>
        )}

        {status === 'ready' && (
          <button className="btn primary" onClick={next} disabled={!canContinue}>Continue</button>
        )}
      </div>
    </div>
  );
}
