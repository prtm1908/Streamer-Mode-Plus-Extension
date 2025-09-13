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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingDetector = void 0;
const vscode = __importStar(require("vscode"));
const ps_list_1 = __importDefault(require("ps-list"));
class StreamingDetector {
    constructor() {
        this.streamingProcesses = [];
        this.detectionIntervalMs = 5000;
        this.isCurrentlyDetected = false;
        this.updateConfiguration();
    }
    updateConfiguration() {
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
    startDetection(callback) {
        this.detectionInterval = setInterval(async () => {
            try {
                const isStreaming = await this.detectStreamingSoftware();
                if (isStreaming !== this.isCurrentlyDetected) {
                    this.isCurrentlyDetected = isStreaming;
                    if (callback) {
                        callback(isStreaming);
                    }
                }
            }
            catch (error) {
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
    stopDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = undefined;
        }
    }
    async detectStreamingSoftware() {
        try {
            const processes = await (0, ps_list_1.default)();
            const normalizedTargets = this.streamingProcesses.map(p => this.normalizeProcessName(p));
            return processes.some((process) => {
                const processName = this.normalizeProcessName(process.name);
                return normalizedTargets.includes(processName);
            });
        }
        catch (error) {
            console.error('Failed to get process list:', error);
            return false;
        }
    }
    normalizeProcessName(name) {
        // Normalize for case and platform-specific suffixes
        let n = (name || '').toLowerCase().trim();
        // Remove common extensions/suffixes
        n = n.replace(/\.exe$/i, '');
        n = n.replace(/\.app$/i, '');
        // Collapse multiple spaces
        n = n.replace(/\s+/g, ' ');
        return n;
    }
    isCurrentlyStreaming() {
        return this.isCurrentlyDetected;
    }
    async checkStreamingStatus() {
        const isStreaming = await this.detectStreamingSoftware();
        this.isCurrentlyDetected = isStreaming;
        return isStreaming;
    }
}
exports.StreamingDetector = StreamingDetector;
//# sourceMappingURL=streamingDetector.js.map