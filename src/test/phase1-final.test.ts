import { describe, expect, it } from "vitest";
import { canInviteWithScope, invitableRoles } from "@/lib/access-rules";

describe("Phase 1 final — invitation scope", () => {
  it("manager with zero assigned stores cannot invite", () => {
    expect(canInviteWithScope(invitableRoles("manager"), [])).toBe(false);
  });
  it("manager with an assigned store can invite", () => {
    expect(canInviteWithScope(invitableRoles("manager"), ["loc-1"])).toBe(true);
  });
  it("staff can never invite", () => {
    expect(canInviteWithScope(invitableRoles("staff"), ["loc-1"])).toBe(false);
  });
  it("owner can invite even before any store exists", () => {
    expect(canInviteWithScope(invitableRoles("owner"), [])).toBe(true);
  });
});

import { isInviteExpired } from "@/lib/access-rules";
describe("Phase 1 final — invitation expiry display", () => {
  const now = new Date("2026-10-26T14:00:00Z");
  it("an invite that expired an hour ago is expired", () => {
    expect(isInviteExpired("2026-10-26T13:00:00Z", now)).toBe(true);
  });
  it("an invite expiring in 7 days is still pending", () => {
    expect(isInviteExpired("2026-11-02T14:00:00Z", now)).toBe(false);
  });
});
