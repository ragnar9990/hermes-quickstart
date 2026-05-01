const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const YAML = require('yaml');

const BREW_PKG = { rg: 'ripgrep', ffmpeg: 'ffmpeg', git: 'git' };

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
  const checks = { rg: 'command -v rg', ffmpeg: 'command -v ffmpeg', git: 'command -v git', brew: 'command -v brew' };
  const missing = [];
  for (const [name, cmd] of Object.entries(checks)) {
    const r = await runStreaming('bash', ['-lc', `${cmd} >/dev/null 2>&1 && echo OK || echo MISSING`], () => {});
    if (!r.stdout.includes('OK')) missing.push(name);
  }
  return { missing: missing.filter((n) => n !== 'brew'), packageManager: 'brew', brewMissing: missing.includes('brew') };
}

async function installDeps(missing, _password, onLog) {
  const pkgs = missing.map((n) => BREW_PKG[n]).filter(Boolean);
  if (pkgs.length === 0) return { ok: true };
  onLog?.(`[deps] Installing via Homebrew: ${pkgs.join(', ')}\n`);
  const r = await runStreaming('bash', ['-lc', `brew install ${pkgs.join(' ')}`], onLog);
  if (r.code !== 0) throw new Error('brew install failed. Make sure Homebrew is installed: brew.sh');
  onLog?.('[deps] Done.\n');
  return { ok: true };
}

async function run(payload, onLog) {
  onLog?.('[hermes] Installing Hermes...\n');
  const result = await runStreaming('bash', [
    '-lc',
    'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash',
  ], onLog);
  if (result.code !== 0) throw new Error('Hermes install failed.');
  writeHostConfig(payload.config, payload.env, onLog);
  onLog?.('\n[hermes] Setup complete. Open a terminal and run: hermes\n');
  return { ok: true, requiresReboot: false };
}

module.exports = { run, checkDeps, installDeps };
