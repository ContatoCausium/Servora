import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateDreStatement,
  calculateProductMargins,
  calculateCategoryMargins,
  computeFinanceSummary,
  formatUsd,
  type Expense,
} from "../lib/finance-service";

describe("Finance Service - Formulas & DRE Audit", () => {
  const sampleExpenses: Expense[] = [
    {
      id: "e1",
      orgId: "org-1",
      locationId: "loc-1",
      category: "rent",
      recurrence: "fixed",
      status: "paid",
      description: "Commercial Space Lease",
      amountCents: 500000, // $5,000.00
      currency: "usd",
      dueDate: "2025-05-01",
      competencyDate: "2025-05-01",
      responsiblePerson: "Manager",
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "e2",
      orgId: "org-1",
      locationId: "loc-1",
      category: "utilities",
      recurrence: "variable",
      status: "pending",
      description: "Electric power",
      amountCents: 150000, // $1,500.00
      currency: "usd",
      dueDate: "2025-05-15",
      competencyDate: "2025-05-01",
      responsiblePerson: "Manager",
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "e3",
      orgId: "org-1",
      locationId: "loc-1",
      category: "marketing",
      recurrence: "variable",
      status: "pending",
      description: "Simulated local promo experiment",
      amountCents: 80000, // $800.00
      currency: "usd",
      dueDate: "2025-05-20",
      competencyDate: "2025-05-01",
      responsiblePerson: "Lead",
      isSimulation: true, // Should be ignored in real OpEx
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("calculates DRE statement line items correctly with real sales", () => {
    const realSalesCents = 2000000; // $20,000.00
    const discountsCents = 100000;  // $1,000.00
    const taxesCents = 165000;      // $1,650.00
    const cogsCents = 550000;       // $5,500.00
    const simulatedSalesCents = 300000; // $3,000.00

    const dre = calculateDreStatement(
      realSalesCents,
      discountsCents,
      taxesCents,
      cogsCents,
      sampleExpenses,
      simulatedSalesCents
    );

    // Net revenue = 2000000 - 100000 - 165000 = 1735000 ($17,350)
    expect(dre.netRevenueCents).toBe(1735000);
    // Gross profit = Net revenue - COGS = 1735000 - 550000 = 1185000 ($11,850)
    expect(dre.grossProfitCents).toBe(1185000);
    // OpEx ignores e3 (simulation). e1 (500000) + e2 (150000) = 650000 ($6,500)
    expect(dre.operatingExpensesCents).toBe(650000);
    // Net profit = Gross profit - OpEx = 1185000 - 650000 = 535000 ($5,350)
    expect(dre.estimatedNetProfitCents).toBe(535000);

    // Segregation check: simulated sales must not blend into gross revenue
    expect(dre.grossRevenueCents).toBe(2000000);
    expect(dre.simulatedGrossRevenueCents).toBe(300000);
  });

  it("triggers alerts when COGS exceeds 35% or margin drops below 60%", () => {
    const netSales = 1000000;
    const highCogs = 450000; // 45% COGS -> triggers alert
    const dre = calculateDreStatement(netSales, 0, 0, highCogs, []);

    expect(dre.cogsPct).toBe(45);
    expect(dre.grossMarginPct).toBe(55); // < 60% -> triggers second alert
    expect(dre.alertsCount).toBeGreaterThanOrEqual(2);
  });

  it("computes product margin metrics with health badges", () => {
    const items = [
      {
        id: "p1",
        name: "Smash Burger",
        category: "Burgers",
        priceCents: 1500, // $15.00
        recipeCostCents: 400, // $4.00 (26.6% COGS -> healthy)
        unitsSold: 10,
      },
      {
        id: "p2",
        name: "Special Ribeye Sandwich",
        category: "Burgers",
        priceCents: 2000, // $20.00
        recipeCostCents: 850, // $8.50 (42.5% COGS -> high cost alert)
        unitsSold: 5,
      },
    ];

    const margins = calculateProductMargins(items);
    expect(margins).toHaveLength(2);

    const p1 = margins[0]!;
    expect(p1.revenueCents).toBe(15000);
    expect(p1.cogsCents).toBe(4000);
    expect(p1.grossProfitCents).toBe(11000);
    expect(p1.hasHighCostAlert).toBe(false);

    const p2 = margins[1]!;
    expect(p2.hasHighCostAlert).toBe(true);
  });

  it("aggregates category margins accurately", () => {
    const productMargins = [
      {
        productId: "1",
        productName: "A",
        category: "Food",
        unitsSold: 1,
        revenueCents: 10000,
        cogsCents: 3000,
        grossProfitCents: 7000,
        grossMarginPct: 70,
        cogsPct: 30,
        hasHighCostAlert: false,
        hasLowMarginAlert: false,
      },
      {
        productId: "2",
        productName: "B",
        category: "Drinks",
        unitsSold: 1,
        revenueCents: 5000,
        cogsCents: 1000,
        grossProfitCents: 4000,
        grossMarginPct: 80,
        cogsPct: 20,
        hasHighCostAlert: false,
        hasLowMarginAlert: false,
      },
    ];

    const catMargins = calculateCategoryMargins(productMargins);
    expect(catMargins).toHaveLength(2);
    const food = catMargins.find((c) => c.category === "Food");
    expect(food?.revenueCents).toBe(10000);
    expect(food?.grossProfitCents).toBe(7000);
    expect(food?.grossMarginPct).toBe(70);
  });

  it("formats USD values with negative sign and thousands separator", () => {
    expect(formatUsd(150050)).toBe("$1,500.50");
    expect(formatUsd(-32000)).toBe("-$320.00");
    expect(formatUsd(0)).toBe("$0.00");
  });
});
