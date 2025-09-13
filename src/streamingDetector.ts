import * as vscode from 'vscode';
import psList from 'ps-list';

export class StreamingDetector {
    private detectionInterval: NodeJS.Timeout | undefined;
    private streamingProcesses: string[] = [];
    private detectionIntervalMs: number = 5000;
    private isCurrentlyDetected: boolean = false;

    constructor() {
        this.updateConfiguration();
    }

    updateConfiguration(): void {
        const config = vscode.workspace.getConfiguration('streamingMode');
        // Keep defaults tight to avoid false positives (e.g. Obsidian, Zoom, Teams)
        // Users can extend this list via `streamingMode.streamingProcesses`.
        this.streamingProcesses = config.get('streamingProcesses', [
            'obs',
            'obs64',
            'streamlabs obs',
            'streamlabs desktop',
            'xsplit',
        ]);
        this.detectionIntervalMs = config.get('detectionInterval', 5000);
        
        // Restart detection if it's currently running
        if (this.detectionInterval) {
            this.stopDetection();
            this.startDetection();
        }
    }

    startDetection(callback?: (isStreaming: boolean) => void): void {
        this.detectionInterval = setInterval(async () => {
            try {
                const isStreaming = await this.detectStreamingSoftware();
                if (isStreaming !== this.isCurrentlyDetected) {
                    this.isCurrentlyDetected = isStreaming;
                    if (callback) {
                        callback(isStreaming);
                    }
                }
            } catch (error) {
                console.error('Error detecting streaming software:', error);
            }
        }, this.detectionIntervalMs);

        // Run initial detection
        this.detectStreamingSoftware().then(isStreaming => {
            this.isCurrentlyDetected = isStreaming;
            if (callback) {
                callback(isStreaming);
            }
        }).catch(error => {
            console.error('Error in initial streaming detection:', error);
        });
    }

    stopDetection(): void {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = undefined;
        }
    }

    async detectStreamingSoftware(): Promise<boolean> {
        try {
            const processes = await psList();
            const normalizedTargets = this.streamingProcesses.map(p => this.normalizeProcessName(p));

            return processes.some((process: any) => {
                const processName = this.normalizeProcessName(process.name);
                return normalizedTargets.includes(processName);
            });
        } catch (error) {
            console.error('Failed to get process list:', error);
            return false;
        }
    }

    private normalizeProcessName(name: string): string {
        // Normalize for case and platform-specific suffixes
        let n = (name || '').toLowerCase().trim();
        // Remove common extensions/suffixes
        n = n.replace(/\.exe$/i, '');
        n = n.replace(/\.app$/i, '');
        // Collapse multiple spaces
        n = n.replace(/\s+/g, ' ');
        return n;
    }

    isCurrentlyStreaming(): boolean {
        return this.isCurrentlyDetected;
    }

    async checkStreamingStatus(): Promise<boolean> {
        const isStreaming = await this.detectStreamingSoftware();
        this.isCurrentlyDetected = isStreaming;
        return isStreaming;
    }
}
