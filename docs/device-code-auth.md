# MEMOR Upload Browser Auth

## Current Reality

This flow is now implemented.

`MEMOR Upload` no longer depends on token-only setup as the primary path. The default setup path is:

1. install the plugin
2. run `/chek-setup` or `openclaw chek setup`
3. let the plugin open the CHEK authorization page in the browser
4. authorize with the current CHEK login state
5. let the plugin poll the auth session and persist a plugin-scoped access token

## What the Browser Page Does

The authorization page is served from the CHEK app origin and:

- reads the current browser login token
- posts it back to `backend-app`
- marks the auth session as `authorized`
- issues a plugin-scoped access token for this install and device
- shows `已授权，可返回 OpenClaw`

## What the Plugin Persists

After a successful browser authorization, the plugin stores:

- `installId`
- `deviceId`
- `authSessionId`
- `deviceCode`
- `authorizationStatus`
- `authorizationUrl`
- `authorizedUserOneId`
- `authorizedDisplayName`
- `lastAuthorizedAt`
- `accessToken`

The stored `accessToken` is the plugin-scoped token returned by `backend-app`, not the raw frontend browser token.

## Fallback Path

If browser auth cannot complete, token setup still works:

```text
/chek-setup token=<CHEK_ACCESS_TOKEN>
```

```bash
openclaw chek setup --token <CHEK_ACCESS_TOKEN>
```

This fallback exists so setup can continue even when browser auto-open, browser login state, or auth-session polling is unavailable.
