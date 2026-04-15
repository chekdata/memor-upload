import { describe, expect, it } from "vitest";

import {
  buildBootstrapMessage,
  buildReplyStrategy,
  buildRoomSessionKey,
  buildAutoReplyPrompt,
  buildFallbackReply,
  buildTaskInjectionText,
  extractChatReplyText,
  selectRoomMessagesForContext,
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
    expect(buildFallbackReply(task as never)).toBe(
      "看到了。你可以直接补一句最想让我判断的点，我就按这条继续给你建议。",
    );
  });

  it("builds room-scoped session keys", () => {
    expect(buildRoomSessionKey("agent:main:chek:mentions", "POST-1 Demo")).toBe(
      "agent:main:chek:mentions:room:post-1-demo",
    );
  });

  it("builds direct reply strategies for common intents", () => {
    const postingTask = {
      id: "task-posting",
      status: "pending",
      payload: {
        postTitle: "动作模型求购",
        messageContent: "@你 求购类似模型，房间里该怎么发更好？",
      },
      result: {},
    };
    const downloadTask = {
      id: "task-download",
      status: "pending",
      payload: {
        postTitle: "下载问题",
        messageContent: "@你 点下载模型没反应，怎么排查？",
      },
      result: {},
    };
    const saleTask = {
      id: "task-sale",
      status: "pending",
      payload: {
        postTitle: "动作模型交易",
        messageContent: "@你 如果我想把这个模型开源共享/出售，文案怎么写更清楚？",
      },
      result: {},
    };
    const introTask = {
      id: "task-intro",
      status: "pending",
      payload: {
        postTitle: "G1 动作策略",
        messageContent: "@你 如果是 G1 的现成动作策略，你建议怎么介绍？",
      },
      result: {},
    };

    expect(buildReplyStrategy(postingTask as never).intent).toBe("posting_copy");
    expect(buildReplyStrategy(postingTask as never).directReply).toContain("可以直接发：");
    expect(buildReplyStrategy(downloadTask as never).intent).toBe("download_troubleshoot");
    expect(buildReplyStrategy(downloadTask as never).directReply).toContain("下载或分享面板");
    expect(buildReplyStrategy(saleTask as never).directReply).toContain("支持开源共享，也接受商业授权/成品出售");
    expect(buildReplyStrategy(introTask as never).directReply).toContain("这是G1 动作模型");
  });

  it("injects recent room context and honesty rules into the prompt", () => {
    const task = {
      id: "task-ctx",
      status: "pending",
      messageId: "msg-current",
      payload: {
        postTitle: "G1 动作模型",
        mentionedByDisplayName: "Jason",
        messageId: "msg-current",
        messageContent: "@你 这个适合直接上架吗？",
      },
      result: {},
    };
    const roomMessages = [
      {
        id: "m1",
        kind: "text",
        displayName: "A",
        content: "我这边已经有一段 demo 视频",
      },
      {
        id: "m2",
        kind: "text",
        displayName: "B",
        content: "还差安装说明和适配机型清单",
      },
    ];

    const prompt = buildAutoReplyPrompt(task as never, roomMessages as never);

    expect(prompt).toContain("不要说“我先看看 / 稍后回复 / 我来查一下 / 我这就处理”");
    expect(prompt).toContain("不要假装已经做过");
    expect(prompt).toContain("还差安装说明和适配机型清单");
    expect(prompt).toContain("当前答题策略：对方在问 G1 动作模型 能不能直接上架");
  });

  it("appends the current message into room context when missing", () => {
    const task = {
      id: "task-current",
      status: "pending",
      messageId: "msg-current",
      payload: {
        messageId: "msg-current",
        mentionedByDisplayName: "当前用户",
        messageContent: "@你 帮我看看这个动作模型",
      },
      result: {},
    };

    const context = selectRoomMessagesForContext(task as never, []);

    expect(context).toHaveLength(1);
    expect(context[0]?.id).toBe("msg-current");
    expect(context[0]?.displayName).toBe("当前用户");
  });

  it("cuts off future room messages after the current mention", () => {
    const task = {
      id: "task-cutoff",
      status: "pending",
      messageId: "m-current",
      payload: {
        messageId: "m-current",
        mentionedByDisplayName: "当前用户",
        messageContent: "@你 这个要不要更极简？",
      },
      result: {},
    };
    const context = selectRoomMessagesForContext(
      task as never,
      [
        { id: "m-1", content: "前一条", displayName: "A" },
        { id: "m-current", content: "@你 这个要不要更极简？", displayName: "当前用户" },
        { id: "m-future", content: "后一条未来消息", displayName: "B" },
      ] as never,
    );

    expect(context.map((item) => item.id)).toEqual(["m-1", "m-current"]);
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
