const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const YAML = require('yaml');

const APT_PKG = { rg: 'ripgrep', ffmpeg: 'ffmpeg', git: 'git' };

function runStreaming(cmd, args, onLog) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      onLog?.(s);
    });
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      onLog?.(s);
    });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function writeHostConfig(configObj, env, onLog) {
  const dir = path.join(os.homedir(), '.hermes');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.yaml'), YAML.stringify(configObj), 'utf8');
  if (env && Object.keys(env).length > 0) {
    const lines = Object.entries(env).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(path.join(dir, '.env'), lines + '\n', { mode: 0o600 });
  }
  onLog?.('[hermes] Wrote ~/.hermes/config.yaml and .env\n');
}

async function checkDeps() {
  const checks = { rg: 'command -v rg', ffmpeg: 'command -v ffmpeg', git: 'command -v git' };
  const missing = [];
  for (const [name, cmd] of Object.entries(checks)) {
    const r = await runStreaming('bash', ['-lc', `${cmd} >/dev/null 2>&1 && echo OK || echo MISSING`], () => {});
    if (!r.stdout.includes('OK')) missing.push(name);
  }
  return { missing, packageManager: 'apt' };
}

async function installDeps(missing, password, onLog) {
  const pkgs = missing.map((n) => APT_PKG[n]).filter(Boolean);
  if (pkgs.length === 0) return { ok: true };
  onLog?.(`[deps] Installing via apt: ${pkgs.join(', ')}\n`);
  const escaped = password.replace(/'/g, "'\\''");
  const script = [
    `echo '${escaped}' | sudo -S -v`,
    `sudo apt-get update -y`,
    `sudo apt-get install -y ${pkgs.join(' ')}`,
  ].join(' && ');
  const r = await runStreaming('bash', ['-lc', script], onLog);
  if (r.code !== 0) throw new Error('Failed to install system dependencies. Check your password.');
  onLog?.('[deps] Done.\n');
  return { ok: true };
}

async function cacheSudo(password, onLog) {
  const escaped = password.replace(/'/g, "'\\''");
  const r = await runStreaming('bash', ['-lc', `echo '${escaped}' | sudo -S -v`], onLog);
  return r.code === 0;
}

async function run(payload, onLog) {
  if (payload.sudoPassword) {
    onLog?.('[deps] Caching sudo so Hermes install can run unattended...\n');
    const ok = await cacheSudo(payload.sudoPassword, onLog);
    if (!ok) throw new Error('Sudo authentication failed. Wrong password?');
  }

  onLog?.('[hermes] Installing Hermes...\n');
  // setsid detaches from the controlling tty so the install script can't hang
  // on /dev/tty prompts. See windows.js for full explanation.
  const installCmd = [
    'set -e',
    'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh -o /tmp/hermes_install.sh',
    'chmod +x /tmp/hermes_install.sh',
    'setsid -w env DEBIAN_FRONTEND=noninteractive HERMES_AUTO_SETUP=0 HERMES_NONINTERACTIVE=1 NEEDRESTART_MODE=a bash /tmp/hermes_install.sh < /dev/null || true',
    'cd ~/.hermes/hermes-agent && . venv/bin/activate && uv pip install -e .',
  ].join(' && ');
  const result = await runStreaming('bash', ['-lc', installCmd], onLog);
  if (result.code !== 0) throw new Error('Hermes install failed.');
  writeHostConfig(payload.config, payload.env, onLog);

  if (payload.enabledPlatforms && payload.enabledPlatforms.length > 0) {
    onLog?.(`[gateway] Starting Hermes gateway for: ${payload.enabledPlatforms.join(', ')}\n`);
    const gwCmd = [
      'hermes gateway start',
      'sleep 2',
      'if systemctl --user is-active hermes-gateway >/dev/null 2>&1; then echo "[gateway] active (managed by systemd --user as hermes-gateway.service)"; else echo "[gateway] not active — run: journalctl --user -u hermes-gateway -n 30"; fi',
    ].join(' && ');
    await runStreaming('bash', ['-lc', gwCmd], onLog);
  }

  onLog?.('\n[hermes] Setup complete. Open a terminal and run: hermes\n');
  return { ok: true, requiresReboot: false };
}

module.exports = { run, checkDeps, installDeps };
