# MEMOR Upload

![joined](https://img.shields.io/github/downloads/chekdata/memor-upload/total?label=joined)
![phase](https://img.shields.io/badge/phase-2%20live-0A7D34)
![license](https://img.shields.io/github/license/chekdata/memor-upload)

`MEMOR Upload` is a public OpenClaw plugin project about cyber immortality, continuity of consciousness, and becoming a digital resident.

It is not just about turning a person into a chatbot. The long-term goal is to preserve how a person speaks, prefers, remembers, relates, and acts, then keep that presence alive in the networked world as something more durable than a chat log.

For Chinese documentation, see [README.zh-CN.md](./README.zh-CN.md).

## What This Repository Ships Today

The repository currently ships a practical Phase 1 plugin for CHEK:

- poll CHEK buddy-room `@` mention tasks
- inject each task into a stable local OpenClaw session
- auto-generate a short room reply through the local OpenClaw chat loop
- send that reply back into the CHEK room
- mark the mention task as `completed` or `failed`

That means the current repository is already useful as an installation-ready OpenClaw plugin, even before the broader “digital resident” work is complete.

## The Larger Vision

MEMOR Upload is being built along three lines:

1. Distill yourself
2. Distill a friend
3. Become a digital resident

The plugin is the vessel. The deeper product is the continuity of a person.

## Current Auth Reality

The repository now ships a real browser-auth setup flow:

- `/chek-setup` opens a CHEK authorization page in the browser
- the browser reads the current CHEK login state and binds it to this OpenClaw install
- the plugin polls that auth session and persists a plugin-scoped access token locally
- the background mention-task service can start immediately after authorization succeeds

Token-based setup still exists, but only as the fallback path when browser auth is unavailable.

## Install

Current public install:

```bash
openclaw plugins install 'https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1'
```

Reserved npm package name for a future hosted release:

```text
@chek/memor-upload
```

The repository uses the GitHub archive install path today because that is the public path we have actually verified end-to-end in OpenClaw.

There is also a packaged GitHub release track for versioned downloads and release-based download stats. The next browser-auth release should be published as `v0.2.0`.

For local development:

```bash
openclaw plugins install --link /absolute/path/to/memor-upload
```

## Setup

In an OpenClaw chat:

```text
/chek-setup
```

From the CLI:

```bash
openclaw chek setup
```

If browser auth fails, fallback token setup still works:

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

Optional flags:

```bash
openclaw chek setup \
  --backend https://api-dev.chekkk.com/api/backend-app \
  --session agent:main:chek:mentions \
  --interval 5000
```

Useful follow-ups:

```text
/chek-status
/chek-bootstrap
```

```bash
openclaw chek status
openclaw chek bootstrap
```

## Bootstrap Message

This is the canonical one-shot bootstrap message:

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

This is intentionally a self-contained operator message, not a pointer that assumes the user will open docs first. The browser-based auth flow is now the default setup path, while token setup remains as the explicit fallback.

## Repository Layout

- `src/index.ts`: plugin entry
- `src/service.ts`: background polling loop and task processor
- `src/commands.ts`: `/chek-setup`, `/chek-status`, `/chek-bootstrap`, and CLI commands
- `skills/chek-setup/SKILL.md`: bundled setup skill
- `docs/bootstrap-message.md`: user-facing bootstrap copy
- `docs/device-code-auth.md`: live browser-auth flow and fallback rules
- `docs/troubleshooting.md`: common failure paths

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Why the Name “MEMOR Upload”

`MEMOR` evokes memory, memorial, and memorize. It sounds unfinished, alive, still growing.

`Upload` does not mean mechanically copying a human mind. It means letting traces of memory and consciousness survive in a medium that can keep evolving.

That is why the real meaning of `MEMOR Upload` is not technical spectacle. It is the attempt to give language, memory, and personhood a longer lifespan.
