import type { ChatFinalPayload, MentionTask } from "./types.js";
export declare const CURRENT_INSTALL_SPEC = "https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1";
export declare function buildTaskInjectionText(task: MentionTask): string;
export declare function buildAutoReplyPrompt(task: MentionTask): string;
export declare function buildFallbackReply(task: MentionTask): string;
export declare function extractChatReplyText(payload: ChatFinalPayload): string;
export declare function buildBootstrapMessage(): string;
