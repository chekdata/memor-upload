import { describe, expect, it } from "vitest";

import { parseSetupArgs } from "./args.js";

describe("parseSetupArgs", () => {
  it("parses key=value syntax", () => {
    expect(
      parseSetupArgs(
        "token=abc backend=https://api-dev.chekkk.com session=agent:main:chek:mentions interval=6000",
      ),
    ).toEqual({
      token: "abc",
      backend: "https://api-dev.chekkk.com",
      session: "agent:main:chek:mentions",
      interval: 6000,
    });
  });

  it("parses flag syntax", () => {
    expect(parseSetupArgs("--token abc --backend https://api-dev.chekkk.com --disable")).toEqual({
      token: "abc",
      backend: "https://api-dev.chekkk.com",
      enable: false,
    });
  });
});
