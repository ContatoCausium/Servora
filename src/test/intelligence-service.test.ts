import { describe, it, expect } from "vitest";
import { computeIntelligenceSummary } from "@/lib/intelligence-service";

describe("Servora Intelligence Service (Deterministic Logic)", () => {
  const orgId = "org-demo-1";

  it("calculates intelligence metrics without throwing", () => {
    const summary = computeIntelligenceSummary(orgId, "all", 30);
    expect(summary).toBeDefined();
    expect(summary.grossRevenueCents).toBeGreaterThanOrEqual(0);
    expect(summary.foodCostCents).toBeGreaterThanOrEqual(0);
    expect(summary.cmvRate).toBeGreaterThanOrEqual(0);
    expect(summary.cmvRate).toBeLessThanOrEqual(100);
    expect(Array.isArray(summary.insights)).toBe(true);
  });

  it("generates insights with explicit confidence and data origin metadata", () => {
    const summary = computeIntelligenceSummary(orgId, "all", 30);
    expect(summary.insights.length).toBeGreaterThan(0);

    summary.insights.forEach((ins) => {
      expect(ins.id).toBeDefined();
      expect(ins.title).toBeTruthy();
      expect(ins.summary).toBeTruthy();
      expect(["high", "medium", "low", "opportunity"]).toContain(ins.impactLevel);
      expect(["deterministic", "statistical_high", "statistical_medium"]).toContain(ins.confidence);
      expect(["real_recorded", "mixed_verified", "sample_simulated"]).toContain(ins.dataOrigin);
      expect(ins.recommendation).toBeTruthy();
    });
  });

  it("isolates locations and aggregates correctly", () => {
    const allSummary = computeIntelligenceSummary(orgId, "all", 30);
    const singleLocSummary = computeIntelligenceSummary(orgId, "loc-non-existent", 30);

    expect(singleLocSummary.grossRevenueCents).toBeLessThanOrEqual(allSummary.grossRevenueCents);
  });
});
