import type { ControllerSnapshot, MemorUploadConfig } from "./types.js";
type Logger = {
    debug?: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
};
export declare class MemorUploadController {
    private config;
    private readonly logger;
    private readonly snapshot;
    private timer;
    private polling;
    private stateDir;
    private started;
    constructor(params: {
        config: MemorUploadConfig;
        logger: Logger;
    });
    attachStateDir(stateDir: string): void;
    getSnapshot(): ControllerSnapshot;
    start(): Promise<void>;
    stop(): Promise<void>;
    updateConfig(config: MemorUploadConfig): Promise<void>;
    runHealthCheck(): Promise<{
        backend: string;
        gateway: string;
    }>;
    private scheduleNext;
    private pollLoop;
    private pollOnce;
    private processTask;
    private generateReply;
    private persistSnapshot;
}
export {};
