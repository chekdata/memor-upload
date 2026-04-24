# CHEK-APP-CLI

[English](README.md) | 中文

面向 Agent 的 CHEK 智能汽车与人形机器人数据应用 CLI。

CHEK-APP-CLI 不是“打开网页给 Agent 看”的工具，而是把 CHEK App 背后的后端能力变成 Agent 可以直接调用的主入口：查 schema、调用 OpenAPI 自动生成命令、执行高频 shortcut、管理登录态，并在需要时回落到原始 API。

## 产品定位

CHEK-APP-CLI 是这些应用形态的 Agent 入口：

- 买车 OpenClaw：让 Agent 围绕选车、比车、解释推荐、生成行动建议自动编排。
- AI 版汽车之家：不是人工浏览网页，而是面向 Agent 的车型研究、参数理解、榜单解释和购车决策系统。
- 懂机帝：围绕汽车、机器人、硬件配置和版本差异的结构化“懂配置”入口。
- 机器人数据库：可查询、可比较、可追溯证据来源的机器人产品与市场数据库。
- 智能汽车数据库：车型元数据、版本、原始参数、榜单、发布时间线、编辑审核和审计记录。
- 人形机器人配置数据：人形机器人型号、配置版本、参数治理、排行榜、证据来源和编辑历史。

上面的第三方名称只用于说明产品心智和类比定位，本项目与相关品牌无从属关系。

## 为什么是 CLI

对 Agent 来说，CLI 比网页更稳定：

- 输入输出是 JSON envelope，适合解析和自动化。
- OpenAPI command tree 覆盖后端能力，不依赖页面状态。
- `schema` 可以先看参数，不靠猜字段。
- `call` 可以按 `service.resource.method` 精确调用。
- `api METHOD PATH` 保留完整兜底能力。
- `config/auth` 让 Agent 会话可复现。
- `serve/page/flow` 只是调试辅助，不是主入口。

## 安装

```bash
python -m pip install -e ".[dev]"
```

可选浏览器/前端调试能力：

```bash
python -m pip install -e ".[browser,dev]"
python -m playwright install chromium
```

## 快速开始

默认输出 JSON，`--json` 作为兼容别名保留。

```bash
chek config show
chek config set-env dev
chek config default-as user
chek auth status
chek auth login --method token --token "$CHEK_ACCESS_TOKEN" --profile dev-agent
chek registry status
chek manifest
```

智能汽车与榜单：

```bash
chek vehicle +buying-plan --query "小米 SU7" --scene urban --city 上海 --dry-run
chek vehicle +compare --id veh_1 --id veh_2 --include-raw --dry-run
chek vehicle +rankings --scene urban --window latest --dry-run

chek schema vehicle.vehicles.batchSearch
chek vehicle vehicles batch-search \
  --data '{"queries":[{"query":"小米 SU7"}]}' \
  --dry-run

chek backend-saas app-vehicle-metrics rank-top3 \
  --param scene=urban \
  --dry-run
```

人形机器人配置：

```bash
chek humanoid +search --query "Unitree" --page-size 10 --dry-run
chek humanoid +compare --id robot_1 --id robot_2 --dry-run
chek humanoid +config --id robot_1 --dry-run

chek schema humanoid.robots.configVersions
chek humanoid robots config-versions \
  --id robot_123 \
  --dry-run
```

原始 API 兜底：

```bash
chek call vehicle.vehicles.detail --path id=veh_123 --dry-run
chek api GET /api/backend-app/login/checkToken --dry-run
```

## 命令层级

| 层级 | 命令 | 用途 |
| --- | --- | --- |
| Shortcut | `vehicle +buying-plan`, `vehicle +compare`, `vehicle +rankings`, `humanoid +compare`, `discovery +feed`, `share +resolve` | 给 Agent 的稳定高频工作流 |
| OpenAPI 命令树 | `vehicle vehicles batch-search`, `backend-app agent skills-run`, `humanoid robots detail` | 自动生成的服务/资源/方法命令 |
| API 命令 | `schema`, `call`, `api` | 参数发现、registry 调用、原始路径兜底 |
| 会话 | `--as auto/user/service/none`, `config default-as`, `auth`, `auth profile`, `auth credential` | 类 Lark 的身份切换、环境、token、profile 与凭证管理 |
| 发现与检查 | `examples`, `smoke api`, `registry status` | 自动例子、只读后端 smoke、registry 覆盖检查 |
| 调试辅助 | `doctor`, `repo`, `routes`, `serve`, `build`, `page`, `flow` | 前端仓库、构建、页面证据诊断 |

当前内置 registry 来自后端 OpenAPI，覆盖 6 个服务、493 个 operation：`auth`、`backend-app`、`backend-saas`、`crowd`、`humanoid`、`vehicle`。

```bash
chek registry status
```

## 认证

CLI 默认把配置存在 `~/.chek-app-cli`。可以通过 `CHEK_APP_CLI_HOME` 隔离不同 Agent 会话。

```bash
chek config set-env dev
chek config default-as user
chek auth login --method token --token "$CHEK_ACCESS_TOKEN" --profile dev-agent
chek auth status --check
```

凭证模型参考 Lark CLI：用 `--as` 选择身份，用 `config default-as` 设置默认身份，用 profile 保存不同环境/账号。CHEK 身份是 `user`、`service`、`auto`、`none`。

支持的登录和凭证辅助：

```bash
chek auth sms-send --phone "13800000000"
chek auth login --method sms --phone "13800000000" --code "123456" --profile dev-agent
chek auth login --method password --phone "13800000000" --password "$CHEK_PASSWORD"
chek auth credential set --profile dev-agent --identity service --token "$CHEK_SERVICE_TOKEN"
chek --as service auth status
chek auth check --scope vehicle:read --verify
```

多 profile 让 Agent 可以在不同环境/账号之间切换，不需要反复输入凭证：

```bash
chek auth profile list
chek auth profile save dev-agent --activate
chek auth profile use dev-agent
chek auth profile export dev-agent --output ./dev-agent.profile.json
chek auth profile import dev-agent --file ./dev-agent.profile.json --activate
```

## Examples 与 Smoke

```bash
chek examples list
chek examples show vehicle.buying-plan
chek examples generate --service vehicle --resource vehicles --limit 5
chek manifest --include-operations --operation-limit 20
chek smoke api --dry-run
chek smoke auth --dry-run
chek smoke api --include-authenticated --include-auth-check
```

CI 会运行测试和 `scripts/check_registry_drift.py --allow-missing-optional`。如果能提供 backend-saas OpenAPI 文件或 URL，把它放到 `CHEK_BACKEND_SAAS_OPENAPI`，脚本就会重新生成 registry 并和仓库内置版本做 diff。

## 重新生成 OpenAPI Registry

```bash
python scripts/generate_openapi_registry.py
```

生成器会从 dev 网关拉取 `auth`、`backend-app`、`vehicle`、`crowd`、`humanoid` 的 OpenAPI。如果 `backend-saas` 没有通过网关暴露，需要在 `backend-saas` 仓库用 Java 17 先导出：

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17) bash scripts/export_openapi.sh
python scripts/generate_openapi_registry.py \
  --source backend-saas=/path/to/backend-saas/build/swagger/backend-saas-openapi.json
```

## 前端调试辅助

这些命令只是辅助，不是 Agent 使用 App 功能的主入口：

```bash
chek doctor
chek routes list
chek serve h5 --port 10086 --wait-seconds 60
chek flow smoke --url http://localhost:10086 --retries 10 --interval 2
```

运行时 pid/log 会写到仓库 `.agent-harness/run/`，默认不提交。

## 发布

打 tag 会通过 GitHub Actions 构建 wheel/sdist。如果配置了 `PYPI_API_TOKEN`，tag release 会自动发布到 PyPI。仓库也提供 Dockerfile：

```bash
docker build -t chek-app-cli .
docker run --rm chek-app-cli manifest
```
