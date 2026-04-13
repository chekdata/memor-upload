import type { ChatFinalPayload, MentionTask } from "./types.js";

export const CURRENT_INSTALL_SPEC =
  "https://github.com/chekdata/memor-upload/releases/download/v0.1.0/chek-memor-upload-0.1.0.tgz?download=1";

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function buildTaskInjectionText(task: MentionTask): string {
  const payload = task.payload || {};
  const roomTitle = payload.postTitle || task.postId || "未命名房间";
  const sender = payload.mentionedByDisplayName || payload.mentionedByUserOneId || "房间成员";
  const content = compact(String(payload.messageContent || ""), 300) || "无正文";
  return [
    `你在 CHEK 搭子房间里被 @ 了。`,
    `房间：${roomTitle}`,
    `发起人：${sender}`,
    `原消息：${content}`,
    "插件会自动生成一条简短回复并回房间；如果失败，会把失败原因留在这里。",
  ].join("\n");
}

export function buildAutoReplyPrompt(task: MentionTask): string {
  const payload = task.payload || {};
  const roomTitle = payload.postTitle || task.postId || "未命名房间";
  const sender = payload.mentionedByDisplayName || payload.mentionedByUserOneId || "房间成员";
  const content = compact(String(payload.messageContent || ""), 300) || "无正文";
  return [
    "你正在替本机用户回复 CHEK 搭子房间里的一条 @ 提醒。",
    "请生成一条自然、口语化、简短的中文回复。",
    "要求：",
    "- 直接输出最终要发到房间里的正文",
    "- 不要加引号、标题、解释、前缀或 Markdown",
    "- 尽量控制在 1 到 2 句，总长度不超过 60 个汉字",
    "- 如果信息不足，就先礼貌确认已看到，并说明会稍后查看",
    "",
    `房间：${roomTitle}`,
    `对方：${sender}`,
    `原消息：${content}`,
  ].join("\n");
}

export function buildFallbackReply(task: MentionTask): string {
  const payload = task.payload || {};
  const content = String(payload.messageContent || "");
  if (content.includes("模型")) {
    return "收到，我先看下这个模型，稍后给你具体反馈。";
  }
  if (content.includes("动作")) {
    return "收到，我先看下这条动作内容，稍后回你。";
  }
  return "收到，我先看一下，稍后给你回复。";
}

export function extractChatReplyText(payload: ChatFinalPayload): string {
  const result = payload?.result;
  const messages = Array.isArray(result?.payloads) ? result.payloads : [];
  return messages
    .map((item) => (item && typeof item.text === "string" ? item.text.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function buildBootstrapMessage(): string {
  return [
    "download & read https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md",
    `openclaw plugins install ${CURRENT_INSTALL_SPEC}`,
    "/chek-setup",
  ].join("\n");
}
