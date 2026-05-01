# Hermes Quickstart

A cross-platform installer for [Hermes Agent](https://github.com/NousResearch/hermes-agent). Auto-installs WSL2 (on Windows), system dependencies, the agent itself, and wires up Discord / Telegram / Slack gateways — no terminal commands required.

> Not affiliated with Nous Research. Hermes Agent is MIT-licensed and maintained by the Nous Research team.

**Site:** https://hermes-quickstart.ronnie426234.workers.dev
**Powered by [Cohost](#)** — a live AI cohost for streamers.

## Download

Latest release: https://github.com/ragnar9990/hermes-quickstart/releases/latest

| OS | File |
| --- | --- |
| Windows 10/11 | `Hermes-Quickstart-Setup.exe` |
| macOS (Apple Silicon) | `Hermes-Quickstart-mac-arm64.dmg` |
| macOS (Intel) | `Hermes-Quickstart-mac-x64.dmg` |
| Linux | `Hermes-Quickstart.AppImage` |

## What it does

1. Detects your OS and existing Hermes / WSL2 install
2. (Windows) installs WSL2 + Ubuntu, with admin elevation and reboot handling
3. Asks for your LLM provider + API key (OpenRouter, Nous Portal, Anthropic, OpenAI, NVIDIA NIM)
4. Optionally wires up Discord / Telegram / Slack gateways
5. Detects and installs missing system packages (ripgrep, ffmpeg) via `sudo apt`/`brew`
6. Runs the Hermes install script with `setsid` to bypass interactive prompts
7. Writes `~/.hermes/config.yaml` and `~/.hermes/.env` with your provider settings
8. Registers the gateway as a `systemd --user` service so it survives reboots
9. Symlinks `hermes` into `/usr/local/bin` so `wsl hermes` Just Works on Windows

## Develop locally

```
npm install
npm run dev
```

Vite serves the renderer on port 5173, Electron loads it once it's ready.

## Build a release

```
npm run build:win     # Windows .exe
npm run build:mac     # macOS .dmg (x64 + arm64)
npm run build:linux   # Linux .AppImage
```

Output goes to `release/`.

## Cut a versioned release

Tag and push:

```
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions workflow at `.github/workflows/release.yml` builds for all three OSes and publishes a Release with the binaries attached.

## License

MIT
