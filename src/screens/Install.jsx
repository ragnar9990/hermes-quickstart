import React, { useEffect, useRef, useState } from 'react';
import { useWizard } from '../store.jsx';

const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07/g;
function stripAnsi(s) {
  return s.replace(ANSI_RE, '').replace(/\r(?!\n)/g, '\n');
}

const PROVIDER_ENV = {
  openrouter: 'OPENROUTER_API_KEY',
  nous: 'NOUS_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  nvidia: 'NVIDIA_API_KEY',
};

const PLATFORM_ENV = {
  telegram: 'TELEGRAM_BOT_TOKEN',
  discord: 'DISCORD_BOT_TOKEN',
  slack: 'SLACK_BOT_TOKEN',
};

const DEP_LABEL = {
  rg: 'ripgrep (fast file search)',
  ffmpeg: 'ffmpeg (voice/audio support)',
  git: 'git (version control, required)',
};

const PHASE = {
  checking: { label: 'Checking your system', detail: 'Looking for missing packages...' },
  'deps-needed': { label: 'Awaiting your approval', detail: 'Need permission to install system packages' },
  'installing-deps': { label: 'Installing system packages', detail: 'Downloading ripgrep and ffmpeg via apt' },
  'installing-hermes': { label: 'Installing Hermes Agent', detail: 'Setting up Python, uv, and the agent itself' },
  'writing-config': { label: 'Writing configuration', detail: 'Saving your config and API keys' },
  done: { label: 'All set', detail: 'Hermes is installed and configured' },
  reboot: { label: 'Reboot needed', detail: 'WSL2 install needs a Windows reboot' },
  error: { label: 'Something went wrong', detail: 'See the log below' },
};

// Map raw status + log heuristics to a more readable phase.
function phaseFromLog(status, log) {
  if (status !== 'running') return status;
  if (/Setup complete/i.test(log)) return 'done';
  if (/Writing.*config\.yaml|Writing.*\.env/i.test(log)) return 'writing-config';
  if (/Verifying \/ completing|uv pip install -e/i.test(log)) return 'pip-install';
  if (/Cloning into|fetching|Installing Python deps/i.test(log)) return 'cloning';
  if (/Installing Hermes|Checking Python|Checking Git|uv found|Python found/i.test(log)) return 'installing-hermes';
  return 'installing-hermes';
}

// Map status/phase to a 0-100 progress percentage.
const PROGRESS = {
  idle: 0,
  checking: 5,
  'deps-needed': 10,
  'installing-deps': 25,
  running: 40,
  'installing-hermes': 50,
  cloning: 60,
  'pip-install': 80,
  'writing-config': 92,
  done: 100,
  reboot: 100,
  error: 0,
};

export default function Install() {
  const { state } = useWizard();
  const [log, setLog] = useState('');
  const [status, setStatus] = useState('checking');
  const [missing, setMissing] = useState([]);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const logRef = useRef(null);
  const checkedRef = useRef(false);
  const installedRef = useRef(false);
  const sudoPasswordRef = useRef('');

  useEffect(() => {
    const off = window.hermes.install.onLog((chunk) => {
      setLog((cur) => cur + stripAnsi(chunk));
    });
    return off;
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Step 1 — preflight dependency check
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    (async () => {
      try {
        const r = await window.hermes.install.checkDeps();
        if (r.missing.length === 0) {
          startInstall();
        } else {
          setMissing(r.missing);
          setStatus('deps-needed');
        }
      } catch (err) {
        setLog((cur) => cur + `\n[error] dep check failed: ${err.message}\n`);
        setStatus('error');
      }
    })();
  }, []);

  async function approveDeps() {
    setPwError('');
    if (state.os?.platform !== 'darwin' && password.trim().length === 0) {
      setPwError('Password required to install system packages.');
      return;
    }
    setStatus('installing-deps');
    try {
      await window.hermes.install.installDeps(missing, password);
      sudoPasswordRef.current = password;
      setPassword('');
      startInstall();
    } catch (err) {
      setLog((cur) => cur + `\n[error] ${err.message}\n`);
      setPwError('Install failed — wrong password or apt error. See log.');
      setStatus('deps-needed');
    }
  }

  function skipDeps() {
    setLog((cur) => cur + '\n[deps] User skipped optional dependency install.\n');
    startInstall();
  }

  // Step 2 — actual Hermes install
  async function startInstall() {
    if (installedRef.current) return;
    installedRef.current = true;
    setStatus('running');
    try {
      await window.hermes.secrets.set(`${state.provider}-api-key`, state.apiKey);
      for (const [name, p] of Object.entries(state.platforms)) {
        if (p.enabled && p.token) {
          await window.hermes.secrets.set(`${name}-token`, p.token);
        }
      }

      const config = {
        provider: state.provider,
        model: state.model,
        sandbox: state.sandbox,
        gateways: Object.fromEntries(
          Object.entries(state.platforms)
            .filter(([, v]) => v.enabled)
            .map(([k]) => [k, { enabled: true }])
        ),
      };

      const env = { [PROVIDER_ENV[state.provider]]: state.apiKey };
      for (const [name, p] of Object.entries(state.platforms)) {
        if (p.enabled && p.token) env[PLATFORM_ENV[name]] = p.token;
      }

      const enabledPlatforms = Object.entries(state.platforms)
        .filter(([, v]) => v.enabled && v.token)
        .map(([k]) => k);

      const r = await window.hermes.install.run({
        config,
        env,
        sudoPassword: sudoPasswordRef.current || undefined,
        enabledPlatforms,
      });
      setStatus(r.requiresReboot ? 'reboot' : 'done');
    } catch (err) {
      setLog((cur) => cur + `\n[error] ${err.message}\n`);
      setStatus('error');
    }
  }

  const phaseKey = phaseFromLog(status, log);
  const phase = PHASE[phaseKey] || PHASE.checking;
  const progress = PROGRESS[phaseKey] ?? PROGRESS[status] ?? 0;
  const isHealthy = status !== 'error';
  const isWorking = ['checking', 'installing-deps', 'running'].includes(status);

  return (
    <div className="screen">
      <h2>Installing</h2>

      <div className="status-card">
        <div className="status-row">
          <span className={`status-spinner ${isWorking ? 'on' : ''}`} data-status={status} />
          <div className="status-text">
            <div className="status-label">{phase.label}</div>
            <div className="status-detail">{phase.detail}</div>
          </div>
          <span className={`status-badge ${isHealthy ? 'ok' : 'err'}`}>
            {status === 'error' ? 'error' : status === 'done' ? 'complete' : 'all good'}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${status === 'error' ? 'err' : ''}`}
            style={{ width: `${progress}%` }}
          />
          <span className="progress-pct">{progress}%</span>
        </div>
      </div>

      {status === 'deps-needed' && (
        <div className="card">
          <label>Missing packages</label>
          <ul style={{ margin: '0 0 16px', paddingLeft: 18, color: 'var(--text)', lineHeight: 1.7 }}>
            {missing.map((m) => <li key={m}>{DEP_LABEL[m] || m}</li>)}
          </ul>

          {state.os?.platform === 'darwin' ? (
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 12px' }}>
              These will be installed via Homebrew. No password needed.
            </p>
          ) : (
            <>
              <label style={{ marginTop: 4 }}>
                {state.os?.platform === 'win32' ? 'WSL/Linux password' : 'Sudo password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="needed once to run sudo apt install"
                autoFocus
                spellCheck={false}
              />
              {pwError && (
                <p style={{ color: 'var(--live)', fontSize: 12, margin: '8px 0 0' }}>{pwError}</p>
              )}
              <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
                Used only to run <code>sudo apt install</code>. Not stored anywhere.
              </p>
            </>
          )}

          <div className="actions" style={{ marginTop: 18 }}>
            <button className="btn ghost" onClick={skipDeps}>
              Skip (some features may be unavailable)
            </button>
            <button className="btn primary" onClick={approveDeps}>
              Install dependencies
            </button>
          </div>
        </div>
      )}

      <div className="card log-card">
        <div className="log-header">
          <span className="log-dot" data-status={status} />
          <span className="log-title">install log</span>
          <span className="log-spacer" />
          <span className="log-status">{status}</span>
        </div>
        <pre className="log log-large" ref={logRef}>{log || 'Starting...'}</pre>
      </div>

      {status === 'done' && <PostInstall state={state} />}

      {(status === 'done' || status === 'reboot') && (
        <div className="actions">
          <span />
          <button className="btn primary" onClick={() => window.close()}>Close</button>
        </div>
      )}
    </div>
  );
}

function decodeDiscordClientId(token) {
  if (!token) return null;
  try {
    const seg = token.split('.')[0];
    const padded = seg + '='.repeat((4 - (seg.length % 4)) % 4);
    return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}

function PostInstall({ state }) {
  const enabled = Object.entries(state.platforms).filter(([, v]) => v.enabled && v.token);
  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer');

  const launchCmd = state.os?.platform === 'win32' ? 'wsl hermes' : 'hermes';

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 500 }}>You're set</h3>
        <p style={{ margin: '0 0 12px', color: 'var(--muted)' }}>
          Open a terminal and run <code>{launchCmd}</code> to start chatting with the agent locally.
        </p>
      </div>

      {enabled.map(([id, p]) => {
        if (id === 'discord') return <DiscordPostInstall key={id} token={p.token} open={open} />;
        if (id === 'telegram') return <TelegramPostInstall key={id} open={open} />;
        if (id === 'slack') return <SlackPostInstall key={id} open={open} />;
        return null;
      })}
    </>
  );
}

function DiscordPostInstall({ token, open }) {
  const clientId = decodeDiscordClientId(token);
  const inviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=274877942848&scope=bot+applications.commands`
    : null;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Finish Discord setup</h3>
        <span className="tag">3 steps</span>
      </div>

      <ol className="steps">
        <li>
          <strong>Enable bot intents</strong> in the Developer Portal — Discord blocks message content by default.
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => open('https://discord.com/developers/applications')}>
              Open Developer Portal ↗
            </button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
            Click your bot → <strong>Bot</strong> → toggle on <strong>MESSAGE CONTENT INTENT</strong> and <strong>SERVER MEMBERS INTENT</strong> → Save Changes.
          </p>
        </li>
        <li style={{ marginTop: 14 }}>
          <strong>Invite the bot to your server.</strong>
          <div style={{ marginTop: 8 }}>
            {inviteUrl ? (
              <button className="btn primary" onClick={() => open(inviteUrl)}>
                Open invite URL ↗
              </button>
            ) : (
              <span className="tag warn">Couldn't decode client ID from token</span>
            )}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '8px 0 0' }}>
            Pick a server (you need Manage Server permission), authorize, solve the captcha.
          </p>
        </li>
        <li style={{ marginTop: 14 }}>
          <strong>Allowlist yourself</strong> so the bot will respond to you.
          <ol style={{ paddingLeft: 18, color: 'var(--muted)', fontSize: 12, lineHeight: 1.6, margin: '8px 0 0' }}>
            <li>In Discord: User Settings → Advanced → enable <strong>Developer Mode</strong></li>
            <li>Right-click your name → <strong>Copy User ID</strong></li>
            <li>Run: <code>wsl bash -lc 'echo "DISCORD_ALLOWED_USERS=YOUR_ID" {'>>'}~/.hermes/.env && systemctl --user restart hermes-gateway'</code></li>
          </ol>
        </li>
      </ol>
    </div>
  );
}

function TelegramPostInstall({ open }) {
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 500 }}>Finish Telegram setup</h3>
      <ol className="steps">
        <li>Open Telegram and search for your bot by its @username (set when you created it via @BotFather).</li>
        <li>Send <code>/start</code> — the bot will reply once your user is allowlisted.</li>
        <li>
          <strong>Allowlist yourself.</strong> Get your Telegram user ID from <a onClick={() => open('https://t.me/userinfobot')} style={{ color: 'var(--text)', textDecoration: 'underline', cursor: 'pointer' }}>@userinfobot</a>, then run:
          <pre className="log" style={{ marginTop: 8, fontSize: 11 }}>{'wsl bash -lc \'echo "TELEGRAM_ALLOWED_USERS=YOUR_ID" >> ~/.hermes/.env && systemctl --user restart hermes-gateway\''}</pre>
        </li>
      </ol>
    </div>
  );
}

function SlackPostInstall({ open }) {
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 500 }}>Finish Slack setup</h3>
      <ol className="steps">
        <li>
          Open your Slack app at the API dashboard.
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => open('https://api.slack.com/apps')}>Open Slack apps ↗</button>
          </div>
        </li>
        <li style={{ marginTop: 12 }}>Under <strong>OAuth & Permissions</strong>, click <strong>Install to Workspace</strong>. Authorize, then copy the Bot User OAuth Token if you haven't already.</li>
        <li style={{ marginTop: 12 }}>Invite the bot to a channel: type <code>/invite @your-bot-name</code> in any Slack channel.</li>
        <li style={{ marginTop: 12 }}>DM the bot or @mention it in the channel — it should respond.</li>
      </ol>
    </div>
  );
}
