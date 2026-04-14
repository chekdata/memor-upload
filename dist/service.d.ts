import type { ControllerSnapshot, BrowserAuthSession, MemorUploadConfig } from "./types.js";
import type { OpenClawPluginApi } from "./openclaw-types.js";
type Logger = {
    debug?: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
};
export declare class MemorUploadController {
    private config;
    private readonly logger;
    private readonly runtimeConfig;
    private readonly snapshot;
    private timer;
    private polling;
    private stateDir;
    private started;
    constructor(params: {
        config: MemorUploadConfig;
        logger: Logger;
        runtimeConfig: OpenClawPluginApi["runtime"]["config"];
    });
    attachStateDir(stateDir: string): void;
    getSnapshot(): ControllerSnapshot;
    getConfig(): MemorUploadConfig;
    start(): Promise<void>;
    stop(): Promise<void>;
    updateConfig(config: MemorUploadConfig): Promise<void>;
    persistConfigPatch(patch: Partial<MemorUploadConfig>): Promise<MemorUploadConfig>;
    syncAuthorizationSession(): Promise<BrowserAuthSession | null>;
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
