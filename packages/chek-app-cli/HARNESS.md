# Agent Harness SOP: CHEK-APP-CLI

## Purpose

CHEK-APP-CLI makes the CHEK app agent-native by exposing backend capabilities
through a stable command protocol. The frontend/browser controls remain useful
debug helpers, but the primary interface is API-first.

## Lark-Style Shape

```text
chek
  |
  +-- config/auth             # environment and credentials
  +-- schema                  # discover known service.resource.method specs
  +-- call service.resource.method
  +-- <service> <resource> <method>
  +-- api METHOD PATH         # raw backend calls for full coverage
  +-- vehicle/share/...       # +shortcut commands for common app workflows
  +-- routes/serve/page/...   # optional frontend developer helpers
```

This mirrors the useful lark-cli idea: agents start with shortcuts or generated
service/resource/method commands, drop to schema-backed `call` when they need
precision, and use raw API calls for unknown or newly added backend paths.

## Output Contract

JSON is the default. `--json` is still supported as an alias.

```json
{
  "ok": true,
  "command": "vehicle +search",
  "data": {},
  "warnings": [],
  "errors": []
}
```

On failure, `ok` is false and the process exits non-zero.

## Command Groups

| Group | Commands | Purpose |
| --- | --- | --- |
| `config` | `show`, `set-env`, `set-origin` | Select CHEK API environment or custom origin |
| `auth` | `status`, `set-token`, `sms-send`, `sms-login`, `login-password`, `logout` | Manage credentials and login state |
| generated services | `auth`, `backend-app`, `backend-saas`, `crowd`, `humanoid`, `vehicle` | OpenAPI-generated resource/method command trees |
| `schema` | root command | Inspect service/resource/method metadata |
| `call` | root command | Call a known registry method with path args, params, and body |
| `api` | root command | Call any backend path with `--params`, `--data`, `--dry-run` |
| `registry` | `status` | Show OpenAPI source and operation coverage |
| `vehicle` | `+search`, `detail`, `raw-params` | Vehicle metadata workflows |
| `discovery` | `+feed` | Public discovery feed workflow |
| `share` | `+create`, `+resolve`, `+revoke` | Share token workflows |
| `micontrol` | `runs`, `detail`, `create` | MiControl run workflows |
| `doctor/repo/routes/serve/build/page/flow` | assorted | Optional frontend repo and browser helpers |

Current bundled registry: 6 backend OpenAPI services and 493 operations:
`auth`, `backend-app`, `backend-saas`, `crowd`, `humanoid`, and `vehicle`.

## Agent Rules

- Use JSON output and parse the envelope instead of scraping text.
- Run `chek schema <service.resource.method>` before guessing request fields.
- Prefer generated command trees such as `chek vehicle vehicles batch-search`.
- Prefer `chek call <service.resource.method> --dry-run` for registry-backed methods.
- Use `chek api ... --dry-run` before calling a new backend path.
- Prefer `auth set-token` when a trusted token is already available.
- Use SMS/password login helpers only when the environment supports them.
- Treat `serve`, `page`, and `flow` as debug evidence, not the core app API.

## Examples

```bash
chek config set-env dev
chek auth status
chek registry status
chek schema vehicle.vehicles.batchSearch
chek vehicle vehicles batch-search --data '{"queries":[{"query":"小米 SU7"}]}' --dry-run
chek call vehicle.vehicles.detail --path id=veh_123 --dry-run
chek vehicle +search --query "小米 SU7" --dry-run
chek api GET /api/backend-app/login/checkToken --dry-run
chek discovery +feed --page-size 10 --dry-run
```
