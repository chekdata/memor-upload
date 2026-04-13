# MEMOR Upload

![joined](https://img.shields.io/github/downloads/chekdata/memor-upload/total?label=joined)
![phase](https://img.shields.io/badge/phase-1%20live-0A7D34)
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

当前 Phase 1 按照后端已经存在的能力如实实现：

- 当前 setup 用 CHEK access token 完成
- 浏览器 device-code 授权已经写入文档，但还没有后端能力承接
- 仓库不会假装后端已经有 OAuth / device-binding API

所以现在的真实 setup 方式是：

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

或者：

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

## 安装

当前公开可用的安装方式：

```bash
openclaw plugins install 'https://github.com/chekdata/memor-upload/releases/download/v0.1.0/chek-memor-upload-0.1.0.tgz?download=1'
```

未来 npm 托管发布时保留的包名：

```text
@chek/memor-upload
```

当前文档默认使用 GitHub release asset 安装，是因为这才是现在已经真实可用、不会假装“npm 已发布”的公开分发口径，而且下载统计也会对应到插件包本身。

本地开发联调：

```bash
openclaw plugins install --link /absolute/path/to/memor-upload
```

## 配置

在 OpenClaw 对话里执行：

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

在命令行里执行：

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

常用可选项：

```bash
openclaw chek setup \
  --token <CHEK_ACCESS_TOKEN> \
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
download & read https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md
openclaw plugins install https://github.com/chekdata/memor-upload/releases/download/v0.1.0/chek-memor-upload-0.1.0.tgz?download=1
/chek-setup
```

当前 Phase 1 里，`/chek-setup` 会继续提示用户完成 token 配置。真正“自动拉起浏览器并回到已授权”的 device-code 流程已经单独写入文档，但不会在没有后端支撑时被伪装成已完成。

## 仓库结构

- `src/index.ts`：插件入口
- `src/service.ts`：后台轮询和 task 处理
- `src/commands.ts`：`/chek-setup`、`/chek-status`、`/chek-bootstrap` 和 CLI 命令
- `skills/chek-setup/SKILL.md`：随插件一起发的 setup skill
- `docs/bootstrap-message.md`：面向用户的一段式引导文案
- `docs/device-code-auth.md`：Phase 2 的 device-code 方案
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
