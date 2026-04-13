# MEMOR Upload Troubleshooting

## 插件装不上

先确认：

```bash
openclaw --version
openclaw plugins list
```

然后重试：

```bash
openclaw plugins install https://github.com/chekdata/memor-upload/releases/download/v0.1.0/chek-memor-upload-0.1.0.tgz?download=1
```

本地联调可以直接改用：

```bash
openclaw plugins install --link /absolute/path/to/memor-upload
```

## 装上了，但还没开始收任务

先执行：

```text
/chek-status
```

如果 `configured: no`，继续执行：

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

## 配置完了，但还是收不到房间里的 @

优先检查：

- 当前 token 对应的 CHEK 用户是否就是被 `@` 的那个用户
- 该用户是否已经加入对应搭子房间
- `backend` 配置是否指向正确的 `backend-app` 网关地址
- `sessionKey` 是否被错误改掉

再执行：

```text
/chek-status
```

看这些字段：

- `lastPollAt`
- `lastSuccessAt`
- `lastTaskAt`
- `lastTaskId`
- `lastError`

## 本地会话里看到了任务，但房间里没回出去

通常说明链路卡在这几步之一：

1. OpenClaw 本地生成回复失败
2. CHEK 房间发消息失败
3. task 回写 `complete` 失败

当前插件策略是：

- 模型生成失败会自动退回到兜底回复
- 真正失败时会把原因写回本地会话，并把 task 标记成 `failed`

如果本地会话里也没有失败提示，优先看 `/chek-status` 里的 `lastError`。
