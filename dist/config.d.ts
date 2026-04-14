import type { MemorUploadConfig } from "./types.js";
export declare const DEFAULT_BACKEND_APP_BASE_URL = "https://api-dev.chekkk.com/api/backend-app";
export declare const DEFAULT_POLL_INTERVAL_MS = 5000;
export declare const DEFAULT_SESSION_KEY = "agent:main:chek:mentions";
export declare const ACCESS_TOKEN_ENV_NAMES: readonly ["CHEK_ACCESS_TOKEN", "CHEK_MEMOR_ACCESS_TOKEN"];
export declare const CONFIG_JSON_SCHEMA: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly enabled: {
            readonly type: "boolean";
        };
        readonly backendAppBaseUrl: {
            readonly type: "string";
            readonly minLength: 1;
        };
        readonly accessToken: {
            readonly type: "string";
        };
        readonly pollIntervalMs: {
            readonly type: "integer";
            readonly minimum: 2000;
            readonly maximum: 60000;
        };
        readonly sessionKey: {
            readonly type: "string";
            readonly minLength: 1;
        };
        readonly installId: {
            readonly type: "string";
        };
        readonly deviceId: {
            readonly type: "string";
        };
        readonly authSessionId: {
            readonly type: "string";
        };
        readonly deviceCode: {
            readonly type: "string";
        };
        readonly authorizationStatus: {
            readonly type: "string";
        };
        readonly authorizationUrl: {
            readonly type: "string";
        };
        readonly authorizedUserOneId: {
            readonly type: "string";
        };
        readonly authorizedDisplayName: {
            readonly type: "string";
        };
        readonly lastAuthorizedAt: {
            readonly type: "string";
        };
    };
};
export declare const CONFIG_UI_HINTS: {
    readonly enabled: {
        readonly label: "Enabled";
    };
    readonly backendAppBaseUrl: {
        readonly label: "CHEK Backend URL";
        readonly placeholder: "https://api-dev.chekkk.com/api/backend-app";
    };
    readonly accessToken: {
        readonly label: "CHEK Access Token";
        readonly sensitive: true;
        readonly help: "If left empty, the plugin falls back to CHEK_ACCESS_TOKEN from the environment.";
    };
    readonly pollIntervalMs: {
        readonly label: "Poll Interval (ms)";
    };
    readonly sessionKey: {
        readonly label: "OpenClaw Session Key";
        readonly placeholder: "agent:main:chek:mentions";
    };
    readonly installId: {
        readonly label: "Install ID";
    };
    readonly deviceId: {
        readonly label: "Device ID";
    };
    readonly authSessionId: {
        readonly label: "Auth Session ID";
    };
    readonly deviceCode: {
        readonly label: "Device Code";
    };
    readonly authorizationStatus: {
        readonly label: "Authorization Status";
    };
    readonly authorizationUrl: {
        readonly label: "Authorization URL";
    };
    readonly authorizedUserOneId: {
        readonly label: "Authorized User One ID";
    };
    readonly authorizedDisplayName: {
        readonly label: "Authorized User";
    };
    readonly lastAuthorizedAt: {
        readonly label: "Last Authorized At";
    };
};
export declare function normalizeBackendAppBaseUrl(value: string): string;
export declare function parseConfig(value: unknown): MemorUploadConfig;
export declare function resolveAccessToken(config: MemorUploadConfig): string;
export declare function withConfigPatch(baseConfig: MemorUploadConfig, patch: Partial<MemorUploadConfig>): MemorUploadConfig;
export declare function isConfigured(config: MemorUploadConfig): boolean;
export declare function maskToken(token: string): string;
