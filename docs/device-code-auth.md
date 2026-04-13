# MEMOR Upload Device-Code Auth

## 状态

这是规划中的 Phase 2 方案，不是当前仓库已经实现的能力。

当前仓库真实可用的是：

- token-based setup
- 本地轮询 mention task
- 本地 OpenClaw 会话注入
- 自动回复回房间

## 目标

未来希望把当前 setup 升级成真正的浏览器授权链路：

1. 用户执行：

```bash
openclaw plugins install @chek/memor-upload
```

2. 插件或 `/chek-setup` 自动拉起浏览器
3. 浏览器进入 CHEK 授权页
4. 用户确认授权
5. 浏览器显示“已授权，可返回 OpenClaw”
6. 插件轮询授权状态并落盘
7. 后台 mention-task service 自动开始

## 需要后端补齐的能力

至少需要下面几类接口之一：

- device-code 授权挑战创建
- 授权状态轮询
- 授权成功后的 device binding
- 插件 / 设备级 access token 或 refresh token 发放

在后端没有这些接口前，插件不会伪装自己已经具备 device-code 能力。
