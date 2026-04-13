import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const gatewayTimeoutMs = 45_000;
let cachedCliEntry = null;
function resolveCliEntry() {
    if (cachedCliEntry) {
        return cachedCliEntry;
    }
    cachedCliEntry = require.resolve("openclaw/cli-entry");
    return cachedCliEntry;
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
    const args = [resolveCliEntry(), "gateway", "call", method, "--json", "--timeout", String(gatewayTimeoutMs)];
    if (options.expectFinal) {
        args.push("--expect-final");
    }
    args.push("--params", JSON.stringify(params));
    const result = await execFileAsync(process.execPath, args, {
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
