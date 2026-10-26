import { describe, expect, it } from "vitest";

import { safeRedirect } from "@/lib/auth";

describe("safeRedirect", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirect("/invite/abc")).toBe("/invite/abc");
  });
  it("rejects external and protocol-relative URLs", () => {
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("/\\evil.example")).toBe("/");
  });
});
