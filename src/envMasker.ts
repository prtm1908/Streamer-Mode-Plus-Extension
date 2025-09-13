import * as vscode from 'vscode';

export class EnvMasker {
    private maskDecorationType: vscode.TextEditorDecorationType;
    private maskedRanges: Map<string, vscode.Range[]> = new Map();

    constructor() {
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

    maskDocument(document: vscode.TextDocument): void {
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

    unmaskDocument(document: vscode.TextDocument): void {
        const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            editor.setDecorations(this.maskDecorationType, []);
        }
        this.maskedRanges.delete(document.uri.toString());
    }

    unmaskAll(): void {
        // Clear all decorations
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(this.maskDecorationType, []);
        });
        this.maskedRanges.clear();
    }

    private isEnvFile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.endsWith('.env') ||
               fileName.endsWith('.env.local') ||
               fileName.endsWith('.env.development') ||
               fileName.endsWith('.env.production') ||
               fileName.endsWith('.env.test') ||
               fileName.includes('.env.');
    }

    private findEnvValueRanges(document: vscode.TextDocument): vscode.Range[] {
        const ranges: vscode.Range[] = [];
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

    dispose(): void {
        this.maskDecorationType.dispose();
        this.maskedRanges.clear();
    }
}