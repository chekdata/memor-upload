import { afterEach, describe, expect, it, vi } from "vitest";
const gatewayCliMocks = vi.hoisted(() => ({
    ensureSession: vi.fn(),
    injectSessionNote: vi.fn(),
    sendChatPrompt: vi.fn(),
}));
vi.mock("./gateway-cli.js", () => gatewayCliMocks);
import { parseConfig } from "./config.js";
import { MemorUploadController } from "./service.js";
function createRuntimeConfig(initialConfig) {
    let currentConfig = {
        plugins: {
            entries: {
                "memor-upload": {
                    enabled: true,
                    config: initialConfig,
                },
            },
        },
    };
    return {
        loadConfig: () => currentConfig,
        writeConfigFile: async (next) => {
            currentConfig = next;
        },
    };
}
function createLogger() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    };
}
describe("MemorUploadController", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("persists browser authorization results into plugin config", async () => {
        const runtimeConfig = createRuntimeConfig({
            backendAppBaseUrl: "https://api-dev.chekkk.com/api/backend-app",
            authSessionId: "auth-session-1",
            deviceCode: "ck-12345678",
        });
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            id: "auth-session-1",
            status: "authorized",
            authorizationStatus: "authorized",
            authorizedUserOneId: "u-browser",
            authorizedDisplayName: "浏览器用户",
            authorizedAt: "2026-04-14T20:18:00.000Z",
            pluginAccessToken: "ckmu_browser_token",
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }));
        vi.stubGlobal("fetch", fetchMock);
        const controller = new MemorUploadController({
            config: parseConfig({
                backendAppBaseUrl: "https://api-dev.chekkk.com/api/backend-app",
                authSessionId: "auth-session-1",
                deviceCode: "ck-12345678",
            }),
            logger: createLogger(),
            runtimeConfig,
        });
        const session = await controller.syncAuthorizationSession();
        expect(session?.pluginAccessToken).toBe("ckmu_browser_token");
        expect(controller.getConfig().accessToken).toBe("ckmu_browser_token");
        expect(controller.getConfig().authorizationStatus).toBe("authorized");
        expect(controller.getConfig().authorizedDisplayName).toBe("浏览器用户");
        expect(controller.getSnapshot().authorizedUserOneId).toBe("u-browser");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("does not block task completion when note injection fails", async () => {
        gatewayCliMocks.ensureSession.mockResolvedValue({});
        gatewayCliMocks.injectSessionNote.mockRejectedValue(new Error("gateway closed"));
        gatewayCliMocks.sendChatPrompt.mockRejectedValue(new Error("model unavailable"));
        const logger = createLogger();
        const controller = new MemorUploadController({
            config: parseConfig({
                backendAppBaseUrl: "https://api-dev.chekkk.com/api/backend-app",
                accessToken: "ckmu_test_token",
                sessionKey: "agent:main:chek:mentions",
            }),
            logger,
            runtimeConfig: createRuntimeConfig({
                backendAppBaseUrl: "https://api-dev.chekkk.com/api/backend-app",
                accessToken: "ckmu_test_token",
                sessionKey: "agent:main:chek:mentions",
            }),
        });
        const task = {
            id: "task-1",
            postId: "post-1",
            payload: {
                postId: "post-1",
                postTitle: "Smoke Room",
                messageContent: "@CHEK 用户 你先简单介绍一下你会做什么",
                mentionedByDisplayName: "Smoke Sender",
            },
        };
        const api = {
            claimMentionTask: vi.fn().mockResolvedValue(task),
            sendRoomMessage: vi.fn().mockResolvedValue({}),
            completeMentionTask: vi.fn().mockResolvedValue({ status: "completed" }),
            failMentionTask: vi.fn().mockResolvedValue({ status: "failed" }),
        };
        await controller["processTask"](api, task);
        await Promise.resolve();
        await Promise.resolve();
        expect(api.completeMentionTask).toHaveBeenCalledWith("task-1", expect.objectContaining({
            mode: "fallback",
            sessionKey: "agent:main:chek:mentions",
        }));
        expect(api.failMentionTask).not.toHaveBeenCalled();
        expect(api.sendRoomMessage).toHaveBeenCalledWith("post-1", "收到，我先看一下，稍后给你回复。");
        expect(controller.getSnapshot().lastTaskId).toBe("task-1");
        expect(logger.warn).toHaveBeenCalled();
    });
});
