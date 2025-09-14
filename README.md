# Streamer Mode Plus Extension

A VS Code extension that automatically detects streaming software and masks sensitive content in `.env` files and high-entropy API keys in code to protect secrets during live coding sessions.

## Features

- **Automatic Detection**: Monitors running processes to detect popular streaming software like OBS Studio, Streamlabs, and XSplit.
- **Smart Masking (.env)**: By default, only masks detected API keys and high‑entropy secrets in `.env` files (keeps regular values like names, ports visible). Optionally, enable “Hide all environment variables” to mask all values.
- **Secret Masking (code)**: Detects and masks high-entropy secrets assigned to sensitive keys (e.g., `api_key`, `token`, `secret`, `credential`, `auth`) in any file based on a ruleset inspired by GitGuardian’s Generic High Entropy detector
- **Manual Toggle**: Status bar button to manually enable/disable streamer mode
- **Configurable**: Customize detection settings and streaming software list

## How It Works

1. **Process Detection**: The extension periodically scans running processes for known streaming applications
2. **Auto-Activation**: When streaming software is detected, it automatically enables streamer mode
3. **Content Masking**: 
   - `.env` files: By default, only API keys/high‑entropy secrets are masked. Use the status bar menu to enable “Hide all environment variables” and mask all values.
   - Code files: High-entropy secrets are detected and only the secret substring is masked
4. **Visual Feedback**: Status bar shows current streamer mode state with eye icons

## Commands

- `Streamer Mode: Menu` (status bar) — opens a menu with:
  - Toggle Streamer Mode (on/off)
  - Hide all environment variables (checkbox)
- `Toggle Streamer Mode` - Manually toggle streamer mode on/off
- `Enable Streamer Mode` - Force enable streamer mode
- `Disable Streamer Mode` - Force disable streamer mode

## Configuration

Access these settings via VS Code Settings (search for "Streamer Mode"):

- `streamingMode.autoDetect` (default: `true`) - Automatically detect streaming software
- `streamingMode.detectionInterval` (default: `5000`) - Detection interval in milliseconds  
- `streamingMode.streamingProcesses` - List of process names to detect as streaming software (exact match, case-insensitive; `.exe`/`.app` stripped)

Default detected processes (tight to avoid false positives):
- OBS Studio (`obs`, `obs64`)
- Streamlabs (`streamlabs obs`, `streamlabs desktop`)
- XSplit (`xsplit`)

## Usage

1. Install and activate the extension
2. Open any `.env` file
3. Start your streaming software (OBS, etc.) 
4. The extension will automatically detect it and mask your `.env` values
5. Use the status bar button (eye icon) to open the menu and optionally enable “Hide all environment variables”

## Development

To run the extension in development:

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile` 
4. Press F5 to launch Extension Development Host
5. Open a `.env` file to test masking functionality

## File Types Supported

The extension automatically masks content in files with these patterns:
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- `.env.test`
- Any file containing `.env.` in the name

Additionally, high-entropy secret masking runs across all open text documents to catch code-side assignments.

## Secret Detection Rules (Code)

The secret detector focuses on assignments where the assigned identifier contains one of: `secret`, `token`, `api[_.-]?key`, `credential`, or `auth`. It considers assignment tokens `:`, `=`, `:=`, `=>`, `,`, `(`, and `<-`, covering patterns such as:

- Variable/property assignments: `api_key = "..."`, `secret: value`, `token := value`, `object['auth'] = "..."`, `{"credential": "..."}`
- Function patterns: `o.set("auth", "...")`, `set_apikey("...")`

Values must pass high-entropy checks similar to GitGuardian’s Generic High Entropy detector:
- Match a constrained charset/length with specific backslash rules
- Shannon entropy ≥ 3 and contain ≥ 2 digits
- Pass value and context banlists to reduce false positives

Masking is visual-only and targets only the matched secret substring.

## Privacy & Security

- The extension only scans process names, not process content
- No sensitive data is transmitted or stored
- Masking is visual only - your actual file content remains unchanged
- Works entirely locally within VS Code

## Status Bar

The status bar shows:
- `👁 Streaming` - Streamer mode OFF
- `🙈 Streaming` - Streamer mode ON (with warning background)

Click the status bar item to toggle streamer mode manually.
