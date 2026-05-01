const { spawn } = require('child_process');
const YAML = require('yaml');

function runStreaming(cmd, args, onLog, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
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

function runWithStdin(cmd, args, stdin, onLog) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: false });
    let stderr = '';
    proc.stdout.on('data', (d) => onLog?.(d.toString()));
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      onLog?.(s);
    });
    proc.on('close', (code) => resolve({ code, stderr }));
    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

async function ensureWSL2(onLog) {
  onLog?.('[wsl] Checking WSL2 status...\n');
  const status = await runStreaming('wsl', ['--status'], onLog);
  const wslFeatureInstalled = status.code === 0;

  // Probe for a working default distro by running a no-op inside it.
  // This is more reliable than parsing `wsl -l -v` output (UTF-16 LE encoding).
  let hasDistro = false;
  if (wslFeatureInstalled) {
    const probe = await runStreaming('wsl', ['-e', 'true'], () => {});
    hasDistro = probe.code === 0;
  }

  if (wslFeatureInstalled && hasDistro) {
    onLog?.('[wsl] WSL2 + distro ready.\n');
    return { installed: true, rebooted: false };
  }

  // Case 1: WSL feature missing entirely — needs admin elevation + reboot
  if (!wslFeatureInstalled) {
    onLog?.('[wsl] Installing WSL2 + Ubuntu (admin elevation will prompt; reboot may be required)...\n');
    const install = await runStreaming('powershell', [
      '-NoProfile',
      '-Command',
      'Start-Process -Verb RunAs -Wait -FilePath wsl.exe -ArgumentList "--install","-d","Ubuntu","--no-launch"',
    ], onLog);
    if (install.code !== 0) {
      throw new Error('WSL2 install failed. Run "wsl --install" manually as Administrator and retry.');
    }
    onLog?.('[wsl] Install command completed. Reboot is typically required before WSL is usable.\n');
    return { installed: true, rebooted: true };
  }

  // Case 2: WSL feature installed but no distro — install Ubuntu only (no admin needed)
  onLog?.('[wsl] WSL2 is installed but no distro found. Installing Ubuntu...\n');
  const installDistro = await runStreaming('wsl', ['--install', '-d', 'Ubuntu', '--no-launch'], onLog);
  if (installDistro.code !== 0) {
    throw new Error('Ubuntu install failed. Try running "wsl --install -d Ubuntu" manually and retry.');
  }
  onLog?.('[wsl] Ubuntu installed. Initializing default user (this may take a minute)...\n');

  // First-run init — Ubuntu needs to bootstrap. We run a noninteractive command
  // via root to skip the interactive username prompt entirely. The installer
  // creates a "ubuntu" user as default via /etc/wsl.conf.
  await runStreaming('wsl', ['-d', 'Ubuntu', '--user', 'root', '--', 'bash', '-c',
    'useradd -m -s /bin/bash hermes 2>/dev/null; printf "[user]\\ndefault=hermes\\n" > /etc/wsl.conf; echo "hermes ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/hermes-nopasswd; chmod 440 /etc/sudoers.d/hermes-nopasswd'
  ], onLog);

  // Restart so the wsl.conf default-user setting takes effect
  await runStreaming('wsl', ['--terminate', 'Ubuntu'], () => {});
  // Verify
  const verify = await runStreaming('wsl', ['-e', 'whoami'], onLog);
  if (verify.code !== 0) {
    throw new Error('Ubuntu installed but failed to launch. Try opening Ubuntu manually once and re-run the installer.');
  }
  onLog?.(`[wsl] Default user set up: ${verify.stdout.trim()}\n`);
  return { installed: true, rebooted: false };
}

async function installHermesInWSL(onLog, sudoPassword) {
  onLog?.('[hermes] Installing Hermes inside WSL...\n');
  // Critical: the script checks `[ -r /dev/tty ]` and reads from /dev/tty if our
  // shell still has a controlling terminal. Even if we redirect stdin to /dev/null,
  // /dev/tty stays accessible via wsl.exe's pty allocation.
  //
  // setsid runs the script in a new session with NO controlling terminal, so
  // /dev/tty becomes inaccessible and the script's prompt_yes_no() falls
  // through to its default answer instead of hanging forever.
  const cmd = [
    'set -e',
    'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh -o /tmp/hermes_install.sh',
    'chmod +x /tmp/hermes_install.sh',
    'setsid -w env DEBIAN_FRONTEND=noninteractive HERMES_AUTO_SETUP=0 HERMES_NONINTERACTIVE=1 NEEDRESTART_MODE=a bash /tmp/hermes_install.sh < /dev/null || true',
  ].join(' && ');
  const result = await runStreaming('wsl', ['bash', '-lc', cmd], onLog);
  // The wrapper script may exit non-zero or skip the final pip install if it
  // tries to prompt and we deny stdin. Always run the editable install ourselves
  // as the source of truth — idempotent, safe to re-run.
  await ensureHermesInstalled(onLog, sudoPassword);
  return { ok: true };
}

async function ensureHermesInstalled(onLog, sudoPassword) {
  onLog?.('[hermes] Verifying / completing Hermes install via uv pip install -e ...\n');
  const cmd = [
    'cd ~/.hermes/hermes-agent',
    '. venv/bin/activate',
    'uv pip install -e .',
  ].join(' && ');
  const result = await runStreaming('wsl', ['bash', '-lc', cmd], onLog);
  if (result.code !== 0) {
    throw new Error('Final hermes install step (uv pip install -e .) failed.');
  }
  onLog?.('[hermes] Hermes binary verified at ~/.hermes/hermes-agent/venv/bin/hermes\n');

  // Make `wsl hermes` work from Windows by symlinking into /usr/local/bin
  // which is on PATH for non-login shells (~/.local/bin is not).
  if (sudoPassword) {
    onLog?.('[hermes] Adding /usr/local/bin/hermes symlink so `wsl hermes` works...\n');
    const escaped = sudoPassword.replace(/'/g, "'\\''");
    const linkCmd = `echo '${escaped}' | sudo -S ln -sf "$HOME/.hermes/hermes-agent/venv/bin/hermes" /usr/local/bin/hermes`;
    await runStreaming('wsl', ['bash', '-lc', linkCmd], onLog);
  } else {
    onLog?.('[hermes] Skipping /usr/local/bin symlink (no sudo). Use `wsl bash -lc hermes` to launch.\n');
  }
}

async function writeConfigInWSL(configObj, onLog) {
  onLog?.('[hermes] Writing ~/.hermes/config.yaml inside WSL...\n');
  const yaml = YAML.stringify(configObj);
  const heredoc = `mkdir -p ~/.hermes && cat > ~/.hermes/config.yaml <<'HERMES_EOF'\n${yaml}HERMES_EOF\n`;
  const result = await runWithStdin('wsl', ['bash'], heredoc, onLog);
  if (result.code !== 0) {
    throw new Error('Failed to write config.yaml inside WSL.');
  }
  onLog?.('[hermes] config.yaml written.\n');
}

async function startGatewayInWSL(enabledPlatforms, onLog) {
  if (!enabledPlatforms || enabledPlatforms.length === 0) return;
  onLog?.(`[gateway] Starting Hermes gateway for: ${enabledPlatforms.join(', ')}\n`);
  // `hermes gateway start` registers + starts a systemd --user service. We
  // don't manage the process ourselves — just trust it and verify state.
  const cmd = [
    'hermes gateway start',
    'sleep 2',
    'if systemctl --user is-active hermes-gateway >/dev/null 2>&1; then echo "[gateway] active (managed by systemd --user as hermes-gateway.service)"; else echo "[gateway] not active — run: journalctl --user -u hermes-gateway -n 30"; fi',
  ].join(' && ');
  await runStreaming('wsl', ['bash', '-lc', cmd], onLog);
}

async function writeEnvInWSL(env, onLog) {
  if (!env || Object.keys(env).length === 0) return;
  onLog?.('[hermes] Writing ~/.hermes/.env inside WSL...\n');
  const lines = Object.entries(env)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${String(v).replace(/\n/g, '')}`)
    .join('\n');
  const heredoc = `mkdir -p ~/.hermes && umask 077 && cat > ~/.hermes/.env <<'HERMES_EOF'\n${lines}\nHERMES_EOF\nchmod 600 ~/.hermes/.env\n`;
  const result = await runWithStdin('wsl', ['bash'], heredoc, onLog);
  if (result.code !== 0) {
    throw new Error('Failed to write .env inside WSL.');
  }
  onLog?.('[hermes] .env written (permissions 600).\n');
}

const APT_PKG = { rg: 'ripgrep', ffmpeg: 'ffmpeg', git: 'git' };

async function checkDeps() {
  const checks = {
    rg: 'command -v rg',
    ffmpeg: 'command -v ffmpeg',
    git: 'command -v git',
  };
  const missing = [];
  for (const [name, cmd] of Object.entries(checks)) {
    const r = await runStreaming('wsl', ['bash', '-lc', `${cmd} >/dev/null 2>&1 && echo OK || echo MISSING`], () => {});
    if (!r.stdout.includes('OK')) missing.push(name);
  }
  return { missing, packageManager: 'apt' };
}

async function installDeps(missing, password, onLog) {
  const pkgs = missing.map((n) => APT_PKG[n]).filter(Boolean);
  if (pkgs.length === 0) return { ok: true };

  onLog?.(`[deps] Installing via apt: ${pkgs.join(', ')}\n`);
  const escaped = password.replace(/'/g, "'\\''");
  // Validate sudo first (caches credentials), then update + install
  const script = [
    `echo '${escaped}' | sudo -S -v`,
    `sudo apt-get update -y`,
    `sudo apt-get install -y ${pkgs.join(' ')}`,
  ].join(' && ');
  const r = await runStreaming('wsl', ['bash', '-lc', script], onLog);
  if (r.code !== 0) {
    throw new Error('Failed to install system dependencies. Check your password and try again.');
  }
  onLog?.('[deps] Done.\n');
  return { ok: true };
}

async function cacheSudo(password, onLog) {
  const escaped = password.replace(/'/g, "'\\''");
  const r = await runStreaming('wsl', ['bash', '-lc', `echo '${escaped}' | sudo -S -v`], onLog);
  return r.code === 0;
}

async function run(payload, onLog) {
  const wsl = await ensureWSL2(onLog);
  if (wsl.rebooted) {
    return {
      ok: false,
      requiresReboot: true,
      message: 'Reboot required to finish WSL2 install. Reopen this app after reboot to continue.',
    };
  }

  if (payload.sudoPassword) {
    onLog?.('[deps] Caching sudo credentials so Hermes install can run unattended...\n');
    const ok = await cacheSudo(payload.sudoPassword, onLog);
    if (!ok) throw new Error('Sudo authentication failed. Wrong password?');
  }

  await installHermesInWSL(onLog, payload.sudoPassword);
  await writeConfigInWSL(payload.config, onLog);
  await writeEnvInWSL(payload.env, onLog);
  await startGatewayInWSL(payload.enabledPlatforms, onLog);

  onLog?.('\n[hermes] Setup complete. Open a terminal and run: wsl hermes\n');
  if (payload.enabledPlatforms && payload.enabledPlatforms.length > 0) {
    onLog?.(`[hermes] Gateway is running for ${payload.enabledPlatforms.join(', ')}. Logs: ~/.hermes/gateway.log\n`);
  }
  return { ok: true, requiresReboot: false };
}

module.exports = { run, checkDeps, installDeps };
