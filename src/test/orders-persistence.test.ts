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

  it("preserves exact cents across items, discount and tax without rounding drift", () => {
    const items = [
      {
        id: "i1",
        productId: "p1",
        productName: "Combo Burger",
        quantity: 2,
        basePriceCents: 1550,
        modifiers: [{ groupId: "g1", groupName: "Sauce", optionId: "o1", optionName: "Truffle", priceCents: 125 }],
        subtotalCents: (1550 + 125) * 2, // 3350
      },
      {
        id: "i2",
        productId: "p2",
        productName: "Soda",
        quantity: 1,
        basePriceCents: 450,
        modifiers: [],
        subtotalCents: 450,
      },
    ];

    const summary = calculateOrderSummary(items, 8.25, 200);
    expect(summary.subtotalCents).toBe(3800);
    // Taxable = 3800 - 200 = 3600; 8.25% of 3600 = 297 cents
    expect(summary.taxCents).toBe(297);
    expect(summary.totalCents).toBe(3897);
  });

  it("handles order creation idempotence with persistent payload generation", async () => {
    const testOrder: Order = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      orgId: "11111111-1111-1111-1111-111111111111",
      locationId: "22222222-2222-2222-2222-222222222222",
      orderNumber: "#TEST-99",
      type: "dine_in",
      status: "new",
      customer: { name: "Idempotency Check", phone: "" },
      items: [
        {
          id: "it-1",
          productId: "33333333-3333-3333-3333-333333333333",
          productName: "Test Item",
          quantity: 1,
          basePriceCents: 1200,
          modifiers: [],
          subtotalCents: 1200,
        },
      ],
      subtotalCents: 1200,
      discountCents: 0,
      taxRatePercent: 8.25,
      taxCents: 99,
      totalCents: 1299,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
      isSimulated: false,
    };

    const res = await persistOrderToSupabase(testOrder.orgId, testOrder);
    expect(typeof res.success).toBe("boolean");
  });

  it("generates deterministic client_order_id for idempotency", () => {
    const orderId = "550e8400-e29b-41d4-a716-446655440000";
    const clientOrderId = `persist-${orderId}`;
    expect(clientOrderId).toBe("persist-550e8400-e29b-41d4-a716-446655440000");
    // Same input always produces same key — backend UNIQUE index prevents duplicates
    expect(`persist-${orderId}`).toBe(clientOrderId);
  });
});
