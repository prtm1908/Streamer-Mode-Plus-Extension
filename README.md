# Streaming Mode Extension

A VS Code extension that automatically detects streaming software and masks sensitive content in `.env` files to protect secrets during live coding sessions.

## Features

- **Automatic Detection**: Monitors running processes to detect popular streaming software like OBS Studio, Streamlabs, and XSplit.
- **Smart Masking**: Automatically blurs/masks values in `.env` files while keeping variable names visible
- **Manual Toggle**: Status bar button to manually enable/disable streaming mode
- **Configurable**: Customize detection settings and streaming software list

## How It Works

1. **Process Detection**: The extension periodically scans running processes for known streaming applications
2. **Auto-Activation**: When streaming software is detected, it automatically enables streaming mode
3. **Content Masking**: `.env` file values are masked with dots (••••••••••••) while keeping the variable names visible
4. **Visual Feedback**: Status bar shows current streaming mode state with eye icons

## Commands

- `Toggle Streaming Mode` - Manually toggle streaming mode on/off
- `Enable Streaming Mode` - Force enable streaming mode
- `Disable Streaming Mode` - Force disable streaming mode

## Configuration

Access these settings via VS Code Settings (search for "Streaming Mode"):

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
5. Use the status bar button (eye icon) to manually toggle if needed

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

## Privacy & Security

- The extension only scans process names, not process content
- No sensitive data is transmitted or stored
- Masking is visual only - your actual file content remains unchanged
- Works entirely locally within VS Code

## Status Bar

The status bar shows:
- `👁 Streaming` - Streaming mode OFF
- `🙈 Streaming` - Streaming mode ON (with warning background)

Click the status bar item to toggle streaming mode manually.
