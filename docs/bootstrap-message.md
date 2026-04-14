# MEMOR Upload Bootstrap Message

当前可直接发给 OpenClaw 的一段式引导文案如下：

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

## 当前主路径

这条 bootstrap message 现在已经对应真实产品能力：

1. 安装插件
2. 执行 `/chek-setup`
3. 自动打开浏览器授权页
4. 浏览器显示“已授权，可返回 OpenClaw”
5. 插件轮询授权状态并落盘
6. 后台 mention-task bridge 继续工作

token setup 仍然保留，但它已经从“唯一 setup 方式”降级为明确的 fallback。
