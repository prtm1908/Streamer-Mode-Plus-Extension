export declare class StreamingDetector {
    private detectionInterval;
    private streamingProcesses;
    private detectionIntervalMs;
    private isCurrentlyDetected;
    constructor();
    updateConfiguration(): void;
    startDetection(callback?: (isStreaming: boolean) => void): void;
    stopDetection(): void;
    detectStreamingSoftware(): Promise<boolean>;
    isCurrentlyStreaming(): boolean;
    checkStreamingStatus(): Promise<boolean>;
}
//# sourceMappingURL=streamingDetector.d.ts.map