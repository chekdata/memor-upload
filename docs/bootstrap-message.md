# MEMOR Upload Bootstrap Message

当前可直接发给 OpenClaw 的一段式引导文案如下：

```text
download & read https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md
openclaw plugins install https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1
/chek-setup
```

## 当前 Phase 1 的真实含义

这条 bootstrap message 已经能完成两件事：

1. 让 OpenClaw 拿到安装说明和 setup skill
2. 安装 `MEMOR Upload` 插件，并进入 setup 指引

但它目前还不是零输入授权，因为后端还没有真正提供 device-code / browser callback API。

所以当前 `/chek-setup` 的职责是：

- 展示当前配置状态
- 提示用户继续输入 `token=<CHEK_ACCESS_TOKEN>`
- 把配置写回 OpenClaw
- 立即做一轮 backend + gateway 健康检查

## 什么时候升级成真正的一段式授权

当 CHEK 后端补齐 device-code 授权接口后，这条 bootstrap message 可以自然升级成：

- 插件安装
- 自动拉起浏览器
- 浏览器授权
- 回到 OpenClaw 显示“已授权”
- 后台轮询直接开始

在那之前，文案和产品能力都保持如实表达，不伪装已经完成的授权链路。
