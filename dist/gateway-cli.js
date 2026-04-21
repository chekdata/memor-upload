import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { sanitizeModelReplyText } from "./render.js";
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const gatewayTimeoutMs = 45_000;
const DEFAULT_CHAT_SESSION_LABEL = "CHEK Mentions";
let cachedInvocation = null;
function isUsableCliPath(candidate) {
    return Boolean(candidate && existsSync(candidate));
}
export function resolveGatewayInvocation(options = {}) {
    const cliEntryEnv = String(options.cliEntryEnv ?? process.env.OPENCLAW_CLI_ENTRY ?? "").trim();
    if (isUsableCliPath(cliEntryEnv)) {
        return {
            command: process.execPath,
            argsPrefix: [cliEntryEnv],
        };
    }
    const resolveModule = options.resolveModule === undefined
        ? () => require.resolve("openclaw/cli-entry")
        : options.resolveModule;
    if (resolveModule) {
        try {
            const resolved = String(resolveModule() || "").trim();
            if (isUsableCliPath(resolved)) {
                return {
                    command: process.execPath,
                    argsPrefix: [resolved],
                };
            }
        }
        catch {
            // Fall through to argv/PATH-based resolution for archive installs.
        }
    }
    const argv = options.argv ?? process.argv;
    const argvEntry = String(argv[1] || "").trim();
    if (isUsableCliPath(argvEntry)) {
        return {
            command: process.execPath,
            argsPrefix: [argvEntry],
        };
    }
    return {
        command: String(options.openclawBin || process.env.OPENCLAW_BIN || "openclaw").trim()
            || "openclaw",
        argsPrefix: [],
    };
}
function getGatewayInvocation() {
    if (!cachedInvocation) {
        cachedInvocation = resolveGatewayInvocation();
    }
    return cachedInvocation;
}
export function extractGatewayJsonPayload(stdout) {
    const trimmed = stdout.trim();
    if (!trimmed) {
        return "";
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            JSON.parse(trimmed);
            return trimmed;
        }
        catch {
            // Keep scanning for a valid JSON suffix when stdout starts with log lines like "[plugins] ...".
        }
    }
    const lines = trimmed.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const candidate = lines.slice(index).join("\n").trim();
        if (!candidate || (!candidate.startsWith("{") && !candidate.startsWith("["))) {
            continue;
        }
        try {
            JSON.parse(candidate);
            return candidate;
        }
        catch {
            // Keep looking for a valid JSON suffix.
        }
    }
    return trimmed;
}
async function parseJsonOutput(stdout, stderr) {
    const payloadText = extractGatewayJsonPayload(stdout);
    if (!payloadText) {
        throw new Error(`Gateway call returned empty stdout.\nstderr: ${stderr.trim()}`);
    }
    try {
        return JSON.parse(payloadText);
    }
    catch (error) {
        throw new Error(`Failed to parse gateway JSON response: ${String(error)}\nstdout: ${stdout.trim()}\nstderr: ${stderr.trim()}`);
    }
}
export async function gatewayCall(method, params, options = {}) {
    const invocation = getGatewayInvocation();
    const args = [
        ...invocation.argsPrefix,
        "gateway",
        "call",
        method,
        "--json",
        "--timeout",
        String(gatewayTimeoutMs),
    ];
    if (options.expectFinal) {
        args.push("--expect-final");
    }
    args.push("--params", JSON.stringify(params));
    const result = await execFileAsync(invocation.command, args, {
        maxBuffer: 8 * 1024 * 1024,
    });
    return (await parseJsonOutput(result.stdout, result.stderr));
}
async function ensureTranscriptFile(result) {
    const sessionId = result.entry?.sessionId?.trim();
    const sessionFile = resolveTranscriptFile(result);
    if (!sessionFile) {
        return;
    }
    try {
        await fs.access(sessionFile);
    }
    catch {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true });
        const header = {
            type: "session",
            version: 3,
            id: sessionId || path.basename(sessionFile, ".jsonl"),
            timestamp: new Date().toISOString(),
            cwd: process.cwd(),
        };
        await fs.writeFile(sessionFile, `${JSON.stringify(header)}\n`, "utf-8");
    }
}
export function resolveTranscriptFile(result) {
    const sessionId = result.entry?.sessionId?.trim();
    return (result.entry?.sessionFile?.trim()
        || (sessionId && result.path?.trim()
            ? path.join(path.dirname(result.path.trim()), `${sessionId}.jsonl`)
            : "")).trim();
}
function extractTranscriptText(entry) {
    const parts = Array.isArray(entry?.message?.content) ? entry.message.content : [];
    return sanitizeModelReplyText(parts
        .map((item) => (item && typeof item.text === "string" ? item.text : ""))
        .filter(Boolean)
        .join("\n"));
}
export function extractReplyFromTranscriptEntries(entries, messageId) {
    const marker = `[message_id: ${messageId}]`;
    let promptIndex = -1;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (entry?.type === "message"
            && entry.message?.role === "user"
            && extractTranscriptText(entry).includes(marker)
            && typeof entry.id === "string"
            && entry.id.trim().length > 0) {
            promptIndex = index;
            break;
        }
    }
    if (promptIndex < 0) {
        return "";
    }
    const promptId = String(entries[promptIndex]?.id || "").trim();
    if (!promptId) {
        return "";
    }
    const parentMap = new Map();
    for (const entry of entries) {
        const id = String(entry?.id || "").trim();
        const parentId = String(entry?.parentId || "").trim();
        if (id && parentId) {
            parentMap.set(id, parentId);
        }
    }
    const isDescendantOfPrompt = (entry) => {
        let cursor = String(entry.parentId || "").trim();
        let depth = 0;
        while (cursor && depth < 32) {
            if (cursor === promptId) {
                return true;
            }
            cursor = parentMap.get(cursor) || "";
            depth += 1;
        }
        return false;
    };
    for (let index = entries.length - 1; index > promptIndex; index -= 1) {
        const entry = entries[index];
        if (entry?.type !== "message") {
            continue;
        }
        if (entry.message?.role !== "assistant") {
            continue;
        }
        if (entry.message?.stopReason === "injected") {
            continue;
        }
        if (!isDescendantOfPrompt(entry)) {
            continue;
        }
        const text = extractTranscriptText(entry);
        if (text) {
            return text;
        }
    }
    return "";
}
async function waitForTranscriptReply(session, messageId, timeoutMs = gatewayTimeoutMs) {
    const sessionFile = resolveTranscriptFile(session);
    if (!sessionFile) {
        throw new Error("Session transcript file could not be resolved.");
    }
    const startedAt = Date.now();
    while (Date.now() - startedAt <= timeoutMs) {
        try {
            const raw = await fs.readFile(sessionFile, "utf-8");
            const entries = raw
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            })
                .filter((entry) => Boolean(entry));
            const reply = extractReplyFromTranscriptEntries(entries, messageId);
            if (reply) {
                return reply;
            }
        }
        catch (error) {
            if (!(error instanceof Error) || !/ENOENT/i.test(error.message)) {
                throw error;
            }
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 400);
        });
    }
    throw new Error("OpenClaw reply did not appear in the session transcript before timeout.");
}
export async function ensureSession(sessionKey, label) {
    const result = await gatewayCall("sessions.patch", {
        key: sessionKey,
        label,
    });
    await ensureTranscriptFile(result);
    return result;
}
export async function injectSessionNote(sessionKey, message, label) {
    await gatewayCall("chat.inject", {
        sessionKey,
        message,
        label,
    });
}
export async function sendChatPrompt(sessionKey, message, options = {}) {
    const idempotencyKey = `memor-upload-${randomUUID()}`;
    const sessionLabel = String(options.sessionLabel || "").trim() || DEFAULT_CHAT_SESSION_LABEL;
    const session = await ensureSession(sessionKey, sessionLabel);
    const started = await gatewayCall("chat.send", {
        sessionKey,
        message,
        deliver: false,
        timeoutMs: gatewayTimeoutMs,
        idempotencyKey,
    });
    const reply = await waitForTranscriptReply(session, idempotencyKey, gatewayTimeoutMs);
    return {
        runId: started.runId,
        status: "ok",
        result: {
            payloads: [{ text: reply }],
        },
    };
}
