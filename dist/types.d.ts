export type JsonObject = Record<string, unknown>;
export type MentionTaskPayload = {
    taskType?: string;
    postId?: string;
    postTitle?: string;
    messageId?: string;
    messageContent?: string;
    mentionedByUserOneId?: string;
    mentionedByDisplayName?: string;
    mentionedUserOneId?: string;
    mentionedDisplayName?: string;
    autoReply?: boolean;
};
export type BuddyRoomMessage = {
    id: string;
    kind?: string | null;
    content?: string | null;
    createdAt?: string | null;
    userOneId?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
};
export type MentionTask = {
    id: string;
    userOneId?: string | null;
    postId?: string | null;
    messageId?: string | null;
    notificationId?: string | null;
    status: string;
    payload: MentionTaskPayload;
    result: JsonObject;
    claimedAt?: string | null;
    completedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};
export type MemorUploadConfig = {
    enabled: boolean;
    backendAppBaseUrl: string;
    accessToken: string;
    pollIntervalMs: number;
    sessionKey: string;
    installId: string;
    deviceId: string;
    authSessionId: string;
    deviceCode: string;
    authorizationStatus: string;
    authorizationUrl: string;
    authorizedUserOneId: string;
    authorizedDisplayName: string;
    lastAuthorizedAt: string;
};
export type ControllerSnapshot = {
    running: boolean;
    configured: boolean;
    backendAppBaseUrl: string;
    pollIntervalMs: number;
    sessionKey: string;
    accessTokenConfigured: boolean;
    installId: string;
    deviceId: string;
    authSessionId: string | null;
    authorizationStatus: string;
    authorizationUrl: string | null;
    authorizedUserOneId: string | null;
    authorizedDisplayName: string | null;
    lastAuthorizedAt: string | null;
    lastPollAt: string | null;
    lastSuccessAt: string | null;
    lastTaskAt: string | null;
    lastTaskId: string | null;
    lastError: string | null;
};
export type BrowserAuthSession = {
    id: string;
    installId?: string | null;
    deviceId?: string | null;
    sessionKey?: string | null;
    deviceCode?: string | null;
    status: string;
    authorizationStatus?: string | null;
    authorizationUrl?: string | null;
    pollIntervalMs?: number | null;
    expiresAt?: string | null;
    authorizedUserOneId?: string | null;
    authorizedDisplayName?: string | null;
    authorizedAvatarUrl?: string | null;
    authorizedAt?: string | null;
    lastPolledAt?: string | null;
    pluginAccessToken?: string | null;
};
export type SessionPatchEntry = {
    sessionId?: string;
    sessionFile?: string;
};
export type SessionPatchResult = {
    ok?: boolean;
    path?: string;
    key?: string;
    entry?: SessionPatchEntry;
};
export type ChatFinalPayload = {
    runId?: string;
    status?: string;
    result?: {
        payloads?: Array<{
            text?: string;
        }>;
    };
};
export type ReplyIntent = "openclaw_bootstrap" | "generic" | "posting_copy" | "listing_readiness" | "value_judgement" | "appeal_judgement" | "clarity_judgement" | "download_troubleshoot" | "distribution_choice";
export type ProcessedTaskResult = {
    reply: string;
    mode: "model" | "strategy" | "fallback";
    sessionKey: string;
    intent: ReplyIntent;
};
