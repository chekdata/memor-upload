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
        };
    };
    register(api: OpenClawPluginApi): void;
};
export default memorUploadPlugin;
