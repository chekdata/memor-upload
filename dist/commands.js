import { parseSetupArgs } from "./args.js";
import { maskToken, parseConfig, resolveAccessToken, withConfigPatch, } from "./config.js";
import { buildBootstrapMessage } from "./render.js";
function formatStatus(controller) {
    const snapshot = controller.getSnapshot();
    return [
        "MEMOR Upload 状态",
        `- running: ${snapshot.running ? "yes" : "no"}`,
        `- configured: ${snapshot.configured ? "yes" : "no"}`,
        `- backend: ${snapshot.backendAppBaseUrl}`,
        `- session: ${snapshot.sessionKey}`,
        `- pollIntervalMs: ${snapshot.pollIntervalMs}`,
        `- accessToken: ${snapshot.accessTokenConfigured ? "configured" : "missing"}`,
        `- lastPollAt: ${snapshot.lastPollAt || "-"}`,
        `- lastSuccessAt: ${snapshot.lastSuccessAt || "-"}`,
        `- lastTaskAt: ${snapshot.lastTaskAt || "-"}`,
        `- lastTaskId: ${snapshot.lastTaskId || "-"}`,
        `- lastError: ${snapshot.lastError || "-"}`,
    ].join("\n");
}
function formatSetupUsage() {
    return [
        "用法：",
        "/chek-setup token=<CHEK_ACCESS_TOKEN> [backend=https://api-dev.chekkk.com/api/backend-app] [session=agent:main:chek:mentions] [interval=5000]",
        "",
        "也可以在 CLI 里执行：",
        "openclaw chek setup --token <CHEK_ACCESS_TOKEN>",
    ].join("\n");
}
async function persistPluginConfig(api, controller, patch) {
    const currentConfig = api.runtime.config.loadConfig();
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
    await api.runtime.config.writeConfigFile({
        ...currentConfig,
        plugins: {
            ...plugins,
            entries,
        },
    });
    await controller.updateConfig(nextPluginConfig);
    return [
        "MEMOR Upload 已保存。",
        `- backend: ${nextPluginConfig.backendAppBaseUrl}`,
        `- session: ${nextPluginConfig.sessionKey}`,
        `- interval: ${nextPluginConfig.pollIntervalMs}ms`,
        `- token: ${maskToken(resolveAccessToken(nextPluginConfig))}`,
    ].join("\n");
}
export function registerMemorUploadCommands(api, controller) {
    api.registerCommand({
        name: "chek-setup",
        description: "Configure MEMOR Upload for CHEK mention-task polling.",
        acceptsArgs: true,
        handler: async (ctx) => {
            const rawArgs = ctx.args?.trim() ?? "";
            if (!rawArgs) {
                return {
                    text: `${formatSetupUsage()}\n\n${formatStatus(controller)}`,
                };
            }
            const parsed = parseSetupArgs(rawArgs);
            const patch = {};
            if (parsed.token !== undefined)
                patch.accessToken = parsed.token;
            if (parsed.backend !== undefined)
                patch.backendAppBaseUrl = parsed.backend;
            if (parsed.session !== undefined)
                patch.sessionKey = parsed.session;
            if (parsed.interval !== undefined)
                patch.pollIntervalMs = parsed.interval;
            if (parsed.enable !== undefined)
                patch.enabled = parsed.enable;
            const saved = await persistPluginConfig(api, controller, patch);
            try {
                await controller.runHealthCheck();
                return {
                    text: `${saved}\n- health: backend ok, gateway ok`,
                };
            }
            catch (error) {
                return {
                    text: `${saved}\n- health: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    });
    api.registerCommand({
        name: "chek-status",
        description: "Show MEMOR Upload runtime status.",
        handler: async () => ({
            text: formatStatus(controller),
        }),
    });
    api.registerCommand({
        name: "chek-bootstrap",
        description: "Print the one-shot bootstrap text for MEMOR Upload.",
        handler: async () => ({
            text: buildBootstrapMessage(),
        }),
    });
}
export function registerMemorUploadCli(program, api, controller) {
    const chek = program.command("chek").description("MEMOR Upload helpers for CHEK");
    chek
        .command("setup")
        .description("Persist MEMOR Upload config into OpenClaw")
        .requiredOption("--token <token>", "CHEK access token")
        .option("--backend <url>", "CHEK backend-app base URL")
        .option("--session <key>", "Stable local OpenClaw session key")
        .option("--interval <ms>", "Poll interval in milliseconds")
        .option("--disable", "Disable the bridge after saving", false)
        .action(async (options) => {
        const patch = {
            accessToken: String(options.token || "").trim(),
        };
        if (options.backend)
            patch.backendAppBaseUrl = String(options.backend).trim();
        if (options.session)
            patch.sessionKey = String(options.session).trim();
        if (options.interval !== undefined)
            patch.pollIntervalMs = Number(options.interval);
        if (options.disable)
            patch.enabled = false;
        const message = await persistPluginConfig(api, controller, patch);
        try {
            await controller.runHealthCheck();
            console.log(`${message}\n- health: backend ok, gateway ok`);
        }
        catch (error) {
            console.log(`${message}\n- health: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    chek
        .command("status")
        .description("Print current MEMOR Upload runtime status")
        .action(() => {
        console.log(formatStatus(controller));
    });
    chek
        .command("bootstrap")
        .description("Print the canonical bootstrap message")
        .action(() => {
        console.log(buildBootstrapMessage());
    });
}
