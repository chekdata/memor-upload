export class ChekApiError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.name = "ChekApiError";
        this.status = status;
        this.body = body;
    }
}
export class ChekApiClient {
    baseUrl;
    accessToken;
    constructor(params) {
        this.baseUrl = params.baseUrl.replace(/\/+$/, "");
        this.accessToken = String(params.accessToken || "").trim();
    }
    async requestJson(path, options = {}) {
        const headers = {};
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
        let payload = null;
        if (rawText.trim()) {
            try {
                payload = JSON.parse(rawText);
            }
            catch {
                payload = rawText;
            }
        }
        if (!response.ok) {
            const message = (payload && typeof payload === "object" && "detail" in payload
                ? String(payload.detail || "")
                : "") || `${response.status} ${response.statusText}`;
            throw new ChekApiError(message, response.status, payload);
        }
        return payload;
    }
    async probe() {
        await this.listPendingMentionTasks(1);
    }
    async createBrowserAuthSession(input) {
        return await this.requestJson("/buddy/v1/openclaw/auth-sessions", {
            method: "POST",
            body: {
                installId: input.installId,
                deviceId: input.deviceId,
                sessionKey: input.sessionKey,
                metadata: input.metadata || {},
            },
        });
    }
    async pollBrowserAuthSession(sessionId, deviceCode) {
        const query = new URLSearchParams({ deviceCode });
        return await this.requestJson(`/buddy/v1/openclaw/auth-sessions/${sessionId}?${query.toString()}`);
    }
    async listPendingMentionTasks(pageSize = 20) {
        const query = new URLSearchParams({
            status: "pending",
            pageSize: String(pageSize),
        });
        const payload = await this.requestJson(`/buddy/v1/mention-tasks?${query.toString()}`);
        return Array.isArray(payload?.items) ? payload.items : [];
    }
    async listRoomMessages(postId, pageSize = 100) {
        const query = new URLSearchParams({
            pageSize: String(Math.max(1, Math.min(pageSize, 100))),
        });
        const payload = await this.requestJson(`/buddy/v1/posts/${postId}/messages?${query.toString()}`);
        return Array.isArray(payload?.items) ? payload.items : [];
    }
    async claimMentionTask(taskId) {
        return await this.requestJson(`/buddy/v1/mention-tasks/${taskId}`, {
            method: "POST",
            body: { action: "claim" },
        });
    }
    async completeMentionTask(taskId, result) {
        return await this.requestJson(`/buddy/v1/mention-tasks/${taskId}`, {
            method: "POST",
            body: { action: "complete", result },
        });
    }
    async failMentionTask(taskId, result) {
        return await this.requestJson(`/buddy/v1/mention-tasks/${taskId}`, {
            method: "POST",
            body: { action: "fail", result },
        });
    }
    async sendRoomMessage(postId, content) {
        return await this.requestJson(`/buddy/v1/posts/${postId}/messages`, {
            method: "POST",
            body: {
                content,
                mentions: [],
            },
        });
    }
}
