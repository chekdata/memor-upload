import { promises as fs } from "node:fs";
import path from "node:path";
import { ChekApiClient, ChekApiError } from "./chek-api.js";
import { isConfigured, parseConfig, resolveAccessToken, withConfigPatch, } from "./config.js";
import { ensureSession, injectSessionNote, sendChatPrompt, } from "./gateway-cli.js";
import { buildAutoReplyPrompt, buildFallbackReply, buildTaskInjectionText, extractChatReplyText, } from "./render.js";
const SESSION_LABEL = "CHEK Mentions";
const STATUS_FILE_NAME = "memor-upload-status.json";
function nowIso() {
    return new Date().toISOString();
}
function summarizeError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
export class MemorUploadController {
    config;
    logger;
    runtimeConfig;
    snapshot;
    timer = null;
    polling = false;
    stateDir = null;
    started = false;
    constructor(params) {
        this.config = params.config;
        this.logger = params.logger;
        this.runtimeConfig = params.runtimeConfig;
        this.snapshot = {
            running: false,
            configured: isConfigured(params.config),
            backendAppBaseUrl: params.config.backendAppBaseUrl,
            pollIntervalMs: params.config.pollIntervalMs,
            sessionKey: params.config.sessionKey,
            accessTokenConfigured: Boolean(resolveAccessToken(params.config)),
            installId: params.config.installId,
            deviceId: params.config.deviceId,
            authSessionId: params.config.authSessionId || null,
            authorizationStatus: params.config.authorizationStatus || "",
            authorizationUrl: params.config.authorizationUrl || null,
            authorizedUserOneId: params.config.authorizedUserOneId || null,
            authorizedDisplayName: params.config.authorizedDisplayName || null,
            lastAuthorizedAt: params.config.lastAuthorizedAt || null,
            lastPollAt: null,
            lastSuccessAt: null,
            lastTaskAt: null,
            lastTaskId: null,
            lastError: null,
        };
    }
    attachStateDir(stateDir) {
        this.stateDir = stateDir;
    }
    getSnapshot() {
        return { ...this.snapshot };
    }
    getConfig() {
        return { ...this.config };
    }
    async start() {
        this.started = true;
        this.snapshot.running = true;
        await this.persistSnapshot();
        this.scheduleNext(250);
    }
    async stop() {
        this.started = false;
        this.snapshot.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        await this.persistSnapshot();
    }
    async updateConfig(config) {
        this.config = config;
        this.snapshot.configured = isConfigured(config);
        this.snapshot.backendAppBaseUrl = config.backendAppBaseUrl;
        this.snapshot.pollIntervalMs = config.pollIntervalMs;
        this.snapshot.sessionKey = config.sessionKey;
        this.snapshot.accessTokenConfigured = Boolean(resolveAccessToken(config));
        this.snapshot.installId = config.installId;
        this.snapshot.deviceId = config.deviceId;
        this.snapshot.authSessionId = config.authSessionId || null;
        this.snapshot.authorizationStatus = config.authorizationStatus || "";
        this.snapshot.authorizationUrl = config.authorizationUrl || null;
        this.snapshot.authorizedUserOneId = config.authorizedUserOneId || null;
        this.snapshot.authorizedDisplayName = config.authorizedDisplayName || null;
        this.snapshot.lastAuthorizedAt = config.lastAuthorizedAt || null;
        this.snapshot.lastError = null;
        await this.persistSnapshot();
        if (this.started) {
            this.scheduleNext(250);
        }
    }
    async persistConfigPatch(patch) {
        const currentConfig = this.runtimeConfig.loadConfig();
        const plugins = (currentConfig.plugins ?? {});
        const entries = plugins.entries && typeof plugins.entries === "object" && !Array.isArray(plugins.entries)
            ? { ...plugins.entries }
            : {};
        const existingEntry = entries["memor-upload"] && typeof entries["memor-upload"] === "object"
            ? entries["memor-upload"]
            : {};
        const existingPluginConfig = parseConfig(existingEntry.config);
        const nextPluginConfig = withConfigPatch(existingPluginConfig, patch);
        entries["memor-upload"] = {
            ...existingEntry,
            enabled: nextPluginConfig.enabled,
            config: nextPluginConfig,
        };
        await this.runtimeConfig.writeConfigFile({
            ...currentConfig,
            plugins: {
                ...plugins,
                entries,
            },
        });
        await this.updateConfig(nextPluginConfig);
        return nextPluginConfig;
    }
    async syncAuthorizationSession() {
        const authSessionId = this.config.authSessionId.trim();
        const deviceCode = this.config.deviceCode.trim();
        if (!authSessionId || !deviceCode) {
            return null;
        }
        const api = new ChekApiClient({
            baseUrl: this.config.backendAppBaseUrl,
        });
        const session = await api.pollBrowserAuthSession(authSessionId, deviceCode);
        const patch = {
            authorizationStatus: String(session.authorizationStatus || session.status || this.config.authorizationStatus).trim(),
            authorizationUrl: String(session.authorizationUrl || this.config.authorizationUrl || "").trim(),
            authorizedUserOneId: String(session.authorizedUserOneId || this.config.authorizedUserOneId || "").trim(),
            authorizedDisplayName: String(session.authorizedDisplayName || this.config.authorizedDisplayName || "").trim(),
            lastAuthorizedAt: String(session.authorizedAt || this.config.lastAuthorizedAt || "").trim(),
        };
        const pluginAccessToken = String(session.pluginAccessToken || "").trim();
        if (pluginAccessToken) {
            patch.accessToken = pluginAccessToken;
        }
        await this.persistConfigPatch(patch);
        return session;
    }
    async runHealthCheck() {
        let accessToken = resolveAccessToken(this.config);
        if (!accessToken && this.config.authSessionId.trim() && this.config.deviceCode.trim()) {
            await this.syncAuthorizationSession();
            accessToken = resolveAccessToken(this.config);
        }
        if (!accessToken) {
            throw new Error("CHEK access token is not configured.");
        }
        const api = new ChekApiClient({
            baseUrl: this.config.backendAppBaseUrl,
            accessToken,
        });
        await api.probe();
        await ensureSession(this.config.sessionKey, SESSION_LABEL);
        return {
            backend: "ok",
            gateway: "ok",
        };
    }
    scheduleNext(delayMs) {
        if (!this.started) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            void this.pollLoop();
        }, delayMs);
    }
    async pollLoop() {
        if (!this.started || this.polling) {
            return;
        }
        this.polling = true;
        try {
            await this.pollOnce();
        }
        finally {
            this.polling = false;
            this.scheduleNext(this.config.pollIntervalMs);
        }
    }
    async pollOnce() {
        this.snapshot.lastPollAt = nowIso();
        this.snapshot.lastError = null;
        this.snapshot.configured = isConfigured(this.config);
        this.snapshot.accessTokenConfigured = Boolean(resolveAccessToken(this.config));
        await this.persistSnapshot();
        if (!this.config.enabled) {
            return;
        }
        let accessToken = resolveAccessToken(this.config);
        if (!accessToken) {
            if (this.config.authSessionId.trim() && this.config.deviceCode.trim()) {
                try {
                    const session = await this.syncAuthorizationSession();
                    const sessionStatus = String(session?.authorizationStatus || session?.status || "").trim();
                    if (String(session?.pluginAccessToken || "").trim()) {
                        this.snapshot.lastSuccessAt = nowIso();
                        this.snapshot.lastError = null;
                        accessToken = resolveAccessToken(this.config);
                    }
                    else if (sessionStatus === "pending") {
                        this.snapshot.lastError = "Waiting for browser authorization.";
                    }
                    else if (sessionStatus) {
                        this.snapshot.lastError = `Browser authorization status: ${sessionStatus}`;
                    }
                    else {
                        this.snapshot.lastError = "CHEK browser authorization has not completed yet.";
                    }
                }
                catch (error) {
                    this.snapshot.lastError = summarizeError(error);
                }
            }
            else {
                this.snapshot.lastError = "CHEK access token is not configured.";
            }
            if (!accessToken) {
                await this.persistSnapshot();
                return;
            }
        }
        const api = new ChekApiClient({
            baseUrl: this.config.backendAppBaseUrl,
            accessToken,
        });
        try {
            const tasks = await api.listPendingMentionTasks(20);
            this.snapshot.lastSuccessAt = nowIso();
            await this.persistSnapshot();
            for (const task of [...tasks].reverse()) {
                await this.processTask(api, task);
            }
        }
        catch (error) {
            this.snapshot.lastError = summarizeError(error);
            this.logger.error(`[memor-upload] poll failed: ${this.snapshot.lastError}`);
            await this.persistSnapshot();
        }
    }
    async processTask(api, task) {
        let claimedTask = null;
        try {
            claimedTask = await api.claimMentionTask(task.id);
        }
        catch (error) {
            if (error instanceof ChekApiError && error.status === 409) {
                return;
            }
            throw error;
        }
        try {
            const postId = String(task.payload.postId || task.postId || "").trim();
            if (!postId) {
                throw new Error(`Task ${task.id} is missing postId.`);
            }
            await ensureSession(this.config.sessionKey, SESSION_LABEL);
            await injectSessionNote(this.config.sessionKey, buildTaskInjectionText(task), "CHEK @");
            const processed = await this.generateReply(task);
            await api.sendRoomMessage(postId, processed.reply);
            await api.completeMentionTask(task.id, {
                reply: processed.reply,
                mode: processed.mode,
                sessionKey: processed.sessionKey,
            });
            this.snapshot.lastTaskAt = nowIso();
            this.snapshot.lastTaskId = task.id;
            this.snapshot.lastSuccessAt = nowIso();
            await injectSessionNote(this.config.sessionKey, `已自动回复到《${task.payload.postTitle || postId}》：${processed.reply}`, "CHEK 已发送");
            await this.persistSnapshot();
        }
        catch (error) {
            const reason = summarizeError(error);
            this.snapshot.lastError = reason;
            await this.persistSnapshot();
            try {
                await injectSessionNote(this.config.sessionKey, `自动回复失败：${reason}`, "CHEK 失败");
            }
            catch (injectError) {
                this.logger.warn(`[memor-upload] failed to inject failure note: ${summarizeError(injectError)}`);
            }
            if (claimedTask) {
                try {
                    await api.failMentionTask(task.id, {
                        error: reason,
                        sessionKey: this.config.sessionKey,
                    });
                }
                catch (failError) {
                    this.logger.error(`[memor-upload] failed to mark task ${task.id} as failed: ${summarizeError(failError)}`);
                }
            }
        }
    }
    async generateReply(task) {
        const prompt = buildAutoReplyPrompt(task);
        try {
            const result = await sendChatPrompt(this.config.sessionKey, prompt);
            const reply = extractChatReplyText(result);
            if (!reply) {
                throw new Error("OpenClaw returned an empty reply.");
            }
            return {
                reply,
                mode: "model",
                sessionKey: this.config.sessionKey,
            };
        }
        catch (error) {
            const fallbackReply = buildFallbackReply(task);
            await injectSessionNote(this.config.sessionKey, `本地模型生成失败，已使用兜底回复：${summarizeError(error)}`, "CHEK 兜底");
            return {
                reply: fallbackReply,
                mode: "fallback",
                sessionKey: this.config.sessionKey,
            };
        }
    }
    async persistSnapshot() {
        if (!this.stateDir) {
            return;
        }
        const targetPath = path.join(this.stateDir, STATUS_FILE_NAME);
        await fs.mkdir(this.stateDir, { recursive: true });
        await fs.writeFile(targetPath, `${JSON.stringify(this.snapshot, null, 2)}\n`, "utf-8");
    }
}
