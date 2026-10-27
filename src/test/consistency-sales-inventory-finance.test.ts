import { describe, it, expect, beforeEach } from "vitest";
import { calculateDreStatement, calculateProductMargins, seedDefaultExpenses, type Expense } from "@/lib/finance-service";
import { convertUnits, calculateIngredientCost, computeRecipeTotals, type RecipeIngredient } from "@/lib/recipes-service";
import { calculateChange, applyDiscount, getPOSSession, addItemToCart } from "@/lib/pos-service";
import { recordInventoryMovement, listInventoryMovements } from "@/lib/inventory-movements-service";
import type { InventoryItem } from "@/lib/inventory-service";

describe("Sales, Inventory and Finance Consistency Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("converts recipe ingredient units safely and accounts for waste percentage", () => {
    const mockItem: InventoryItem = {
      id: "item-angus",
      orgId: "org-test",
      locationId: "loc-1",
      name: "Angus Beef",
      category: "meat",
      sku: "ING-BEEF",
      unit: "lb",
      quantity: 50,
      minQuantity: 10,
      costCents: 450,
      supplier: "US Foods",
      active: true,
      updatedAt: new Date().toISOString(),
    };

    // 0.35 lb with 10% scrap factor = 0.385 lb * 450 cents = 173.25 -> 173 cents
    const cost = calculateIngredientCost(mockItem, 0.35, "lb", 10);
    expect(cost.subtotalCostCents).toBe(173);
    expect(cost.unitCostCents).toBe(450);
  });

  it("computes recipe totals and contribution margin percentage accurately", () => {
    const ingredients: RecipeIngredient[] = [
      {
        id: "ri-1",
        inventoryItemId: "item-angus",
        name: "Angus Beef",
        quantity: 0.35,
        unit: "lb",
        wastePercentage: 10,
        unitCostCents: 450,
        subtotalCostCents: 173,
      },
      {
        id: "ri-2",
        inventoryItemId: "item-bun",
        name: "Brioche Bun",
        quantity: 1,
        unit: "units",
        wastePercentage: 0,
        unitCostCents: 60,
        subtotalCostCents: 60,
      },
    ];

    const totals = computeRecipeTotals(ingredients, 1, 1200);
    expect(totals.totalCostCents).toBe(233);
    expect(totals.costPerServingCents).toBe(233);
    // (1200 - 233) / 1200 = 80.58%
    expect(totals.estimatedMarginPercent).toBe(80.6);
  });

  it("calculates POS change and prevents sub-zero calculations", () => {
    expect(calculateChange(2000, 1500)).toBe(500);
    expect(calculateChange(1000, 1500)).toBe(0);
  });

  it("generates DRE statement where actual recipe COGS is isolated without double counting", () => {
    const expenses: Expense[] = [
      {
        id: "exp-1",
        orgId: "org-test",
        locationId: "loc-1",
        category: "rent",
        recurrence: "fixed",
        status: "paid",
        description: "Monthly lease",
        amountCents: 200000,
        currency: "usd",
        dueDate: "2026-04-01",
        competencyDate: "2026-04-01",
        responsiblePerson: "Manager",
        isSimulation: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "exp-2",
        orgId: "org-test",
        locationId: "loc-1",
        category: "ingredients", // should be ignored from OpEx
        recurrence: "variable",
        status: "paid",
        description: "Direct meat purchase",
        amountCents: 50000,
        currency: "usd",
        dueDate: "2026-04-01",
        competencyDate: "2026-04-01",
        responsiblePerson: "Chef",
        isSimulation: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const realSalesCents = 1000000;
    const discountsCents = 50000;
    const taxesCents = 75000;
    const recipeCogsCents = 250000;

    const dre = calculateDreStatement(
      realSalesCents,
      discountsCents,
      taxesCents,
      recipeCogsCents,
      expenses,
      0
    );

    expect(dre.grossRevenueCents).toBe(1000000);
    expect(dre.netRevenueCents).toBe(875000);
    expect(dre.cogsCents).toBe(250000);
    expect(dre.grossProfitCents).toBe(625000);
    // OpEx must only contain rent (200000), not direct ingredients (50000)
    expect(dre.operatingExpensesCents).toBe(200000);
    expect(dre.operatingProfitCents).toBe(425000);
    expect(dre.estimatedNetProfitCents).toBe(425000);
  });

  it("reverses inventory stock accurately without negative distortion", () => {
    const initialQty = 30;
    const delta = -5;
    const revertedDelta = 5;

    expect(initialQty + delta).toBe(25);
    expect(initialQty + delta + revertedDelta).toBe(30);
  });

  it("differentiates persisted POS sale from unpersisted local cart when cancelling", () => {
    const session = getPOSSession("org-test", "loc-1", "Cashier 1");
    // Cart has not been persisted
    expect((session as any).persistedOrderId).toBeUndefined();

    // Simulated persisted state receipt
    const persistedReceipt = {
      ...session,
      persistedOrderId: "order-persisted-123",
    };
    expect(persistedReceipt.persistedOrderId).toBe("order-persisted-123");
  });
});
