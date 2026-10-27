import { describe, it, expect } from "vitest";
import {
  computeFinanceSummary,
  buildCashFlowTimeline,
  formatUsd,
  type Expense,
} from "../lib/finance-service";

describe("Finance Service - Phase 5.2", () => {
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
});
