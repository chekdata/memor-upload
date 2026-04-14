# CHEK Setup

This skill teaches OpenClaw how to finish MEMOR Upload setup for CHEK buddy-room mentions.

## What MEMOR Upload Does

After setup, the plugin will:

- poll CHEK buddy-room `@` mention tasks
- inject each task into a stable local OpenClaw session
- generate a short reply locally
- send that reply back to the CHEK room

## Default Setup Path

Today the default setup path is browser auth.

Use:

```text
/chek-setup
```

Or in the CLI:

```bash
openclaw chek setup
```

The plugin will:

1. persist stable install / device identifiers
2. create a CHEK auth session
3. open the browser authorization page
4. wait for the browser page to show `已授权，可返回 OpenClaw`
5. persist the returned plugin token locally

## Fallback Path

If browser auth fails, token setup still works:

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

## Useful Follow-ups

```text
/chek-status
/chek-bootstrap
```

```bash
openclaw chek status
openclaw chek bootstrap
```

## Canonical Bootstrap Message

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
