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
exports.EnvMasker = void 0;
const vscode = __importStar(require("vscode"));
class EnvMasker {
    constructor() {
        this.maskedRanges = new Map();
        // Create decoration type for masking
        this.maskDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.background'),
            color: new vscode.ThemeColor('editor.background'),
            after: {
                contentText: '••••••••••••',
                color: new vscode.ThemeColor('editorCodeLens.foreground')
            }
        });
    }
    maskDocument(document) {
        if (!this.isEnvFile(document)) {
            return;
        }
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (!editor) {
            return;
        }
        const ranges = this.findEnvValueRanges(document);
        this.maskedRanges.set(document.uri.toString(), ranges);
        editor.setDecorations(this.maskDecorationType, ranges);
    }
    unmaskDocument(document) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            editor.setDecorations(this.maskDecorationType, []);
        }
        this.maskedRanges.delete(document.uri.toString());
    }
    unmaskAll() {
        // Clear all decorations
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(this.maskDecorationType, []);
        });
        this.maskedRanges.clear();
    }
    isEnvFile(document) {
        const fileName = document.fileName.toLowerCase();
        return fileName.endsWith('.env') ||
            fileName.endsWith('.env.local') ||
            fileName.endsWith('.env.development') ||
            fileName.endsWith('.env.production') ||
            fileName.endsWith('.env.test') ||
            fileName.includes('.env.');
    }
    findEnvValueRanges(document) {
        const ranges = [];
        const text = document.getText();
        const lines = text.split('\n');
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            // Skip comments and empty lines
            if (line.trim().startsWith('#') || line.trim() === '') {
                continue;
            }
            // Match KEY=VALUE pattern
            const envPattern = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;
            const match = line.match(envPattern);
            if (match) {
                const keyPart = match[1];
                const valuePart = match[2];
                // Skip if value is empty or just whitespace
                if (!valuePart.trim()) {
                    continue;
                }
                // Find the start position of the value (after the = sign)
                const keyEndIndex = line.indexOf('=');
                const valueStartIndex = keyEndIndex + 1;
                // Skip whitespace after =
                let adjustedValueStart = valueStartIndex;
                while (adjustedValueStart < line.length && line[adjustedValueStart] === ' ') {
                    adjustedValueStart++;
                }
                // Only mask if there's actually a value to mask
                if (adjustedValueStart < line.length) {
                    const startPos = new vscode.Position(lineIndex, adjustedValueStart);
                    const endPos = new vscode.Position(lineIndex, line.length);
                    ranges.push(new vscode.Range(startPos, endPos));
                }
            }
        }
        return ranges;
    }
    dispose() {
        this.maskDecorationType.dispose();
        this.maskedRanges.clear();
    }
}
exports.EnvMasker = EnvMasker;
//# sourceMappingURL=envMasker.js.map