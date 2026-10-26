import { describe, it, expect } from "vitest";
import {
  calculatePOSSummary,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  applyDiscount,
  simulatePayment,
  type POSSession,
} from "../lib/pos-service";
import type { MenuItem } from "../lib/menu-service";

describe("POS Service calculations & workflow", () => {
  const sampleItem: MenuItem = {
    id: "item-1",
    orgId: "org-marao",
    name: "Smash Cheeseburger",
    description: "Double beef patty with melted cheddar",
    category: "Burgers",
    priceCents: 1200,
    taxPercent: 8.875,
    available: true,
  };

  const initialSession: POSSession = {
    id: "pos-session-1",
    orgId: "org-marao",
    locationId: "loc-1",
    cashierName: "John Doe",
    orderType: "dine_in",
    cart: [],
    subtotalCents: 0,
    discountCents: 0,
    taxRatePercent: 8.875,
    taxCents: 0,
    totalCents: 0,
    status: "active",
    suspendedSessions: [],
  };

  it("calculates subtotal, tax and grand total correctly", () => {
    const summary = calculatePOSSummary(
      [
        {
          id: "ci-1",
          productId: "item-1",
          productName: "Smash Cheeseburger",
          quantity: 2,
          basePriceCents: 1200,
          modifiers: [],
          subtotalCents: 2400,
        },
      ],
      8.875,
      0
    );

    expect(summary.subtotalCents).toBe(2400);
    // 2400 * 0.08875 = 213
    expect(summary.taxCents).toBe(213);
    expect(summary.totalCents).toBe(2613);
  });

  it("applies discounts before calculating tax", () => {
    const summary = calculatePOSSummary(
      [
        {
          id: "ci-1",
          productId: "item-1",
          productName: "Smash Cheeseburger",
          quantity: 2,
          basePriceCents: 1200,
          modifiers: [],
          subtotalCents: 2400,
        },
      ],
      8.875,
      400 // $4.00 discount
    );

    expect(summary.subtotalCents).toBe(2400);
    // taxable = 2400 - 400 = 2000; tax = 2000 * 0.08875 = 177.5 => 178
    expect(summary.taxCents).toBe(178);
    expect(summary.totalCents).toBe(2178);
  });

  it("adds item to cart with modifiers accurately", () => {
    const sessionWithItem = addItemToCart(
      initialSession,
      sampleItem,
      [
        {
          groupId: "mg-1",
          groupName: "Extras",
          optionId: "opt-bacon",
          optionName: "Bacon",
          priceCents: 200,
        },
      ],
      1
    );

    expect(sessionWithItem.cart.length).toBe(1);
    expect(sessionWithItem.cart[0]?.subtotalCents).toBe(1400); // 1200 + 200
    expect(sessionWithItem.subtotalCents).toBe(1400);
  });

  it("calculates cash change due accurately", () => {
    const session: POSSession = {
      ...initialSession,
      subtotalCents: 2000,
      taxCents: 178,
      totalCents: 2178,
    };

    const paid = simulatePayment(session, "cash", 2500);
    expect(paid.changeDueCents).toBe(322); // 2500 - 2178 = 322 cents ($3.22)
  });
});
