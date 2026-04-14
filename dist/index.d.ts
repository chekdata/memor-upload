import { parseConfig } from "./config.js";
import type { OpenClawPluginApi } from "./openclaw-types.js";
declare const memorUploadPlugin: {
    id: string;
    name: string;
    description: string;
    configSchema: {
        parse: typeof parseConfig;
        jsonSchema: {
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
        uiHints: {
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
    };
    register(api: OpenClawPluginApi): void;
};
export default memorUploadPlugin;
