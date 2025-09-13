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
let streamingDetector;
let envMasker;
let statusBarItem;
let isStreamingModeEnabled = false;
function activate(context) {
    console.log('Streaming Mode extension is now active!');
    // Initialize components
    streamingDetector = new streamingDetector_1.StreamingDetector();
    envMasker = new envMasker_1.EnvMasker();
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
        // Mask all open .env files
        vscode.workspace.textDocuments.forEach(document => {
            envMasker.maskDocument(document);
        });
    }
    else {
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
    }
    else {
        statusBarItem.text = '$(eye) Streaming';
        statusBarItem.tooltip = 'Streaming Mode: OFF - Click to toggle';
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
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map