import type { ChatFinalPayload, MentionTask } from "./types.js";

export const CURRENT_INSTALL_SPEC =
  "https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1";

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function sanitizeModelReplyText(value: string): string {
  return String(value || "")
    .replace(/\s*\[\[reply_to[^\]]*\]\]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    .map((item) => (item && typeof item.text === "string" ? sanitizeModelReplyText(item.text) : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function buildBootstrapMessage(): string {
  return [
    "请在这台机器上安装并配置 CHEK 房间助手插件，并尽量自动完成初始化。",
    "",
    "目标：",
    "1. 安装 OpenClaw 插件 MEMOR Upload",
    "2. 安装后重启 Gateway",
    "3. 自动拉起浏览器完成 CHEK 授权与设备绑定",
    "4. 做一次连通性测试",
    "5. 最后告诉我当前状态是否 ready",
    "",
    "安装命令：",
    `openclaw plugins install ${CURRENT_INSTALL_SPEC}`,
    "",
    "如果插件安装成功但不能自动继续，请立即执行 `/chek-setup`。插件会自动打开浏览器到 CHEK 授权页；浏览器显示“已授权，可返回 OpenClaw”后，回到本地继续等待健康检查完成。",
    "如果浏览器授权失败，再退回 `/chek-setup token=<CHEK_ACCESS_TOKEN>` 或 `openclaw chek setup --token <CHEK_ACCESS_TOKEN>`。",
    "",
    "参考链接：",
    "- 插件说明：https://github.com/chekdata/memor-upload#readme",
    "- setup skill：https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md",
    "- 浏览器授权说明：https://github.com/chekdata/memor-upload/blob/main/docs/device-code-auth.md",
    "- 排障说明：https://github.com/chekdata/memor-upload/blob/main/docs/troubleshooting.md",
    "",
    "执行要求：",
    "- 如果可以直接执行宿主机命令，就直接完成",
    "- 如果某一步需要我人工确认，只在那一步向我索取最小必要信息",
    "- 如果无法执行，不要假装成功；请明确说明失败原因、卡住步骤，以及下一条我应该发你的消息",
  ].join("\n");
}
