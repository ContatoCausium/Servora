import { describe, it, expect } from "vitest";
import {
  computeFinanceSummary,
  buildCashFlowTimeline,
  formatUsd,
  type Expense,
} from "../lib/finance-service";

describe("Finance Service - Phase 5.3 (DRE & Margins)", () => {
  const sampleExpenses: Expense[] = [
    {
      id: "e1",
      orgId: "org-1",
      locationId: "loc-1",
      category: "rent",
      recurrence: "fixed",
      status: "paid",
      description: "Rent",
      amountCents: 500000,
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
      category: "ingredients",
      recurrence: "variable",
      status: "pending",
      description: "Beef wholesale",
      amountCents: 200000,
      currency: "usd",
      dueDate: "2025-05-10",
      competencyDate: "2025-05-01",
      responsiblePerson: "Chef",
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "e3",
      orgId: "org-1",
      locationId: "loc-1",
      category: "taxes",
      recurrence: "fixed",
      status: "overdue",
      description: "City tax",
      amountCents: 50000,
      currency: "usd",
      dueDate: "2025-04-15",
      competencyDate: "2025-04-01",
      responsiblePerson: "Accountant",
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("computes summary segregating fixed and variable and calculating margin", () => {
    const res = computeFinanceSummary(sampleExpenses, 1000000, 250000, 2000000);
    expect(res.fixedExpensesCents).toBe(550000);
    expect(res.variableExpensesCents).toBe(200000);
    expect(res.totalExpensesCents).toBe(750000);
    expect(res.paidCents).toBe(500000);
    expect(res.pendingPayablesCents).toBe(200000);
    expect(res.overduePayablesCents).toBe(50000);
    expect(res.estimatedNetCents).toBe(250000); // 1,000,000 - 750,000
    expect(res.marginPercent).toBe(25);
    expect(res.initialCashBalanceCents).toBe(2000000);
    expect(res.closingCashBalanceCents).toBe(2500000); // 2,000,000 + 1,000,000 - 500,000 (paid)
  });

  it("constructs cash flow timeline with granularity buckets", () => {
    const timeline = buildCashFlowTimeline(sampleExpenses, 1200000, "monthly", 1000000);
    expect(timeline.buckets.length).toBe(6);
    expect(timeline.initialOpeningCents).toBe(1000000);
    expect(timeline.totalInflowCents).toBeGreaterThan(0);
    expect(timeline.totalOutflowCents).toBeGreaterThan(0);
  });

  it("formats negative and positive USD values accurately", () => {
    expect(formatUsd(125050)).toBe("$1,250.50");
    expect(formatUsd(-35000)).toBe("-$350.00");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("calculates managerial DRE statement correctly with COGS, OpEx and Margins", () => {
    const dre = calculateDreStatement(
      1000000, // $10,000 gross revenue
      20000,   // $200 discounts
      80000,   // $800 taxes
      270000,  // $2,700 COGS (30% of net)
      sampleExpenses,
      150000   // $1,500 simulated sales (must be excluded from net revenue)
    );

    expect(dre.grossRevenueCents).toBe(1000000);
    expect(dre.netRevenueCents).toBe(900000); // 1,000,000 - 20,000 - 80,000
    expect(dre.cogsCents).toBe(270000);
    expect(dre.grossProfitCents).toBe(630000); // 900,000 - 270,000
    expect(dre.grossMarginPct).toBe(70); // 630k / 900k = 70%
    expect(dre.simulatedGrossRevenueCents).toBe(150000);
    expect(dre.operatingProfitCents).toBeLessThan(dre.grossProfitCents);
  });

  it("evaluates product margins and identifies high cost / low margin alerts", () => {
    const products = [
      { id: "p1", name: "Prime Burger", category: "Burgers", priceCents: 1500, recipeCostCents: 600, unitsSold: 10 }, // COGS 40% -> alert
      { id: "p2", name: "Fries", category: "Sides", priceCents: 500, recipeCostCents: 100, unitsSold: 20 }, // COGS 20% -> healthy
    ];

    const margins = calculateProductMargins(products);
    expect(margins[0]?.hasHighCostAlert).toBe(true);
    expect(margins[1]?.hasHighCostAlert).toBe(false);
    expect(margins[1]?.grossMarginPct).toBe(80);
  });
});
