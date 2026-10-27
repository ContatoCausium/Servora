export type ExpenseRecurrence = "fixed" | "variable" | "recurring";
export type ExpenseStatus = "pending" | "paid" | "overdue";
export type ExpenseCategory =
  | "suppliers"
  | "taxes"
  | "rent"
  | "payroll"
  | "utilities"
  | "ingredients"
  | "maintenance"
  | "marketing"
  | "other";

export interface Expense {
  id: string;
  orgId: string;
  locationId: string;
  category: ExpenseCategory;
  recurrence: ExpenseRecurrence;
  status: ExpenseStatus;
  supplierName?: string;
  description: string;
  amountCents: number;
  currency: "usd";
  dueDate: string;
  paidAt?: string;
  competencyDate: string;
  responsiblePerson: string;
  receiptAttachment?: string;
  isSimulation: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CashFlowGranularity = "daily" | "weekly" | "monthly";
export type TransactionKind = "inflow" | "outflow";
export type EntryOrigin = "pos_orders" | "purchase_orders" | "manual_expense" | "manual_revenue";
export type RealizationStatus = "realized" | "projected" | "simulated";

export interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  kind: TransactionKind;
  amountCents: number;
  status: RealizationStatus;
  origin: EntryOrigin;
  category: string;
  responsiblePerson?: string;
  paymentMethod?: string;
  referenceDoc?: string;
}

export interface CashFlowBucket {
  label: string;
  initialBalanceCents: number;
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  finalBalanceCents: number;
  entriesCount: number;
}

export interface CashFlowTimeline {
  granularity: CashFlowGranularity;
  buckets: CashFlowBucket[];
  totalInflowCents: number;
  totalOutflowCents: number;
  netOperatingCents: number;
  initialOpeningCents: number;
  closingCashCents: number;
}

export interface FinanceSummary {
  totalRevenueCents: number;
  simulatedRevenueCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  totalExpensesCents: number;
  estimatedNetCents: number;
  marginPercent: number;
  pendingPayablesCents: number;
  overduePayablesCents: number;
  paidCents: number;
  receivablesPendingCents: number;
  initialCashBalanceCents: number;
  closingCashBalanceCents: number;
}

export interface MonthlyTrend {
  month: string;
  revenueCents: number;
  expensesCents: number;
  netProfitCents: number;
}

export interface ProductMarginMetric {
  productId: string;
  productName: string;
  category: string;
  unitsSold: number;
  revenueCents: number;
  cogsCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  cogsPct: number;
  hasHighCostAlert: boolean;
  hasLowMarginAlert: boolean;
}

export interface CategoryMarginMetric {
  category: string;
  revenueCents: number;
  cogsCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  cogsPct: number;
}

export interface DreStatement {
  grossRevenueCents: number;
  discountsCents: number;
  taxesCents: number;
  netRevenueCents: number;
  cogsCents: number;
  grossProfitCents: number;
  grossMarginPct: number;
  operatingExpensesCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  operatingProfitCents: number;
  operatingMarginPct: number;
  estimatedNetProfitCents: number;
  netMarginPct: number;
  simulatedGrossRevenueCents: number;
  projectedExpensesCents: number;
  alertsCount: number;
}

const EXPENSES_STORAGE_KEY = "servora.finance.expenses.v1";

function getStorage(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) return seedDefaultExpenses();
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setStorage(items: Expense[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(items));
}

export function seedDefaultExpenses(): Expense[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");

  const defaults: Expense[] = [
    {
      id: "exp-001",
      orgId: "default",
      locationId: "all",
      category: "rent",
      recurrence: "fixed",
      status: "paid",
      supplierName: "Midtown Real Estate Partners",
      description: "Main dining room commercial lease",
      amountCents: 650000,
      currency: "usd",
      dueDate: `${y}-${m}-01`,
      paidAt: `${y}-${m}-01T12:00:00Z`,
      competencyDate: `${y}-${m}-01`,
      responsiblePerson: "Operations Team",
      receiptAttachment: "data:application/pdf;base64,demo-lease-receipt",
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "exp-002",
      orgId: "default",
      locationId: "all",
      category: "payroll",
      recurrence: "recurring",
      status: "paid",
      supplierName: "ADP TotalSource",
      description: "Kitchen and Front-of-House Bi-weekly payroll",
      amountCents: 1240000,
      currency: "usd",
      dueDate: `${y}-${m}-15`,
      paidAt: `${y}-${m}-15T09:30:00Z`,
      competencyDate: `${y}-${m}-01`,
      responsiblePerson: "Finance Dept",
      receiptAttachment: undefined,
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "exp-003",
      orgId: "default",
      locationId: "all",
      category: "suppliers",
      recurrence: "variable",
      status: "pending",
      supplierName: "Sysco Wholesale Foods",
      description: "Weekly meat and dairy replenishment delivery",
      amountCents: 345000,
      currency: "usd",
      dueDate: `${y}-${m}-28`,
      competencyDate: `${y}-${m}-01`,
      responsiblePerson: "Kitchen Lead",
      receiptAttachment: undefined,
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "exp-004",
      orgId: "default",
      locationId: "all",
      category: "utilities",
      recurrence: "fixed",
      status: "pending",
      supplierName: "ConEdison Power & Gas",
      description: "Electric power commercial account",
      amountCents: 142000,
      currency: "usd",
      dueDate: `${y}-${m}-25`,
      competencyDate: `${y}-${m}-01`,
      responsiblePerson: "Store Manager",
      receiptAttachment: undefined,
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "exp-005",
      orgId: "default",
      locationId: "all",
      category: "taxes",
      recurrence: "fixed",
      status: "overdue",
      supplierName: "State Dept of Revenue",
      description: "Quarterly sales tax filing balance",
      amountCents: 215000,
      currency: "usd",
      dueDate: `${y}-${m}-10`,
      competencyDate: `${y}-${m}-01`,
      responsiblePerson: "CFO",
      receiptAttachment: undefined,
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "exp-006",
      orgId: "default",
      locationId: "all",
      category: "ingredients",
      recurrence: "variable",
      status: "paid",
      supplierName: "Fresh Produce Express",
      description: "Organic vegetables and salad greens wholesale lot",
      amountCents: 98000,
      currency: "usd",
      dueDate: `${y}-${m}-12`,
      paidAt: `${y}-${m}-12T14:10:00Z`,
      competencyDate: `${y}-${m}-01`,
      responsiblePerson: "Sous Chef",
      receiptAttachment: undefined,
      isSimulation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  if (typeof window !== "undefined") {
    setStorage(defaults);
  }
  return defaults;
}

export function listExpenses(orgId: string, locationId?: string): Expense[] {
  const all = getStorage();
  return all.filter((exp) => {
    const matchOrg = exp.orgId === orgId || exp.orgId === "default";
    if (!matchOrg) return false;
    if (locationId && locationId !== "all" && exp.locationId !== "all" && exp.locationId !== locationId) {
      return false;
    }
    return true;
  });
}

export function saveExpense(expense: Omit<Expense, "id" | "createdAt" | "updatedAt"> & { id?: string }): Expense {
  const all = getStorage();
  const isEdit = !!expense.id;
  const id = expense.id ?? `exp-${Date.now()}`;
  const now = new Date().toISOString();

  const nextItem: Expense = {
    ...expense,
    id,
    createdAt: isEdit ? (all.find((i) => i.id === id)?.createdAt ?? now) : now,
    updatedAt: now,
  };

  const filtered = all.filter((i) => i.id !== id);
  const updatedList = [nextItem, ...filtered];
  setStorage(updatedList);
  return nextItem;
}

export function deleteExpense(expenseId: string): boolean {
  const all = getStorage();
  const filtered = all.filter((i) => i.id !== expenseId);
  if (filtered.length === all.length) return false;
  setStorage(filtered);
  return true;
}

export function updateExpenseStatus(expenseId: string, status: ExpenseStatus): Expense | null {
  const all = getStorage();
  const idx = all.findIndex((i) => i.id === expenseId);
  if (idx === -1) return null;

  const existing = all[idx];
  if (!existing) return null;

  const updated: Expense = {
    ...existing,
    status,
    paidAt: status === "paid" ? new Date().toISOString() : undefined,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  setStorage(all);
  return updated;
}

export function computeFinanceSummary(
  expenses: Expense[],
  realSalesCents = 0,
  simulatedSalesCents = 0,
  initialOpeningCents = 1500000,
  receivablesPendingCents = 0
): FinanceSummary {
  let fixed = 0;
  let variable = 0;
  let pending = 0;
  let overdue = 0;
  let paid = 0;

  for (const exp of expenses) {
    if (exp.recurrence === "fixed") {
      fixed += exp.amountCents;
    } else {
      variable += exp.amountCents;
    }

    if (exp.status === "paid") {
      paid += exp.amountCents;
    } else if (exp.status === "overdue") {
      overdue += exp.amountCents;
    } else {
      pending += exp.amountCents;
    }
  }

  const totalExpenses = fixed + variable;
  const estimatedNet = realSalesCents - totalExpenses;
  const margin = realSalesCents > 0 ? (estimatedNet / realSalesCents) * 100 : 0;
  const closingCash = initialOpeningCents + realSalesCents - paid;

  return {
    totalRevenueCents: realSalesCents,
    simulatedRevenueCents: simulatedSalesCents,
    fixedExpensesCents: fixed,
    variableExpensesCents: variable,
    totalExpensesCents: totalExpenses,
    estimatedNetCents: estimatedNet,
    marginPercent: margin,
    pendingPayablesCents: pending,
    overduePayablesCents: overdue,
    paidCents: paid,
    receivablesPendingCents,
    initialCashBalanceCents: initialOpeningCents,
    closingCashBalanceCents: closingCash,
  };
}

export function buildCashFlowTimeline(
  expenses: Expense[],
  realSalesCents: number,
  granularity: CashFlowGranularity = "monthly",
  startingCashCents = 1500000
): CashFlowTimeline {
  let runningBalance = startingCashCents;
  const bucketLabels = granularity === "daily"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : granularity === "weekly"
    ? ["Week 1", "Week 2", "Week 3", "Week 4"]
    : ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];

  const stepFactor = 1 / bucketLabels.length;
  const buckets: CashFlowBucket[] = bucketLabels.map((lbl, idx) => {
    const initial = runningBalance;
    const inflow = Math.round(realSalesCents * stepFactor * (0.85 + (idx % 3) * 0.15));
    const paidExpensesTotal = expenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amountCents, 0);
    const outflow = Math.round(paidExpensesTotal * stepFactor * (0.9 + ((idx + 1) % 2) * 0.12));
    const net = inflow - outflow;
    const final = initial + net;
    runningBalance = final;

    return {
      label: lbl,
      initialBalanceCents: initial,
      inflowCents: inflow,
      outflowCents: outflow,
      netCents: net,
      finalBalanceCents: final,
      entriesCount: Math.max(1, Math.round(expenses.length * stepFactor)),
    };
  });

  const totalInflow = buckets.reduce((acc, b) => acc + b.inflowCents, 0);
  const totalOutflow = buckets.reduce((acc, b) => acc + b.outflowCents, 0);

  return {
    granularity,
    buckets,
    totalInflowCents: totalInflow,
    totalOutflowCents: totalOutflow,
    netOperatingCents: totalInflow - totalOutflow,
    initialOpeningCents: startingCashCents,
    closingCashCents: runningBalance,
  };
}

export function generateMonthlyTrend(currentExpensesCents: number, currentRevenueCents: number): MonthlyTrend[] {
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const factors = [0.85, 0.9, 0.96, 1.02, 0.98, 1.0];

  return months.map((m, idx) => {
    const factor = factors[idx] ?? 1.0;
    const rev = Math.round(currentRevenueCents * factor);
    const exp = Math.round(currentExpensesCents * (factor * 0.95));
    return {
      month: m,
      revenueCents: rev,
      expensesCents: exp,
      netProfitCents: rev - exp,
    };
  });
}

export function calculateDreStatement(
  realSalesCents: number,
  discountsCents: number,
  taxesCents: number,
  cogsCents: number,
  expenses: Expense[],
  simulatedSalesCents = 0
): DreStatement {
  const grossRevenueCents = Math.max(0, realSalesCents);
  const netRevenueCents = Math.max(0, grossRevenueCents - Math.max(0, discountsCents) - Math.max(0, taxesCents));
  const safeCogsCents = Math.max(0, cogsCents);
  const grossProfitCents = netRevenueCents - safeCogsCents;
  const grossMarginPct = netRevenueCents > 0 ? (grossProfitCents / netRevenueCents) * 100 : 0;

  let fixedExp = 0;
  let varExp = 0;
  let projExp = 0;

  for (const exp of expenses) {
    if (exp.isSimulation) continue;
    if (exp.category === "ingredients" || exp.category === "suppliers") continue; // Exclude direct COGS from OpEx
    if (exp.recurrence === "fixed") {
      fixedExp += exp.amountCents;
    } else {
      varExp += exp.amountCents;
    }
    if (exp.status === "pending" || exp.status === "overdue") {
      projExp += exp.amountCents;
    }
  }

  const operatingExpensesCents = fixedExp + varExp;
  const operatingProfitCents = grossProfitCents - operatingExpensesCents;
  const operatingMarginPct = netRevenueCents > 0 ? (operatingProfitCents / netRevenueCents) * 100 : 0;
  const estimatedNetProfitCents = operatingProfitCents;
  const netMarginPct = netRevenueCents > 0 ? (estimatedNetProfitCents / netRevenueCents) * 100 : 0;

  let alerts = 0;
  if (netRevenueCents > 0 && (safeCogsCents / netRevenueCents) > 0.35) alerts += 1;
  if (grossMarginPct < 60 && netRevenueCents > 0) alerts += 1;

  return {
    grossRevenueCents,
    discountsCents: Math.max(0, discountsCents),
    taxesCents: Math.max(0, taxesCents),
    netRevenueCents,
    cogsCents: safeCogsCents,
    grossProfitCents,
    grossMarginPct,
    operatingExpensesCents,
    fixedExpensesCents: fixedExp,
    variableExpensesCents: varExp,
    operatingProfitCents,
    operatingMarginPct,
    estimatedNetProfitCents,
    netMarginPct,
    simulatedGrossRevenueCents: Math.max(0, simulatedSalesCents),
    projectedExpensesCents: projExp,
    alertsCount: alerts,
  };
}

export function calculateProductMargins(
  products: Array<{ id: string; name: string; category?: string; priceCents: number; recipeCostCents?: number; unitsSold?: number }>
): ProductMarginMetric[] {
  return products.map((p) => {
    const units = p.unitsSold ?? 1;
    const unitPrice = p.priceCents;
    const unitCost = p.recipeCostCents ?? Math.round(unitPrice * 0.28);
    const rev = unitPrice * units;
    const cogs = unitCost * units;
    const gross = rev - cogs;
    const marginPct = rev > 0 ? (gross / rev) * 100 : 0;
    const cogsPct = rev > 0 ? (cogs / rev) * 100 : 0;

    return {
      productId: p.id,
      productName: p.name,
      category: p.category || "General",
      unitsSold: units,
      revenueCents: rev,
      cogsCents: cogs,
      grossProfitCents: gross,
      grossMarginPct: marginPct,
      cogsPct,
      hasHighCostAlert: cogsPct > 35,
      hasLowMarginAlert: marginPct < 60,
    };
  });
}

export function calculateCategoryMargins(productMetrics: ProductMarginMetric[]): CategoryMarginMetric[] {
  const grouped = new Map<string, { rev: number; cogs: number; gross: number }>();

  for (const m of productMetrics) {
    const cat = m.category || "General";
    const cur = grouped.get(cat) ?? { rev: 0, cogs: 0, gross: 0 };
    cur.rev += m.revenueCents;
    cur.cogs += m.cogsCents;
    cur.gross += m.grossProfitCents;
    grouped.set(cat, cur);
  }

  return Array.from(grouped.entries()).map(([category, val]) => ({
    category,
    revenueCents: val.rev,
    cogsCents: val.cogs,
    grossProfitCents: val.gross,
    grossMarginPct: val.rev > 0 ? (val.gross / val.rev) * 100 : 0,
    cogsPct: val.rev > 0 ? (val.cogs / val.rev) * 100 : 0,
  }));
}

export function formatUsd(cents: number): string {
  const abs = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
