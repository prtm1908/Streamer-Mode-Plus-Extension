"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const streamingDetector_1 = require("./streamingDetector");
const envMasker_1 = require("./envMasker");
const secretMasker_1 = require("./secretMasker");
let streamingDetector;
let envMasker;
let secretMasker;
let statusBarItem;
let isStreamingModeEnabled = false;
let hideAllEnvVariables = false;
function activate(context) {
    console.log('Streaming Mode extension is now active!');
    // Initialize components
    streamingDetector = new streamingDetector_1.StreamingDetector();
    envMasker = new envMasker_1.EnvMasker();
    secretMasker = new secretMasker_1.SecretMasker();
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
            streamingDetector.startDetection((isStreamingNow) => {
                if (isStreamingNow !== isStreamingModeEnabled) {
                    setStreamingMode(isStreamingNow);
                    if (isStreamingNow) {
                        vscode.window.showInformationMessage('Streaming software detected - Streaming Mode enabled');
                    }
                    else {
                        vscode.window.showInformationMessage('Streaming software stopped - Streaming Mode disabled');
                    }
                }
            });
        });
    }
}
exports.activate = activate;
function toggleStreamingMode() {
    setStreamingMode(!isStreamingModeEnabled);
}
function setStreamingMode(enabled) {
    isStreamingModeEnabled = enabled;
    if (enabled) {
        // Apply masking to all open documents
        vscode.workspace.textDocuments.forEach(document => {
            applyMaskingForDocument(document);
        });
    }
    else {
        // Unmask all files
        envMasker.unmaskAll();
        secretMasker.unmaskAll();
    }
    updateStatusBar();
}
function applyMaskingForDocument(document) {
    // Always run secret masker to catch high-entropy/API keys in any file (including .env)
    secretMasker.maskDocument(document);
    // Optionally mask all values in .env files if user enabled it
    if (hideAllEnvVariables) {
        envMasker.maskDocument(document);
    }
    else {
        // Ensure any existing env masks are cleared if user turned the option off
        envMasker.unmaskDocument(document);
    }
}
async function showStatusBarMenu() {
    const streamingLabel = isStreamingModeEnabled ? 'Disable Streaming Mode' : 'Enable Streaming Mode';
    const hideAllLabel = `${hideAllEnvVariables ? '$(check)' : '$(circle-large-outline)'} Hide all environment variables`;
    const items = [
        { id: 'toggleStreaming', label: `$(eye${isStreamingModeEnabled ? '' : '-closed'}) ${streamingLabel}` },
        { id: 'toggleHideAllEnv', label: hideAllLabel }
    ];
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Streaming Mode options',
        canPickMany: false
    });
    if (!picked)
        return;
    if (picked.id === 'toggleStreaming') {
        toggleStreamingMode();
    }
    else if (picked.id === 'toggleHideAllEnv') {
        hideAllEnvVariables = !hideAllEnvVariables;
        if (isStreamingModeEnabled) {
            // Re-apply env masking as per the new preference
            if (hideAllEnvVariables) {
                vscode.workspace.textDocuments.forEach(doc => envMasker.maskDocument(doc));
            }
            else {
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
    }
    else {
        statusBarItem.text = '$(eye) Streaming';
        statusBarItem.tooltip = 'Streaming Mode: OFF - Click to open menu';
        statusBarItem.backgroundColor = undefined;
    }
    statusBarItem.show();
}
function deactivate() {
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
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map