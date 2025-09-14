import * as vscode from 'vscode';
import { GenericSecretDetector, SecretFinding } from './secretDetector';

export class SecretMasker {
    private maskDecorationType: vscode.TextEditorDecorationType;
    private maskedRanges: Map<string, vscode.Range[]> = new Map();
    private detector: GenericSecretDetector;

    constructor() {
        this.detector = new GenericSecretDetector();
        this.maskDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.background'),
            color: new vscode.ThemeColor('editor.background'),
            after: {
                contentText: '••••••••••••',
                color: new vscode.ThemeColor('editorCodeLens.foreground')
            }
        });
    }

    maskDocument(document: vscode.TextDocument): void {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (!editor) return;

        // Run detector on the document to find secret ranges
        const findings = this.detector.findInDocument(document);
        const ranges = findings.map(f => f.range);
        this.maskedRanges.set(document.uri.toString(), ranges);
        editor.setDecorations(this.maskDecorationType, ranges);
    }

    unmaskDocument(document: vscode.TextDocument): void {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) editor.setDecorations(this.maskDecorationType, []);
        this.maskedRanges.delete(document.uri.toString());
    }

    unmaskAll(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(this.maskDecorationType, []);
        });
        this.maskedRanges.clear();
    }

    dispose(): void {
        this.maskDecorationType.dispose();
        this.maskedRanges.clear();
    }
}

