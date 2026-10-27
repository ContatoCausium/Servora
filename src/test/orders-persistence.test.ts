import { describe, it, expect } from "vitest";
import { calculateOrderSummary, calculateItemTotal, type Order, type SelectedModifier } from "../lib/orders-service";
import { persistOrderToSupabase, fetchPersistedOrders } from "../lib/orders-persistence-service";

describe("Orders persistence and multi-tenant integrity", () => {
  it("calculates modifiers total accurately for orders", () => {
    const mods: SelectedModifier[] = [
      { groupId: "g1", groupName: "Cheese", optionId: "o1", optionName: "Cheddar", priceCents: 150 },
      { groupId: "g2", groupName: "Bacon", optionId: "o2", optionName: "Crispy Bacon", priceCents: 200 },
    ];
    const total = calculateItemTotal(1000, 2, mods);
    expect(total).toBe((1000 + 350) * 2);
  });

  it("computes order summary with tax correctly", () => {
    const summary = calculateOrderSummary([
      {
        id: "oi-test",
        productId: "p1",
        productName: "Test Burger",
        quantity: 1,
        basePriceCents: 2000,
        modifiers: [],
        subtotalCents: 2000,
      },
    ], 10, 500);

    expect(summary.subtotalCents).toBe(2000);
    // (2000 - 500) = 1500; 10% tax = 150; total = 1650
    expect(summary.taxCents).toBe(150);
    expect(summary.totalCents).toBe(1650);
  });

  it("handles client-side supabase error gracefully when offline", async () => {
    const res = await fetchPersistedOrders({ orgId: "mock-org", locationId: "loc-1" });
    expect(Array.isArray(res.orders)).toBe(true);
  });
});
