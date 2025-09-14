import * as vscode from 'vscode';
import { StreamingDetector } from './streamingDetector';
import { EnvMasker } from './envMasker';
import { SecretMasker } from './secretMasker';

let streamingDetector: StreamingDetector;
let envMasker: EnvMasker;
let secretMasker: SecretMasker;
let statusBarItem: vscode.StatusBarItem;
let isStreamingModeEnabled = false;
let hideAllEnvVariables = false;

export function activate(context: vscode.ExtensionContext) {
    console.log('Streaming Mode extension is now active!');

    // Initialize components
    streamingDetector = new StreamingDetector();
    envMasker = new EnvMasker();
    secretMasker = new SecretMasker();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'streamingMode.menu';
    context.subscriptions.push(statusBarItem);

    // Register commands
    const toggleCommand = vscode.commands.registerCommand('streamingMode.toggle', () => {
        toggleStreamingMode();
    });

    const menuCommand = vscode.commands.registerCommand('streamingMode.menu', async () => {
        await showStatusBarMenu();
    });

    const enableCommand = vscode.commands.registerCommand('streamingMode.enable', () => {
        setStreamingMode(true);
    });

    const disableCommand = vscode.commands.registerCommand('streamingMode.disable', () => {
        setStreamingMode(false);
    });

    context.subscriptions.push(toggleCommand, enableCommand, disableCommand, menuCommand);

    // Listen for configuration changes
    const configListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('streamingMode')) {
            streamingDetector.updateConfiguration();
        }
    });

    context.subscriptions.push(configListener);

    // Listen for document changes
    const documentListener = vscode.workspace.onDidOpenTextDocument(document => {
        if (isStreamingModeEnabled) {
            applyMaskingForDocument(document);
        }
    });

    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (isStreamingModeEnabled && editor) {
            applyMaskingForDocument(editor.document);
        }
    });

    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
        if (isStreamingModeEnabled) {
            applyMaskingForDocument(event.document);
        }
    });

    context.subscriptions.push(documentListener, activeEditorListener, changeListener);

    // Initialize status bar
    updateStatusBar();

    // Start streaming detection if auto-detect is enabled
    const config = vscode.workspace.getConfiguration('streamingMode');
    if (config.get('autoDetect', true)) {
        // Run initial detection to set proper state
        streamingDetector.checkStreamingStatus().then(isStreaming => {
            if (isStreaming) {
                setStreamingMode(true);
                vscode.window.showInformationMessage('Streaming software detected - Streaming Mode enabled');
            }
            
            // Start continuous detection
            streamingDetector.startDetection((isStreamingNow: boolean) => {
                if (isStreamingNow !== isStreamingModeEnabled) {
                    setStreamingMode(isStreamingNow);
                    if (isStreamingNow) {
                        vscode.window.showInformationMessage('Streaming software detected - Streaming Mode enabled');
                    } else {
                        vscode.window.showInformationMessage('Streaming software stopped - Streaming Mode disabled');
                    }
                }
            });
        });
    }
}

function toggleStreamingMode() {
    setStreamingMode(!isStreamingModeEnabled);
}

function setStreamingMode(enabled: boolean) {
    isStreamingModeEnabled = enabled;
    
    if (enabled) {
        // Apply masking to all open documents
        vscode.workspace.textDocuments.forEach(document => {
            applyMaskingForDocument(document);
        });
    } else {
        // Unmask all files
        envMasker.unmaskAll();
        secretMasker.unmaskAll();
    }
    
    updateStatusBar();
}

function applyMaskingForDocument(document: vscode.TextDocument) {
    // Always run secret masker to catch high-entropy/API keys in any file (including .env)
    secretMasker.maskDocument(document);

    // Optionally mask all values in .env files if user enabled it
    if (hideAllEnvVariables) {
        envMasker.maskDocument(document);
    } else {
        // Ensure any existing env masks are cleared if user turned the option off
        envMasker.unmaskDocument(document);
    }
}

async function showStatusBarMenu() {
    const streamingLabel = isStreamingModeEnabled ? 'Disable Streaming Mode' : 'Enable Streaming Mode';
    const hideAllLabel = `${hideAllEnvVariables ? '$(check)' : '$(circle-large-outline)'} Hide all environment variables`;

    const items: (vscode.QuickPickItem & { id: string })[] = [
        { id: 'toggleStreaming', label: `$(eye${isStreamingModeEnabled ? '' : '-closed'}) ${streamingLabel}` },
        { id: 'toggleHideAllEnv', label: hideAllLabel }
    ];

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Streaming Mode options',
        canPickMany: false
    });
    if (!picked) return;

    if (picked.id === 'toggleStreaming') {
        toggleStreamingMode();
    } else if (picked.id === 'toggleHideAllEnv') {
        hideAllEnvVariables = !hideAllEnvVariables;
        if (isStreamingModeEnabled) {
            // Re-apply env masking as per the new preference
            if (hideAllEnvVariables) {
                vscode.workspace.textDocuments.forEach(doc => envMasker.maskDocument(doc));
            } else {
                envMasker.unmaskAll();
            }
        }
        updateStatusBar();
    }
}

function updateStatusBar() {
    if (isStreamingModeEnabled) {
        const envSuffix = hideAllEnvVariables ? ' (env: all)' : '';
        statusBarItem.text = `$(eye-closed) Streaming${envSuffix}`;
        statusBarItem.tooltip = 'Streaming Mode: ON - Click to open menu';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = '$(eye) Streaming';
        statusBarItem.tooltip = 'Streaming Mode: OFF - Click to open menu';
        statusBarItem.backgroundColor = undefined;
    }
    statusBarItem.show();
}

export function deactivate() {
    if (streamingDetector) {
        streamingDetector.stopDetection();
    }
    if (envMasker) {
        envMasker.dispose();
    }
    if (secretMasker) {
        secretMasker.dispose();
    }
}
