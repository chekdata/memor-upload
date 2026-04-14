import { afterEach, describe, expect, it, vi } from "vitest";
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
});
