import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveGatewayInvocation } from "./gateway-cli.js";

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
