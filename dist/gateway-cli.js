import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const gatewayTimeoutMs = 45_000;
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
async function parseJsonOutput(stdout, stderr) {
    const trimmed = stdout.trim();
    if (!trimmed) {
        throw new Error(`Gateway call returned empty stdout.\nstderr: ${stderr.trim()}`);
    }
    try {
        return JSON.parse(trimmed);
    }
    catch (error) {
        throw new Error(`Failed to parse gateway JSON response: ${String(error)}\nstdout: ${trimmed}\nstderr: ${stderr.trim()}`);
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
    const sessionFile = result.entry?.sessionFile?.trim();
    if (!sessionFile) {
        return;
    }
    try {
        await fs.access(sessionFile);
    }
    catch {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true });
        await fs.writeFile(sessionFile, "", "utf-8");
    }
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
export async function sendChatPrompt(sessionKey, message) {
    const idempotencyKey = `memor-upload-${randomUUID()}`;
    return await gatewayCall("chat.send", {
        sessionKey,
        message,
        deliver: false,
        timeoutMs: gatewayTimeoutMs,
        idempotencyKey,
    }, { expectFinal: true });
}
