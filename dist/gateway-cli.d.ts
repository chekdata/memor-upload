import type { ChatFinalPayload, SessionPatchResult } from "./types.js";
export declare function gatewayCall<T>(method: string, params: Record<string, unknown>, options?: {
    expectFinal?: boolean;
}): Promise<T>;
export declare function ensureSession(sessionKey: string, label: string): Promise<SessionPatchResult>;
export declare function injectSessionNote(sessionKey: string, message: string, label: string): Promise<void>;
export declare function sendChatPrompt(sessionKey: string, message: string): Promise<ChatFinalPayload>;
