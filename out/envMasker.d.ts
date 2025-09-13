import * as vscode from 'vscode';
export declare class EnvMasker {
    private maskDecorationType;
    private maskedRanges;
    constructor();
    maskDocument(document: vscode.TextDocument): void;
    unmaskDocument(document: vscode.TextDocument): void;
    unmaskAll(): void;
    private isEnvFile;
    private findEnvValueRanges;
    dispose(): void;
}
//# sourceMappingURL=envMasker.d.ts.map