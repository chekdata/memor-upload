import { describe, expect, it } from "vitest";

import {
  DEFAULT_BACKEND_APP_BASE_URL,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_SESSION_KEY,
  normalizeBackendAppBaseUrl,
  parseConfig,
} from "./config.js";

describe("memor-upload config", () => {
  it("fills defaults", () => {
    const config = parseConfig({});
    expect(config.backendAppBaseUrl).toBe(DEFAULT_BACKEND_APP_BASE_URL);
    expect(config.pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);
    expect(config.sessionKey).toBe(DEFAULT_SESSION_KEY);
    expect(config.enabled).toBe(true);
  });

  it("normalizes backend url shorthands", () => {
    expect(normalizeBackendAppBaseUrl("https://api-dev.chekkk.com")).toBe(
      DEFAULT_BACKEND_APP_BASE_URL,
    );
    expect(normalizeBackendAppBaseUrl("https://api-dev.chekkk.com/api")).toBe(
      DEFAULT_BACKEND_APP_BASE_URL,
    );
    expect(normalizeBackendAppBaseUrl("https://api-dev.chekkk.com/api/backend-app/")).toBe(
      DEFAULT_BACKEND_APP_BASE_URL,
    );
  });
});
