# Ventarys IDX

An advanced, autonomous software engineering agent and live code editor environment wrapped in a portable desktop app structure. Designed to function like an AI-assisted IDE with cooperative cursor capabilities and local task automation.

## Features

- **Autonomous Coding Agent:** Direct integration with Agnes AI and AquaDevs models for text generation and structured tool usage.
- **AI Second Cursor (`ide_live_edit`):** The agent can write and insert code directly into your active editor pane in real-time with visual cursor tracking.
- **OS Automation (`run_automation_script`):** Execute sandboxed automation tasks natively via Python, Node.js, PowerShell, or Bash scripts.
- **Integrated Terminal & Live Tabs:** Full terminal control (`xterm.js`) combined with a dynamic multi-file tabs system powered by Ace Editor.
- **Custom Portable Auto-Updater:** Automatically checks for updates against GitHub Releases. If a new version is detected, it streams the latest binary, uses a detached background batch script to replace itself, and hot-restarts without needing an installer.

## Architecture & Portable Auto-Update Flow

The auto-updater is explicitly tailored for standalone, portable `.exe` deployments to avoid complex installations.

1. **Check:** The app pings the GitHub API (`/releases/latest`) on startup and compares the remote tag with `CURRENT_APP_VERSION`.
2. **Download:** If a mismatch occurs, it triggers a stream download utilizing native Node.js `https` into the OS temporary directory (`Ventarys_Update.exe`).
3. **Hot-Swap Script:** It generates a temporary `.bat` routine that safely waits for the main application stream process to close, releases file system locks, moves/overwrites the old `.exe` with the new one, and respawns the updated build.

## Project Setup

### Local Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/Juanoto2012/Ventarys-IDX.git](https://github.com/Juanoto2012/Ventarys-IDX.git) ```
