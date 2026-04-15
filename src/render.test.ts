import { describe, expect, it } from "vitest";

import {
  buildBootstrapMessage,
  buildFallbackReply,
  buildTaskInjectionText,
  extractChatReplyText,
  sanitizeModelReplyText,
} from "./render.js";

describe("render helpers", () => {
  it("extracts chat reply text", () => {
    expect(
      extractChatReplyText({
        status: "ok",
        result: {
          payloads: [{ text: "第一句" }, { text: "第二句" }],
        },
      }),
    ).toBe("第一句\n第二句");
  });

  it("sanitizes reply markers from model text", () => {
    expect(
      sanitizeModelReplyText(
        "收到，我这就看看。 [[reply_to: memor-upload-e2e-123]]",
      ),
    ).toBe("收到，我这就看看。");
    expect(sanitizeModelReplyText("我先看下哈。[[reply_to_current]]")).toBe("我先看下哈。");
  });

  it("builds injection text and fallback reply", () => {
    const task = {
      id: "task-1",
      status: "pending",
      payload: {
        postTitle: "动作模型房间",
        mentionedByDisplayName: "大鼻子",
        messageContent: "@你 看下这个动作模型",
      },
      result: {},
    };
    expect(buildTaskInjectionText(task as never)).toContain("动作模型房间");
    expect(buildFallbackReply(task as never)).toContain("模型");
  });

  it("builds bootstrap text", () => {
    const message = buildBootstrapMessage();
    expect(message).toContain(
      "openclaw plugins install https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1",
    );
    expect(message).toContain("目标：");
    expect(message).toContain("执行要求：");
    expect(message).toContain("/chek-setup");
    expect(message).toContain("已授权，可返回 OpenClaw");
    expect(message).toContain("CHEK_ACCESS_TOKEN");
  });
});
