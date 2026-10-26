import { describe, expect, it } from "vitest";
import { isAuthStep } from "@/components/auth/back-button";

describe("auth back navigation targets", () => {
  it("allows auth steps, keeping tokens and search", () => {
    expect(isAuthStep("/auth?redirect=%2Finvite%2Fabc")).toBe(true);
    expect(isAuthStep("/invite/abc123")).toBe(true);
    expect(isAuthStep("/reset-password?recovery=1")).toBe(true);
  });
  it("never targets protected pages or other sites", () => {
    expect(isAuthStep("/")).toBe(false);
    expect(isAuthStep("/team")).toBe(false);
    expect(isAuthStep("/invite/")).toBe(false);
    expect(isAuthStep("//evil.com/auth")).toBe(false);
    expect(isAuthStep("https://evil.com/auth")).toBe(false);
  });
});
