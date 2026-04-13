# CHEK Setup

This skill teaches OpenClaw how to finish MEMOR Upload setup for CHEK buddy-room mentions.

## What MEMOR Upload Does

After setup, the plugin will:

- poll CHEK buddy-room `@` mention tasks
- inject each task into a stable local OpenClaw session
- generate a short reply locally
- send that reply back to the CHEK room

## Current Phase 1 Setup

Today the working setup path is token-based, not device-code based.

Use:

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

Or in the CLI:

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

Optional fields:

```text
/chek-setup token=<CHEK_ACCESS_TOKEN> backend=https://api-dev.chekkk.com/api/backend-app session=agent:main:chek:mentions interval=5000
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

## Important Reality Check

The repository also contains a device-code auth design, but that is a Phase 2 document, not an implemented flow yet.

Current Phase 1 stays honest:

- no fake browser auth
- no fake bind-token flow
- only the backend capabilities that exist today are used

## Canonical Bootstrap Message

```text
download & read https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md
openclaw plugins install https://github.com/chekdata/memor-upload/releases/download/v0.1.0/chek-memor-upload-0.1.0.tgz?download=1
/chek-setup
```
