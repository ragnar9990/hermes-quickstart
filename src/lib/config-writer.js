const fs = require('fs');
const path = require('path');
const os = require('os');
const YAML = require('yaml');

function buildConfig(input) {
  const cfg = {
    provider: input.provider,
    model: input.model,
    sandbox: input.sandbox || 'local',
  };

  if (input.platforms && Object.keys(input.platforms).length > 0) {
    cfg.gateways = {};
    for (const [name, settings] of Object.entries(input.platforms)) {
      if (settings && settings.enabled) {
        cfg.gateways[name] = { enabled: true };
      }
    }
  }

  if (input.tools && input.tools.length > 0) {
    cfg.tools = input.tools;
  }

  return cfg;
}

function preview(input) {
  return YAML.stringify(buildConfig(input));
}

function configDir() {
  return path.join(os.homedir(), '.hermes');
}

function write(input) {
  const dir = configDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, 'config.yaml');
  const yaml = YAML.stringify(buildConfig(input));
  fs.writeFileSync(file, yaml, 'utf8');
  return { path: file, bytes: Buffer.byteLength(yaml, 'utf8') };
}

module.exports = { buildConfig, preview, write, configDir };
