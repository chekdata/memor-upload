import type { MemorUploadConfig } from "./types.js";

export const DEFAULT_BACKEND_APP_BASE_URL = "https://api-dev.chekkk.com/api/backend-app";
export const DEFAULT_POLL_INTERVAL_MS = 5_000;
export const DEFAULT_SESSION_KEY = "agent:main:chek:mentions";
export const ACCESS_TOKEN_ENV_NAMES = ["CHEK_ACCESS_TOKEN", "CHEK_MEMOR_ACCESS_TOKEN"] as const;

export const CONFIG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    backendAppBaseUrl: { type: "string", minLength: 1 },
    accessToken: { type: "string" },
    pollIntervalMs: { type: "integer", minimum: 2_000, maximum: 60_000 },
    sessionKey: { type: "string", minLength: 1 },
    installId: { type: "string" },
    deviceId: { type: "string" },
    authSessionId: { type: "string" },
    deviceCode: { type: "string" },
    authorizationStatus: { type: "string" },
    authorizationUrl: { type: "string" },
    authorizedUserOneId: { type: "string" },
    authorizedDisplayName: { type: "string" },
    lastAuthorizedAt: { type: "string" },
  },
} as const;

export const CONFIG_UI_HINTS = {
  enabled: { label: "Enabled" },
  backendAppBaseUrl: {
    label: "CHEK Backend URL",
    placeholder: "https://api-dev.chekkk.com/api/backend-app",
  },
  accessToken: {
    label: "CHEK Access Token",
    sensitive: true,
    help: "If left empty, the plugin falls back to CHEK_ACCESS_TOKEN from the environment.",
  },
  pollIntervalMs: { label: "Poll Interval (ms)" },
  sessionKey: {
    label: "OpenClaw Session Key",
    placeholder: DEFAULT_SESSION_KEY,
  },
  installId: { label: "Install ID" },
  deviceId: { label: "Device ID" },
  authSessionId: { label: "Auth Session ID" },
  deviceCode: { label: "Device Code" },
  authorizationStatus: { label: "Authorization Status" },
  authorizationUrl: { label: "Authorization URL" },
  authorizedUserOneId: { label: "Authorized User One ID" },
  authorizedDisplayName: { label: "Authorized User" },
  lastAuthorizedAt: { label: "Last Authorized At" },
} as const;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = record[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizeBackendAppBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_BACKEND_APP_BASE_URL;
  }
  if (trimmed.endsWith("/api/backend-app")) {
    return trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return `${trimmed}/backend-app`;
  }
  if (trimmed.endsWith("/backend-app")) {
    return trimmed;
  }
  return `${trimmed}/api/backend-app`;
}

export function parseConfig(value: unknown): MemorUploadConfig {
  const record = asRecord(value);
  return {
    enabled: readBoolean(record, "enabled", true),
    backendAppBaseUrl: normalizeBackendAppBaseUrl(
      readString(record, "backendAppBaseUrl", DEFAULT_BACKEND_APP_BASE_URL),
    ),
    accessToken: readString(record, "accessToken"),
    pollIntervalMs: readInteger(
      record,
      "pollIntervalMs",
      DEFAULT_POLL_INTERVAL_MS,
      2_000,
      60_000,
    ),
    sessionKey: readString(record, "sessionKey", DEFAULT_SESSION_KEY) || DEFAULT_SESSION_KEY,
    installId: readString(record, "installId"),
    deviceId: readString(record, "deviceId"),
    authSessionId: readString(record, "authSessionId"),
    deviceCode: readString(record, "deviceCode"),
    authorizationStatus: readString(record, "authorizationStatus"),
    authorizationUrl: readString(record, "authorizationUrl"),
    authorizedUserOneId: readString(record, "authorizedUserOneId"),
    authorizedDisplayName: readString(record, "authorizedDisplayName"),
    lastAuthorizedAt: readString(record, "lastAuthorizedAt"),
  };
}

export function resolveAccessToken(config: MemorUploadConfig): string {
  if (config.accessToken.trim()) {
    return config.accessToken.trim();
  }
  for (const envName of ACCESS_TOKEN_ENV_NAMES) {
    const value = String(process.env[envName] || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function withConfigPatch(
  baseConfig: MemorUploadConfig,
  patch: Partial<MemorUploadConfig>,
): MemorUploadConfig {
  return parseConfig({
    ...baseConfig,
    ...patch,
  });
}

export function isConfigured(config: MemorUploadConfig): boolean {
  return Boolean(config.enabled && config.backendAppBaseUrl && resolveAccessToken(config));
}

export function maskToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) {
    return "not-configured";
  }
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 6)}***${trimmed.slice(-4)}`;
}
