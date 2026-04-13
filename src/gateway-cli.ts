import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import type { ChatFinalPayload, SessionPatchResult } from "./types.js";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const gatewayTimeoutMs = 45_000;

let cachedCliEntry: string | null = null;

function resolveCliEntry(): string {
  if (cachedCliEntry) {
    return cachedCliEntry;
  }
  cachedCliEntry = require.resolve("openclaw/cli-entry");
  return cachedCliEntry;
}

async function parseJsonOutput(stdout: string, stderr: string): Promise<unknown> {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`Gateway call returned empty stdout.\nstderr: ${stderr.trim()}`);
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse gateway JSON response: ${String(error)}\nstdout: ${trimmed}\nstderr: ${stderr.trim()}`,
    );
  }
}

export async function gatewayCall<T>(
  method: string,
  params: Record<string, unknown>,
  options: { expectFinal?: boolean } = {},
): Promise<T> {
  const args = [resolveCliEntry(), "gateway", "call", method, "--json", "--timeout", String(gatewayTimeoutMs)];
  if (options.expectFinal) {
    args.push("--expect-final");
  }
  args.push("--params", JSON.stringify(params));
  const result = await execFileAsync(process.execPath, args, {
    maxBuffer: 8 * 1024 * 1024,
  });
  return (await parseJsonOutput(result.stdout, result.stderr)) as T;
}

async function ensureTranscriptFile(result: SessionPatchResult): Promise<void> {
  const sessionFile = result.entry?.sessionFile?.trim();
  if (!sessionFile) {
    return;
  }
  try {
    await fs.access(sessionFile);
  } catch {
    await fs.mkdir(path.dirname(sessionFile), { recursive: true });
    await fs.writeFile(sessionFile, "", "utf-8");
  }
}

export async function ensureSession(sessionKey: string, label: string): Promise<SessionPatchResult> {
  const result = await gatewayCall<SessionPatchResult>("sessions.patch", {
    key: sessionKey,
    label,
  });
  await ensureTranscriptFile(result);
  return result;
}

export async function injectSessionNote(
  sessionKey: string,
  message: string,
  label: string,
): Promise<void> {
  await gatewayCall("chat.inject", {
    sessionKey,
    message,
    label,
  });
}

export async function sendChatPrompt(sessionKey: string, message: string): Promise<ChatFinalPayload> {
  const idempotencyKey = `memor-upload-${randomUUID()}`;
  return await gatewayCall<ChatFinalPayload>(
    "chat.send",
    {
      sessionKey,
      message,
      deliver: false,
      timeoutMs: gatewayTimeoutMs,
      idempotencyKey,
    },
    { expectFinal: true },
  );
}
