import * as vscode from 'vscode';
import { StreamingDetector } from './streamingDetector';
import { EnvMasker } from './envMasker';

let streamingDetector: StreamingDetector;
let envMasker: EnvMasker;
let statusBarItem: vscode.StatusBarItem;
let isStreamingModeEnabled = false;

export function activate(context: vscode.ExtensionContext) {
    console.log('Streaming Mode extension is now active!');

    // Initialize components
    streamingDetector = new StreamingDetector();
    envMasker = new EnvMasker();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'streamingMode.toggle';
    context.subscriptions.push(statusBarItem);

    // Register commands
    const toggleCommand = vscode.commands.registerCommand('streamingMode.toggle', () => {
        toggleStreamingMode();
    });

    const enableCommand = vscode.commands.registerCommand('streamingMode.enable', () => {
        setStreamingMode(true);
    });

    const disableCommand = vscode.commands.registerCommand('streamingMode.disable', () => {
        setStreamingMode(false);
    });

    context.subscriptions.push(toggleCommand, enableCommand, disableCommand);

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
            envMasker.maskDocument(document);
        }
    });

    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (isStreamingModeEnabled && editor) {
            envMasker.maskDocument(editor.document);
        }
    });

    context.subscriptions.push(documentListener, activeEditorListener);

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
        // Mask all open .env files
        vscode.workspace.textDocuments.forEach(document => {
            envMasker.maskDocument(document);
        });
    } else {
        // Unmask all files
        envMasker.unmaskAll();
    }
    
    updateStatusBar();
}

function updateStatusBar() {
    if (isStreamingModeEnabled) {
        statusBarItem.text = '$(eye-closed) Streaming';
        statusBarItem.tooltip = 'Streaming Mode: ON - Click to toggle';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = '$(eye) Streaming';
        statusBarItem.tooltip = 'Streaming Mode: OFF - Click to toggle';
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
}