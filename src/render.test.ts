import { describe, expect, it } from "vitest";

import {
  buildBootstrapMessage,
  buildFallbackReply,
  buildTaskInjectionText,
  extractChatReplyText,
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
    expect(buildBootstrapMessage()).toContain("openclaw plugins install @chek/memor-upload");
  });
});
