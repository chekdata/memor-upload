# MEMOR Upload

![joined](https://img.shields.io/github/downloads/chekdata/memor-upload/total?label=joined)
![phase](https://img.shields.io/badge/phase-1%20live-0A7D34)
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

Phase 1 is implemented truthfully against the backend that exists today:

- setup is done with a CHEK access token
- browser-based device-code auth is documented, but not implemented yet
- the plugin does not pretend there is an OAuth or device-binding API if the backend does not provide one

That is why the current setup flow uses `/chek-setup token=...` or the equivalent CLI command.

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

There is also a packaged GitHub release at [v0.1.0](https://github.com/chekdata/memor-upload/releases/tag/v0.1.0) for versioned downloads and release-based download stats.

For local development:

```bash
openclaw plugins install --link /absolute/path/to/memor-upload
```

## Setup

In an OpenClaw chat:

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

From the CLI:

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

Optional flags:

```bash
openclaw chek setup \
  --token <CHEK_ACCESS_TOKEN> \
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
download & read https://github.com/chekdata/memor-upload/blob/main/skills/chek-setup/SKILL.md
openclaw plugins install https://github.com/chekdata/memor-upload/archive/refs/heads/main.tar.gz?download=1
/chek-setup
```

In Phase 1, `/chek-setup` will guide the user to finish token configuration. The fully browser-based device-code flow is planned, but intentionally not faked.

## Repository Layout

- `src/index.ts`: plugin entry
- `src/service.ts`: background polling loop and task processor
- `src/commands.ts`: `/chek-setup`, `/chek-status`, `/chek-bootstrap`, and CLI commands
- `skills/chek-setup/SKILL.md`: bundled setup skill
- `docs/bootstrap-message.md`: user-facing bootstrap copy
- `docs/device-code-auth.md`: planned Phase 2 auth design
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
