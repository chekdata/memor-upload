import type { Command } from "commander";
export type ReplyPayload = {
    text?: string;
};
export type PluginCommandContext = {
    channel: string;
    isAuthorizedSender: boolean;
    args?: string;
    commandBody: string;
    config: Record<string, unknown>;
};
export type OpenClawPluginApi = {
    pluginConfig?: Record<string, unknown>;
    logger: {
        debug?: (message: string) => void;
        info: (message: string) => void;
        warn: (message: string) => void;
        error: (message: string) => void;
    };
    runtime: {
        config: {
            loadConfig: () => Record<string, unknown>;
            writeConfigFile: (config: Record<string, unknown>) => Promise<void>;
        };
    };
    registerCommand: (definition: {
        name: string;
        description: string;
        acceptsArgs?: boolean;
        requireAuth?: boolean;
        handler: (ctx: PluginCommandContext) => ReplyPayload | Promise<ReplyPayload>;
    }) => void;
    registerCli: (registrar: (ctx: {
        program: Command;
    }) => void | Promise<void>, opts?: {
        commands?: string[];
    }) => void;
    registerService: (service: {
        id: string;
        start: (ctx: {
            stateDir: string;
        }) => void | Promise<void>;
        stop?: () => void | Promise<void>;
    }) => void;
};
