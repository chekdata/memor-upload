import type {
  BrowserAuthSession,
  BuddyRoomMessage,
  JsonObject,
  MentionTask,
} from "./types.js";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export class ChekApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ChekApiError";
    this.status = status;
    this.body = body;
  }
}

export class ChekApiClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(params: { baseUrl: string; accessToken?: string }) {
    this.baseUrl = params.baseUrl.replace(/\/+$/, "");
    this.accessToken = String(params.accessToken || "").trim();
  }

  private async requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers.Authorization = this.accessToken.startsWith("Bearer ")
        ? this.accessToken
        : `Bearer ${this.accessToken}`;
    }
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const rawText = await response.text();
    let payload: unknown = null;
    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText) as unknown;
      } catch {
        payload = rawText;
      }
    }
    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && "detail" in (payload as JsonObject)
          ? String((payload as JsonObject).detail || "")
          : "") || `${response.status} ${response.statusText}`;
      throw new ChekApiError(message, response.status, payload);
    }
    return payload as T;
  }

  async probe(): Promise<void> {
    await this.listPendingMentionTasks(1);
  }

  async createBrowserAuthSession(input: {
    installId: string;
    deviceId: string;
    sessionKey: string;
    metadata?: JsonObject;
  }): Promise<BrowserAuthSession> {
    return await this.requestJson<BrowserAuthSession>("/buddy/v1/openclaw/auth-sessions", {
      method: "POST",
      body: {
        installId: input.installId,
        deviceId: input.deviceId,
        sessionKey: input.sessionKey,
        metadata: input.metadata || {},
      },
    });
  }

  async pollBrowserAuthSession(sessionId: string, deviceCode: string): Promise<BrowserAuthSession> {
    const query = new URLSearchParams({ deviceCode });
    return await this.requestJson<BrowserAuthSession>(
      `/buddy/v1/openclaw/auth-sessions/${sessionId}?${query.toString()}`,
    );
  }

  async listPendingMentionTasks(pageSize = 20): Promise<MentionTask[]> {
    const query = new URLSearchParams({
      status: "pending",
      pageSize: String(pageSize),
    });
    const payload = await this.requestJson<{ items?: MentionTask[] }>(
      `/buddy/v1/mention-tasks?${query.toString()}`,
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async listRoomMessages(postId: string, pageSize = 100): Promise<BuddyRoomMessage[]> {
    const query = new URLSearchParams({
      pageSize: String(Math.max(1, Math.min(pageSize, 100))),
    });
    const payload = await this.requestJson<{ items?: BuddyRoomMessage[] }>(
      `/buddy/v1/posts/${postId}/messages?${query.toString()}`,
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async claimMentionTask(taskId: string): Promise<MentionTask> {
    return await this.requestJson<MentionTask>(`/buddy/v1/mention-tasks/${taskId}`, {
      method: "POST",
      body: { action: "claim" },
    });
  }

  async completeMentionTask(taskId: string, result: JsonObject): Promise<MentionTask> {
    return await this.requestJson<MentionTask>(`/buddy/v1/mention-tasks/${taskId}`, {
      method: "POST",
      body: { action: "complete", result },
    });
  }

  async failMentionTask(taskId: string, result: JsonObject): Promise<MentionTask> {
    return await this.requestJson<MentionTask>(`/buddy/v1/mention-tasks/${taskId}`, {
      method: "POST",
      body: { action: "fail", result },
    });
  }

  async sendRoomMessage(postId: string, content: string): Promise<JsonObject> {
    return await this.requestJson<JsonObject>(`/buddy/v1/posts/${postId}/messages`, {
      method: "POST",
      body: {
        content,
        mentions: [],
      },
    });
  }
}
