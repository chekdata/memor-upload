import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import os from "node:os";

import { parseSetupArgs } from "./args.js";
import { ChekApiClient } from "./chek-api.js";
import { maskToken, resolveAccessToken } from "./config.js";
import type { OpenClawPluginApi } from "./openclaw-types.js";
import { buildBootstrapMessage } from "./render.js";
import { MemorUploadController } from "./service.js";
import type { BrowserAuthSession, MemorUploadConfig } from "./types.js";

const AUTHORIZATION_WAIT_TIMEOUT_MS = 180_000;

function formatStatus(controller: MemorUploadController): string {
  const snapshot = controller.getSnapshot();
  return [
    "MEMOR Upload 状态",
    `- running: ${snapshot.running ? "yes" : "no"}`,
    `- configured: ${snapshot.configured ? "yes" : "no"}`,
    `- backend: ${snapshot.backendAppBaseUrl}`,
    `- session: ${snapshot.sessionKey}`,
    `- installId: ${snapshot.installId || "-"}`,
    `- deviceId: ${snapshot.deviceId || "-"}`,
    `- pollIntervalMs: ${snapshot.pollIntervalMs}`,
    `- accessToken: ${snapshot.accessTokenConfigured ? "configured" : "missing"}`,
    `- authorizationStatus: ${snapshot.authorizationStatus || "-"}`,
    `- authSessionId: ${snapshot.authSessionId || "-"}`,
    `- authorizationUrl: ${snapshot.authorizationUrl || "-"}`,
    `- authorizedUser: ${snapshot.authorizedDisplayName || snapshot.authorizedUserOneId || "-"}`,
    `- lastAuthorizedAt: ${snapshot.lastAuthorizedAt || "-"}`,
    `- lastPollAt: ${snapshot.lastPollAt || "-"}`,
    `- lastSuccessAt: ${snapshot.lastSuccessAt || "-"}`,
    `- lastTaskAt: ${snapshot.lastTaskAt || "-"}`,
    `- lastTaskId: ${snapshot.lastTaskId || "-"}`,
    `- lastError: ${snapshot.lastError || "-"}`,
  ].join("\n");
}

function formatSetupUsage(): string {
  return [
    "用法：",
    "/chek-setup [backend=https://api-dev.chekkk.com/api/backend-app] [session=agent:main:chek:mentions] [interval=5000]",
    "",
    "默认会自动拉起浏览器做 CHEK 授权；如果浏览器授权失败，再退回：",
    "/chek-setup token=<CHEK_ACCESS_TOKEN>",
    "",
    "也可以在 CLI 里执行：",
    "openclaw chek setup",
    "openclaw chek setup --token <CHEK_ACCESS_TOKEN>",
  ].join("\n");
}

function summarizeSavedConfig(config: MemorUploadConfig): string {
  return [
    "MEMOR Upload 已保存。",
    `- backend: ${config.backendAppBaseUrl}`,
    `- session: ${config.sessionKey}`,
    `- installId: ${config.installId || "-"}`,
    `- deviceId: ${config.deviceId || "-"}`,
    `- interval: ${config.pollIntervalMs}ms`,
    `- token: ${maskToken(resolveAccessToken(config))}`,
    `- auth: ${config.authorizationStatus || "-"}`,
  ].join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withStableIdentity(config: MemorUploadConfig): Partial<MemorUploadConfig> {
  const installId = config.installId.trim() || randomUUID();
  const hostname = sanitizeToken(os.hostname()) || "openclaw-device";
  const deviceId = config.deviceId.trim() || `${hostname}-${randomUUID().slice(0, 8)}`;
  return { installId, deviceId };
}

function openViaCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function openBrowser(url: string): Promise<void> {
  const target = String(url || "").trim();
  if (!target) {
    throw new Error("Browser authorization URL is empty.");
  }
  if (process.platform === "darwin") {
    await openViaCommand("open", [target]);
    return;
  }
  if (process.platform === "win32") {
    await openViaCommand("cmd", ["/c", "start", "", target]);
    return;
  }
  await openViaCommand("xdg-open", [target]);
}

async function ensureBaseSetup(
  controller: MemorUploadController,
  patch: Partial<MemorUploadConfig>,
): Promise<MemorUploadConfig> {
  const baseConfig = controller.getConfig();
  return await controller.persistConfigPatch({
    ...withStableIdentity(baseConfig),
    ...patch,
  });
}

async function waitForBrowserAuthorization(
  controller: MemorUploadController,
  timeoutMs = AUTHORIZATION_WAIT_TIMEOUT_MS,
): Promise<BrowserAuthSession | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const session = await controller.syncAuthorizationSession();
    const sessionStatus = String(session?.authorizationStatus || session?.status || "").trim();
    if (String(session?.pluginAccessToken || "").trim()) {
      return session;
    }
    if (sessionStatus === "expired" || sessionStatus === "cancelled") {
      return session;
    }
    const delayMs = Math.max(
      1_500,
      Number(session?.pollIntervalMs || controller.getConfig().pollIntervalMs || 5_000),
    );
    await sleep(delayMs);
  }
  return null;
}

async function beginBrowserSetup(controller: MemorUploadController): Promise<string> {
  const currentConfig = controller.getConfig();
  const api = new ChekApiClient({
    baseUrl: currentConfig.backendAppBaseUrl,
  });
  const session = await api.createBrowserAuthSession({
    installId: currentConfig.installId,
    deviceId: currentConfig.deviceId,
    sessionKey: currentConfig.sessionKey,
    metadata: {
      source: "memor-upload",
      setupMode: "browser_auth",
    },
  });
  const authorizationUrl = String(session.authorizationUrl || "").trim();
  const savedConfig = await controller.persistConfigPatch({
    authSessionId: session.id,
    deviceCode: String(session.deviceCode || "").trim(),
    authorizationStatus: String(session.authorizationStatus || session.status || "pending").trim(),
    authorizationUrl,
    authorizedUserOneId: "",
    authorizedDisplayName: "",
    lastAuthorizedAt: "",
    accessToken: "",
  });

  let browserMessage = `- browser: ${authorizationUrl || "authorization URL missing"}`;
  if (authorizationUrl) {
    try {
      await openBrowser(authorizationUrl);
      browserMessage = `- browser: opened ${authorizationUrl}`;
    } catch (error) {
      browserMessage = `- browser: failed to auto-open (${error instanceof Error ? error.message : String(error)})\n- open this URL manually: ${authorizationUrl}`;
    }
  }

  const authorizedSession = await waitForBrowserAuthorization(controller);
  const authStatus = String(
    authorizedSession?.authorizationStatus || authorizedSession?.status || savedConfig.authorizationStatus || "",
  ).trim();
  if (String(authorizedSession?.pluginAccessToken || "").trim()) {
    const health = await controller.runHealthCheck();
    return [
      summarizeSavedConfig(controller.getConfig()),
      browserMessage,
      `- authorization: ok (${authorizedSession?.authorizedDisplayName || authorizedSession?.authorizedUserOneId || "authorized"})`,
      `- health: backend ${health.backend}, gateway ${health.gateway}`,
    ].join("\n");
  }

  return [
    summarizeSavedConfig(controller.getConfig()),
    browserMessage,
    `- authorization: ${authStatus || "pending"}`,
    "- next: keep the browser page open until it shows “已授权，可返回 OpenClaw”，然后再执行 /chek-status 查看是否 ready",
  ].join("\n");
}

async function runSetup(
  controller: MemorUploadController,
  patch: Partial<MemorUploadConfig>,
  opts: { browserAuth: boolean },
): Promise<string> {
  const savedConfig = await ensureBaseSetup(controller, patch);
  if (!savedConfig.enabled) {
    return `${summarizeSavedConfig(savedConfig)}\n- health: disabled`;
  }
  if (!opts.browserAuth) {
    try {
      const health = await controller.runHealthCheck();
      return `${summarizeSavedConfig(savedConfig)}\n- health: backend ${health.backend}, gateway ${health.gateway}`;
    } catch (error) {
      return `${summarizeSavedConfig(savedConfig)}\n- health: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  if (resolveAccessToken(savedConfig)) {
    try {
      const health = await controller.runHealthCheck();
      return `${summarizeSavedConfig(savedConfig)}\n- health: backend ${health.backend}, gateway ${health.gateway}`;
    } catch (error) {
      return `${summarizeSavedConfig(savedConfig)}\n- health: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return await beginBrowserSetup(controller);
}

export function registerMemorUploadCommands(
  api: OpenClawPluginApi,
  controller: MemorUploadController,
): void {
  api.registerCommand({
    name: "chek-setup",
    description: "Configure MEMOR Upload for CHEK mention-task polling.",
    acceptsArgs: true,
    handler: async (ctx) => {
      const rawArgs = ctx.args?.trim() ?? "";
      if (rawArgs === "help" || rawArgs === "--help") {
        return {
          text: `${formatSetupUsage()}\n\n${formatStatus(controller)}`,
        };
      }
      const parsed = parseSetupArgs(rawArgs);
      const patch: Partial<MemorUploadConfig> = {};
      if (parsed.token !== undefined) patch.accessToken = parsed.token;
      if (parsed.backend !== undefined) patch.backendAppBaseUrl = parsed.backend;
      if (parsed.session !== undefined) patch.sessionKey = parsed.session;
      if (parsed.interval !== undefined) patch.pollIntervalMs = parsed.interval;
      if (parsed.enable !== undefined) patch.enabled = parsed.enable;
      if (parsed.token !== undefined) {
        patch.authorizationStatus = "token_fallback";
      }

      const shouldStartBrowserAuth =
        parsed.token === undefined && (rawArgs.length === 0 || Object.keys(patch).length > 0);
      const text = await runSetup(controller, patch, {
        browserAuth: shouldStartBrowserAuth,
      });
      return {
        text,
      };
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

export function registerMemorUploadCli(
  program: Command,
  api: OpenClawPluginApi,
  controller: MemorUploadController,
): void {
  void api;
  const chek = program.command("chek").description("MEMOR Upload helpers for CHEK");

  chek
    .command("setup")
    .description("Persist MEMOR Upload config into OpenClaw")
    .option("--token <token>", "CHEK access token fallback")
    .option("--backend <url>", "CHEK backend-app base URL")
    .option("--session <key>", "Stable local OpenClaw session key")
    .option("--interval <ms>", "Poll interval in milliseconds")
    .option("--disable", "Disable the bridge after saving", false)
    .action(async (options) => {
      const patch: Partial<MemorUploadConfig> = {};
      if (options.token) {
        patch.accessToken = String(options.token).trim();
        patch.authorizationStatus = "token_fallback";
      }
      if (options.backend) patch.backendAppBaseUrl = String(options.backend).trim();
      if (options.session) patch.sessionKey = String(options.session).trim();
      if (options.interval !== undefined) patch.pollIntervalMs = Number(options.interval);
      if (options.disable) patch.enabled = false;

      const output = await runSetup(controller, patch, {
        browserAuth: !options.token,
      });
      console.log(output);
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
