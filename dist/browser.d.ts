import type { MemorUploadConfig } from "./types.js";
export declare function ensureInstallIdentity(config: MemorUploadConfig): Pick<MemorUploadConfig, "installId" | "deviceId">;
export declare function openBrowser(url: string): Promise<void>;
