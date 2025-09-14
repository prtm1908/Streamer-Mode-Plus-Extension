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
exports.SecretMasker = void 0;
const vscode = __importStar(require("vscode"));
const secretDetector_1 = require("./secretDetector");
class SecretMasker {
    constructor() {
        this.maskedRanges = new Map();
        this.detector = new secretDetector_1.GenericSecretDetector();
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
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (!editor)
            return;
        // Run detector on the document to find secret ranges
        const findings = this.detector.findInDocument(document);
        const ranges = findings.map(f => f.range);
        this.maskedRanges.set(document.uri.toString(), ranges);
        editor.setDecorations(this.maskDecorationType, ranges);
    }
    unmaskDocument(document) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor)
            editor.setDecorations(this.maskDecorationType, []);
        this.maskedRanges.delete(document.uri.toString());
    }
    unmaskAll() {
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(this.maskDecorationType, []);
        });
        this.maskedRanges.clear();
    }
    dispose() {
        this.maskDecorationType.dispose();
        this.maskedRanges.clear();
    }
}
exports.SecretMasker = SecretMasker;
//# sourceMappingURL=secretMasker.js.map