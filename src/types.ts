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
};

export type ControllerSnapshot = {
  running: boolean;
  configured: boolean;
  backendAppBaseUrl: string;
  pollIntervalMs: number;
  sessionKey: string;
  accessTokenConfigured: boolean;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastTaskAt: string | null;
  lastTaskId: string | null;
  lastError: string | null;
};

export type SessionPatchEntry = {
  sessionId?: string;
  sessionFile?: string;
};

export type SessionPatchResult = {
  ok?: boolean;
  key?: string;
  entry?: SessionPatchEntry;
};

export type ChatFinalPayload = {
  status?: string;
  result?: {
    payloads?: Array<{
      text?: string;
    }>;
  };
};

export type ProcessedTaskResult = {
  reply: string;
  mode: "model" | "fallback";
  sessionKey: string;
};
