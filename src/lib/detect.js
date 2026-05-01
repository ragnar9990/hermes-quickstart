const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const fs = require('fs');

const pexec = promisify(exec);

async function safeExec(cmd, opts = {}) {
  try {
    const { stdout, stderr } = await pexec(cmd, { timeout: 10000, ...opts });
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    return { ok: false, error: err.message, stdout: err.stdout?.toString() || '', stderr: err.stderr?.toString() || '' };
  }
}

function detectOS() {
  return {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    homedir: os.homedir(),
    label:
      process.platform === 'win32' ? 'Windows' :
      process.platform === 'darwin' ? 'macOS' :
      process.platform === 'linux' ? 'Linux' : process.platform,
  };
}

async function detectWSL() {
  if (process.platform !== 'win32') {
    return { applicable: false };
  }

  const status = await safeExec('wsl --status');
  if (!status.ok) {
    return { applicable: true, installed: false, reason: status.stderr || status.error };
  }

  const distros = await safeExec('wsl -l -v');
  const installed = status.ok;
  const hasDistro = distros.ok && /\bRunning\b|\bStopped\b/i.test(distros.stdout);

  return {
    applicable: true,
    installed,
    hasDistro,
    statusOutput: status.stdout,
    distros: distros.stdout,
  };
}

async function detectHermes() {
  const home = os.homedir();
  const configPath = path.join(home, '.hermes', 'config.yaml');
  const exists = fs.existsSync(configPath);

  let onPath = false;
  if (process.platform === 'win32') {
    const wsl = await safeExec('wsl which hermes');
    onPath = wsl.ok && wsl.stdout.trim().length > 0;
  } else {
    const which = await safeExec('which hermes');
    onPath = which.ok && which.stdout.trim().length > 0;
  }

  return { configExists: exists, configPath, onPath };
}

module.exports = { detectOS, detectWSL, detectHermes };
