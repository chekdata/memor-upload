import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractGatewayJsonPayload,
  extractReplyFromTranscriptEntries,
  resolveGatewayInvocation,
  resolveTranscriptFile,
} from "./gateway-cli.js";

function makeTempFile(name: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "memor-upload-gateway-cli-"));
  const file = path.join(dir, name);
  writeFileSync(file, "#!/usr/bin/env node\n", "utf-8");
  return file;
}

describe("resolveGatewayInvocation", () => {
  it("prefers OPENCLAW_CLI_ENTRY when provided", () => {
    const cliEntry = makeTempFile("openclaw-env.mjs");
    const target = resolveGatewayInvocation({
      cliEntryEnv: cliEntry,
      argv: ["node", "/tmp/ignored.mjs"],
      resolveModule: () => {
        throw new Error("should not resolve module");
      },
    });

    expect(target).toEqual({
      command: process.execPath,
      argsPrefix: [cliEntry],
    });
  });

  it("uses module resolution when available", () => {
    const cliEntry = makeTempFile("openclaw-module.mjs");
    const target = resolveGatewayInvocation({
      cliEntryEnv: "",
      argv: ["node", "/tmp/ignored.mjs"],
      resolveModule: () => cliEntry,
    });

    expect(target).toEqual({
      command: process.execPath,
      argsPrefix: [cliEntry],
    });
  });

  it("falls back to argv[1] when the module cannot be resolved", () => {
    const argvEntry = makeTempFile("openclaw-argv.mjs");
    const target = resolveGatewayInvocation({
      cliEntryEnv: "",
      argv: ["node", argvEntry],
      resolveModule: () => {
        throw new Error("module missing");
      },
    });

    expect(target).toEqual({
      command: process.execPath,
      argsPrefix: [argvEntry],
    });
  });

  it("falls back to the openclaw binary name when no file path is available", () => {
    const target = resolveGatewayInvocation({
      cliEntryEnv: "",
      argv: ["node", ""],
      resolveModule: () => {
        throw new Error("module missing");
      },
      openclawBin: "openclaw",
    });

    expect(target).toEqual({
      command: "openclaw",
      argsPrefix: [],
    });
  });
});

describe("gateway cli transcript helpers", () => {
  it("extracts the trailing JSON payload after noisy plugin logs", () => {
    const stdout = [
      "[plugins] feishu_doc: Registered feishu_doc",
      "[plugins] feishu_wiki: Registered feishu_wiki tool",
      '{ "ok": true, "status": "started" }',
    ].join("\n");

    expect(extractGatewayJsonPayload(stdout)).toBe('{ "ok": true, "status": "started" }');
  });

  it("resolves the transcript file from a session patch result", () => {
    expect(
      resolveTranscriptFile({
        path: "/tmp/openclaw/sessions.json",
        entry: {
          sessionId: "session-1",
        },
      }),
    ).toBe(path.join("/tmp/openclaw", "session-1.jsonl"));
  });

  it("extracts the model reply tied to the prompt message id", () => {
    const entries = [
      {
        type: "message",
        id: "inject-1",
        message: {
          role: "assistant",
          stopReason: "injected",
          content: [{ type: "text", text: "[CHEK @]\n\n你在房间里被 @ 了。" }],
        },
      },
      {
        type: "message",
        id: "prompt-1",
        parentId: "inject-1",
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: "请回复一下\n[message_id: memor-upload-abc]",
            },
          ],
        },
      },
      {
        type: "message",
        id: "reply-1",
        parentId: "prompt-1",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "收到，我这就看看。 [[reply_to: memor-upload-abc]]",
            },
          ],
        },
      },
      {
        type: "message",
        id: "note-1",
        message: {
          role: "assistant",
          stopReason: "injected",
          content: [{ type: "text", text: "[CHEK 已发送]" }],
        },
      },
    ];

    expect(extractReplyFromTranscriptEntries(entries as never, "memor-upload-abc")).toBe(
      "收到，我这就看看。",
    );
  });
});
