import type { ChatFinalPayload, MentionTask } from "./types.js";
export declare const CURRENT_INSTALL_SPEC = "https://github.com/chekdata/memor-upload/releases/download/v0.1.0/chek-memor-upload-0.1.0.tgz?download=1";
export declare function buildTaskInjectionText(task: MentionTask): string;
export declare function buildAutoReplyPrompt(task: MentionTask): string;
export declare function buildFallbackReply(task: MentionTask): string;
export declare function extractChatReplyText(payload: ChatFinalPayload): string;
export declare function buildBootstrapMessage(): string;
