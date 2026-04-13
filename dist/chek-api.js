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
        this.accessToken = params.accessToken.trim();
    }
    async requestJson(path, options = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: options.method ?? "GET",
            headers: {
                Authorization: this.accessToken.startsWith("Bearer ")
                    ? this.accessToken
                    : `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
            },
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
    async listPendingMentionTasks(pageSize = 20) {
        const query = new URLSearchParams({
            status: "pending",
            pageSize: String(pageSize),
        });
        const payload = await this.requestJson(`/buddy/v1/mention-tasks?${query.toString()}`);
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
