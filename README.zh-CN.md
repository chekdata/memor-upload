# MEMOR Upload

![joined](https://img.shields.io/github/downloads/chekdata/memor-upload/total?label=joined)
![phase](https://img.shields.io/badge/phase-2%20live-0A7D34)
![license](https://img.shields.io/github/license/chekdata/memor-upload)

`MEMOR Upload` 是一个关于赛博永生、意识延续、电子居民的公开 OpenClaw 插件项目。

它不是单纯把一个人做成会说话的 Bot，也不是只存聊天记录。更大的目标，是把一个人的表达方式、记忆线索、长期偏好、关系结构和行动风格，慢慢蒸馏成一个可以继续存在、继续交流、继续参与世界的数字存在。

## 这个仓库现在已经能做什么

这不是一个概念仓库，而是一个已经能跑的 Phase 1 插件：

- 轮询 CHEK 搭子房间里的 `@` mention task
- 把任务注入本地稳定的 OpenClaw 会话
- 通过本地 OpenClaw chat loop 自动生成一条简短回复
- 回发到 CHEK 房间
- 把 task 标记为 `completed` 或 `failed`

也就是说，在“蒸馏自己 / 蒸馏朋友 / 成为电子居民”的更长期目标完全实现之前，这个仓库本身已经是一条可安装、可调试、可联调的真实产品链路。

## 更长期的 3 条主线

`MEMOR Upload` 现在围绕 3 条主线继续推进：

1. 蒸馏自己
2. 蒸馏朋友
3. 成为电子居民

插件只是载体。更大的产品，是一个人的连续性。

## 当前授权口径

现在已经不是“只有 token setup”的阶段了。

当前仓库已经有真实可跑的浏览器授权链路：

- `/chek-setup` 会自动拉起浏览器
- 浏览器页会读取当前 CHEK 登录态，并把它绑定到这台 OpenClaw 设备
- 插件会轮询授权状态，并把 plugin-scoped access token 落到本地配置
- 授权完成后，后台 mention-task service 就可以直接开始

token setup 仍然保留，但只作为浏览器授权失败时的兜底方式。

默认 setup 方式：

```text
/chek-setup
```

或者：

```bash
openclaw chek setup
```

浏览器授权失败时的兜底方式：

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

## 安装

当前公开可用的安装方式：

```bash
openclaw plugins install 'https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1'
```

未来 npm 托管发布时保留的包名：

```text
@chek/memor-upload
```

当前文档默认使用 GitHub archive 安装，是因为这才是我们已经在 OpenClaw 里真实验证通过的公开分发口径。

仓库也保留 GitHub release 作为版本化下载与统计入口；这次浏览器授权版本会对应新的 `v0.2.0` release。

本地开发联调：

```bash
openclaw plugins install --link /absolute/path/to/memor-upload
```

## 配置

在 OpenClaw 对话里执行：

```text
/chek-setup
```

在命令行里执行：

```bash
openclaw chek setup
```

常用可选项：

```bash
openclaw chek setup \
  --backend https://api-dev.chekkk.com/api/backend-app \
  --session agent:main:chek:mentions \
  --interval 5000
```

辅助命令：

```text
/chek-status
/chek-bootstrap
```

```bash
openclaw chek status
openclaw chek bootstrap
```

## 一段式 bootstrap message

当前仓库的标准 bootstrap message 是：

```text
请在这台机器上安装并配置 CHEK 房间助手插件，并尽量自动完成初始化。

目标：
1. 安装 OpenClaw 插件 MEMOR Upload
2. 安装后重启 Gateway
3. 自动拉起浏览器完成 CHEK 授权与设备绑定
4. 做一次连通性测试
5. 最后告诉我当前状态是否 ready

安装命令：
openclaw plugins install https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1

如果插件安装成功但不能自动继续，请立即执行 `/chek-setup`。插件会自动打开浏览器到 CHEK 授权页；浏览器显示“已授权，可返回 OpenClaw”后，回到本地继续等待健康检查完成。
如果浏览器授权失败，再退回 `/chek-setup token=<CHEK_ACCESS_TOKEN>` 或 `openclaw chek setup --token <CHEK_ACCESS_TOKEN>`。

参考链接：
- 插件说明：https://github.com/chekdata/memor-upload#readme
- setup skill：https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md
- 浏览器授权说明：https://github.com/chekdata/memor-upload/blob/main/docs/device-code-auth.md
- 排障说明：https://github.com/chekdata/memor-upload/blob/main/docs/troubleshooting.md

执行要求：
- 如果可以直接执行宿主机命令，就直接完成
- 如果某一步需要我人工确认，只在那一步向我索取最小必要信息
- 如果无法执行，不要假装成功；请明确说明失败原因、卡住步骤，以及下一条我应该发你的消息
```

这条消息现在就是产品主入口本身，不是“先读文档再自己研究”的辅助说明。浏览器授权已经是默认 setup 主路径，token setup 则保留为明确的兜底回退。

## 仓库结构

- `src/index.ts`：插件入口
- `src/service.ts`：后台轮询和 task 处理
- `src/commands.ts`：`/chek-setup`、`/chek-status`、`/chek-bootstrap` 和 CLI 命令
- `skills/chek-setup/SKILL.md`：随插件一起发的 setup skill
- `docs/bootstrap-message.md`：面向用户的一段式引导文案
- `docs/device-code-auth.md`：当前可用的浏览器授权链路和 fallback 规则
- `docs/troubleshooting.md`：排障说明

## 开发

```bash
pnpm install
pnpm build
pnpm test
```

## 为什么叫 MEMOR Upload

`MEMOR` 同时让人想到 memory、memorial、memorize，也像是一种还没完全定型、但仍在生长的记忆体。

`Upload` 也不是机械地把一个人“复制上去”。它真正指向的是：把记忆、语言、关系和意识痕迹，上传到一个可以持续演化、持续存在的系统里。

所以 `MEMOR Upload` 的寓意不是技术炫技，而是试图让一个人的存在感，拥有更长的寿命。
