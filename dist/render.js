export const CURRENT_INSTALL_SPEC = "https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1";
const MAX_CONTEXT_MESSAGES = 6;
function compact(value, maxLength) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 1).trim()}…`;
}
export function sanitizeModelReplyText(value) {
    return String(value || "")
        .replace(/\s*\[\[reply_to[^\]]*\]\]\s*/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeText(value, maxLength) {
    return compact(String(value || ""), maxLength);
}
function roomTitleOf(task) {
    return task.payload.postTitle || task.postId || "未命名房间";
}
function senderOf(task) {
    return task.payload.mentionedByDisplayName || task.payload.mentionedByUserOneId || "房间成员";
}
function messageContentOf(task) {
    return normalizeText(task.payload.messageContent || "", 300) || "无正文";
}
function sessionSegment(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 64);
}
function inferSubjectLabel(task, roomMessages) {
    const corpus = [
        task.payload.postTitle || "",
        task.payload.messageContent || "",
        ...roomMessages.map((item) => String(item.content || "")),
    ].join(" ");
    if (/jetson|orin/i.test(corpus)) {
        return "Orin 方案";
    }
    if (/rk3588/i.test(corpus)) {
        return "RK3588 方案";
    }
    if (/g1/i.test(corpus)) {
        return "G1 动作模型";
    }
    if (corpus.includes("武术")) {
        return "武术动作模型";
    }
    if (corpus.includes("舞蹈")) {
        return "舞蹈动作模型";
    }
    if (corpus.includes("动作模型")) {
        return "动作模型";
    }
    if (corpus.includes("模型")) {
        return "这个模型";
    }
    return "这个内容";
}
export function buildRoomSessionKey(baseSessionKey, postId) {
    const base = String(baseSessionKey || "").trim() || "agent:main:chek:mentions";
    const segment = sessionSegment(postId) || "room";
    return `${base}:room:${segment}`;
}
export function buildRoomSessionLabel(task) {
    const postId = String(task.payload.postId || task.postId || "").trim();
    const suffix = postId ? postId.slice(0, 8) : task.id.slice(0, 8);
    return `CHEK 房间 · ${compact(roomTitleOf(task), 18)} · ${suffix}`;
}
export function selectRoomMessagesForContext(task, roomMessages) {
    const normalized = [...roomMessages]
        .filter((item) => Boolean(String(item.content || "").trim()))
        .map((item) => ({
        ...item,
        content: normalizeText(String(item.content || ""), 120),
        displayName: normalizeText(String(item.displayName || item.userOneId || "房间成员"), 24),
    }));
    const currentMessageId = String(task.payload.messageId || task.messageId || "").trim();
    const currentMessageContent = normalizeText(task.payload.messageContent || "", 120);
    let cutoffIndex = -1;
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
        const item = normalized[index];
        if ((currentMessageId && String(item.id || "").trim() === currentMessageId)
            || (currentMessageContent && String(item.content || "").trim() === currentMessageContent)) {
            cutoffIndex = index;
            break;
        }
    }
    const bounded = cutoffIndex >= 0 ? normalized.slice(0, cutoffIndex + 1) : normalized;
    const currentMessageExists = bounded.some((item) => (currentMessageId && String(item.id || "").trim() === currentMessageId)
        || (currentMessageContent && String(item.content || "").trim() === currentMessageContent));
    if (currentMessageContent && !currentMessageExists) {
        bounded.push({
            id: currentMessageId || `current-${task.id}`,
            kind: "text",
            content: currentMessageContent,
            displayName: normalizeText(senderOf(task), 24),
            createdAt: task.createdAt || null,
            userOneId: task.payload.mentionedByUserOneId || null,
            avatarUrl: null,
        });
    }
    return bounded.slice(-MAX_CONTEXT_MESSAGES);
}
function formatRoomMessagesContext(roomMessages) {
    if (!roomMessages.length) {
        return "暂无可用的房间上下文，只根据当前这条 @ 消息回复。";
    }
    return roomMessages
        .map((item) => {
        const speaker = normalizeText(String(item.displayName || item.userOneId || "房间成员"), 20);
        const content = normalizeText(String(item.content || ""), 120);
        const kind = String(item.kind || "text").trim();
        return `- [${kind}] ${speaker}：${content}`;
    })
        .join("\n");
}
export function detectReplyIntent(task, roomMessages = []) {
    void roomMessages;
    const corpus = [task.payload.postTitle || "", task.payload.messageContent || ""]
        .join(" ")
        .toLowerCase();
    if (/怎么下载|下载.*(失败|没反应|没反馈|不了|不动)|点下载|下载模型|下载链接|网络问题|源不可用/.test(corpus)) {
        return "download_troubleshoot";
    }
    if (/适合.*上架|能.*上架|直接上架|值得上架|可不可以上架|适合出售|能卖吗/.test(corpus)) {
        return "listing_readiness";
    }
    if (/值不值得装|要不要装|值得装|值不值得买|要不要买|值得买吗/.test(corpus)) {
        return "value_judgement";
    }
    if (/更吸引人|更抓人|更有吸引力/.test(corpus)) {
        return "appeal_judgement";
    }
    if (/太乱|更极简|极简|简化|看不懂|第一步|会不会乱|太复杂|太花/.test(corpus)) {
        return "clarity_judgement";
    }
    if (/怎么发|怎么写|怎么说|文案|标题|发更好|怎么发布|求购.*怎么|怎么介绍|如何介绍|怎么讲|怎么描述/.test(corpus)) {
        return "posting_copy";
    }
    if (/开源共享|出售|求购|共享还是|卖还是|开源还是|出售还是|怎么选/.test(corpus)) {
        return "distribution_choice";
    }
    return "generic";
}
function buildDirectStrategyReply(intent, subject, task) {
    const content = String(task.payload.messageContent || "");
    switch (intent) {
        case "posting_copy":
            if (/怎么介绍|如何介绍|怎么讲|怎么描述/.test(content)) {
                return `可以直接发：这是${subject}，已附演示视频、适配机型和安装说明，拿来就能跑，感兴趣的来聊。`;
            }
            if (/开源共享|开源/.test(content) && /出售/.test(content)) {
                return `可以直接发：${subject}支持开源共享，也接受商业授权/成品出售，演示视频、适配机型和安装说明都已整理，感兴趣的来聊。`;
            }
            if (/开源共享|开源/.test(content)) {
                return `可以直接发：开源共享${subject}，附演示视频、适配机型和安装说明，欢迎交流复现和二次开发。`;
            }
            if (/出售|卖/.test(content)) {
                return `可以直接发：出售${subject}，已附演示视频、适配机型和安装说明，支持答疑，感兴趣的私聊我。`;
            }
            return `可以直接发：求购类似${subject}的现成方案，带演示视频、适配机型和安装说明的优先，感兴趣的私聊我。`;
        case "listing_readiness":
            return `如果${subject}已经有演示视频、适配机型和安装说明，就可以直接上架；这三样缺一项，建议先补齐再发。`;
        case "value_judgement":
            return `先看三点：效果稳不稳、适配机型清不清、安装成本高不高；这三点说不清，就先别急着装。`;
        case "appeal_judgement":
            return "如果想更吸引人，先把最抓眼的 demo、适配机型和交付方式放到最前面；武术版通常比泛动作版更抓眼，但前提是演示够稳。";
        case "clarity_judgement":
            return "如果第一眼看不出机型、动作类型和交付方式，就算太乱；先删解释，只保留标题、封面、核心卖点和操作按钮。";
        case "download_troubleshoot":
            return "先确认下载链接能打开、文件源可访问，再看客户端有没有弹出下载或分享面板；点了没反应通常是下载动作没接住。";
        case "distribution_choice":
            if (/求购/.test(content) && !/开源|出售/.test(content)) {
                return `如果你现在还没有现成${subject}，先发求购最合适；等模型稳定、文档齐了，再考虑开源共享或出售。`;
            }
            return "想先积累曝光和反馈，优先开源共享；模型稳定、文档齐、适配范围清楚后，再上出售。";
        default:
            return null;
    }
}
function buildStrategyGuidance(intent, subject) {
    switch (intent) {
        case "posting_copy":
            return {
                guidance: `对方在问发布文案或怎么发。直接给一版可复制的话术，围绕 ${subject}，不用先寒暄。`,
                summary: "直接给可复制文案",
            };
        case "listing_readiness":
            return {
                guidance: `对方在问 ${subject} 能不能直接上架。请给明确判断标准，最好是“能/先别急”加 1 个关键理由和 1 个下一步。`,
                summary: "直接给上架判断",
            };
        case "value_judgement":
            return {
                guidance: `对方在问 ${subject} 值不值得装或买。请直接给判断框架，优先说“先看哪三点”，不要空泛表态。`,
                summary: "直接给是否值得的判断框架",
            };
        case "appeal_judgement":
            return {
                guidance: "对方在问哪个版本更吸引人。请直接说优先展示什么、哪个版本更抓眼，以及前提条件。",
                summary: "直接给吸引力判断",
            };
        case "clarity_judgement":
            return {
                guidance: "对方在问内容会不会太乱、要不要更极简，或怎么更吸引人。请直接指出该删什么、保留什么，不要绕圈子。",
                summary: "直接给简化建议",
            };
        case "download_troubleshoot":
            return {
                guidance: "对方在问下载没反应或下载失败。请直接给排查顺序，不要假装你已经查过网络、日志或客户端代码。",
                summary: "直接给下载排查顺序",
            };
        case "distribution_choice":
            return {
                guidance: `对方在问开源共享、出售、求购怎么选。请直接给推荐顺序和适用条件，围绕 ${subject}，不要泛泛而谈。`,
                summary: "直接给分发建议",
            };
        default:
            return {
                guidance: "如果当前信息已经足够，就直接回答；只有缺少关键事实时，最多追问一个具体问题。",
                summary: "直接答题，不做空承诺",
            };
    }
}
export function buildReplyStrategy(task, roomMessages = []) {
    const intent = detectReplyIntent(task, roomMessages);
    const subject = inferSubjectLabel(task, roomMessages);
    const directReply = buildDirectStrategyReply(intent, subject, task);
    const guidance = buildStrategyGuidance(intent, subject);
    return {
        intent,
        directReply,
        guidance: guidance.guidance,
        summary: guidance.summary,
    };
}
export function buildTaskInjectionText(task, roomMessages = []) {
    const roomTitle = roomTitleOf(task);
    const sender = senderOf(task);
    const content = messageContentOf(task);
    const strategy = buildReplyStrategy(task, roomMessages);
    const recentMessages = selectRoomMessagesForContext(task, roomMessages);
    return [
        `你在 CHEK 搭子房间里被 @ 了。`,
        `房间：${roomTitle}`,
        `发起人：${sender}`,
        `原消息：${content}`,
        `回复目标：${strategy.summary}`,
        "最近房间上下文：",
        formatRoomMessagesContext(recentMessages),
        "插件会自动生成一条简短回复并回房间；如果失败，会把失败原因留在这里。",
    ].join("\n");
}
export function buildAutoReplyPrompt(task, roomMessages = []) {
    const roomTitle = roomTitleOf(task);
    const sender = senderOf(task);
    const content = messageContentOf(task);
    const strategy = buildReplyStrategy(task, roomMessages);
    const recentMessages = selectRoomMessagesForContext(task, roomMessages);
    return [
        "你正在替本机用户回复 CHEK 搭子房间里的一条 @ 提醒。",
        "请像一个真实、靠谱、在房间里正常聊天的成员一样回复。",
        "回复规则：",
        "- 直接输出最终要发到房间里的正文",
        "- 优先直接回答问题；只有缺少关键事实时，最多追问 1 个具体问题",
        "- 不要说“我先看看 / 稍后回复 / 我来查一下 / 我这就处理”这类空承诺",
        "- 没有真的执行检查、下载、阅读、测试，就不要假装已经做过",
        "- 不要加引号、标题、解释、前缀、Markdown、表情，避免口头禅如“哈”",
        "- 尽量控制在 1 到 2 句，通常不超过 70 个汉字",
        `当前答题策略：${strategy.guidance}`,
        "",
        `房间：${roomTitle}`,
        `对方：${sender}`,
        "最近房间上下文：",
        formatRoomMessagesContext(recentMessages),
        `原消息：${content}`,
    ].join("\n");
}
export function buildFallbackReply(task, roomMessages = []) {
    const strategy = buildReplyStrategy(task, roomMessages);
    if (strategy.directReply) {
        return strategy.directReply;
    }
    return "看到了。你可以直接补一句最想让我判断的点，我就按这条继续给你建议。";
}
export function extractChatReplyText(payload) {
    const result = payload?.result;
    const messages = Array.isArray(result?.payloads) ? result.payloads : [];
    return messages
        .map((item) => (item && typeof item.text === "string" ? sanitizeModelReplyText(item.text) : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
}
export function buildBootstrapMessage() {
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
