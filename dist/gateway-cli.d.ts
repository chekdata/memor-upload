import type { ChatFinalPayload, SessionPatchResult } from "./types.js";
type GatewayInvocation = {
    command: string;
    argsPrefix: string[];
};
export declare function resolveGatewayInvocation(options?: {
    cliEntryEnv?: string;
    argv?: string[];
    resolveModule?: (() => string) | null;
    openclawBin?: string;
}): GatewayInvocation;
export declare function extractGatewayJsonPayload(stdout: string): string;
export declare function gatewayCall<T>(method: string, params: Record<string, unknown>, options?: {
    expectFinal?: boolean;
}): Promise<T>;
export declare function resolveTranscriptFile(result: SessionPatchResult): string;
type TranscriptEntry = {
    type?: string;
    id?: string;
    parentId?: string;
    message?: {
        role?: string;
        stopReason?: string;
        content?: Array<{
            type?: string;
            text?: string;
        }>;
    };
};
export declare function extractReplyFromTranscriptEntries(entries: TranscriptEntry[], messageId: string): string;
export declare function ensureSession(sessionKey: string, label: string): Promise<SessionPatchResult>;
export declare function injectSessionNote(sessionKey: string, message: string, label: string): Promise<void>;
export declare function sendChatPrompt(sessionKey: string, message: string, options?: {
    sessionLabel?: string;
}): Promise<ChatFinalPayload>;
export {};
