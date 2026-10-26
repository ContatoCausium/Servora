import { MenuItem } from "./menu-service";
import { Order, OrderItem, OrderType, SelectedModifier, calculateOrderSummary, saveOrder } from "./orders-service";

export type PaymentMethod = "cash" | "card_simulated" | "digital_wallet_simulated";

export interface PosCartItem extends OrderItem {}

export interface SuspendedSale {
  id: string;
  orgId: string;
  locationId: string;
  note?: string;
  suspendedAt: string;
  orderType: OrderType;
  attendantName: string;
  customerName?: string;
  items: PosCartItem[];
  discountCents: number;
  taxRatePercent: number;
}

export interface CompletedPosSale {
  id: string;
  orderNumber: string;
  orgId: string;
  locationId: string;
  attendantName: string;
  orderType: OrderType;
  customerName?: string;
  items: PosCartItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  tenderedCents: number;
  changeCents: number;
  createdAt: string;
  isSimulated: boolean;
}

const SUSPENDED_STORAGE_PREFIX = "servora.pos.suspended.";
const HISTORY_STORAGE_PREFIX = "servora.pos.history.";

export function calculateChange(tenderedCents: number, totalCents: number): number {
  return Math.max(0, tenderedCents - totalCents);
}

export function listSuspendedSales(orgId: string, locationId?: string): SuspendedSale[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(`${SUSPENDED_STORAGE_PREFIX}${orgId}`);
  let sales: SuspendedSale[] = [];
  if (raw) {
    try {
      sales = JSON.parse(raw) as SuspendedSale[];
    } catch {
      sales = [];
    }
  }
  if (locationId && locationId !== "all") {
    return sales.filter((s) => s.locationId === locationId || s.locationId === "loc-1");
  }
  return sales;
}

export function suspendSale(orgId: string, sale: SuspendedSale): SuspendedSale[] {
  const existing = listSuspendedSales(orgId);
  const updated = [sale, ...existing];
  if (typeof window !== "undefined") {
    localStorage.setItem(`${SUSPENDED_STORAGE_PREFIX}${orgId}`, JSON.stringify(updated));
  }
  return updated;
}

export function removeSuspendedSale(orgId: string, saleId: string): SuspendedSale[] {
  const existing = listSuspendedSales(orgId);
  const updated = existing.filter((s) => s.id !== saleId);
  if (typeof window !== "undefined") {
    localStorage.setItem(`${SUSPENDED_STORAGE_PREFIX}${orgId}`, JSON.stringify(updated));
  }
  return updated;
}

export function listPosHistory(orgId: string, locationId?: string): CompletedPosSale[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(`${HISTORY_STORAGE_PREFIX}${orgId}`);
  let list: CompletedPosSale[] = [];
  if (raw) {
    try {
      list = JSON.parse(raw) as CompletedPosSale[];
    } catch {
      list = [];
    }
  }
  if (locationId && locationId !== "all") {
    return list.filter((s) => s.locationId === locationId || s.locationId === "loc-1");
  }
  return list;
}

export function recordCompletedSale(
  orgId: string,
  sale: CompletedPosSale
): { posHistory: CompletedPosSale[]; createdOrder: Order } {
  const existingHistory = listPosHistory(orgId);
  const posHistory = [sale, ...existingHistory];
  if (typeof window !== "undefined") {
    localStorage.setItem(`${HISTORY_STORAGE_PREFIX}${orgId}`, JSON.stringify(posHistory));
  }

  const createdOrder: Order = {
    id: sale.id,
    orgId,
    locationId: sale.locationId,
    orderNumber: sale.orderNumber,
    type: sale.orderType,
    status: "confirmed",
    customer: {
      name: sale.customerName || "POS Walk-in Guest",
      phone: "+1 (POS) 000-0000",
    },
    items: sale.items,
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    taxRatePercent: 8.875,
    taxCents: sale.taxCents,
    totalCents: sale.totalCents,
    specialInstructions: `POS Sale by ${sale.attendantName} [Simulated ${sale.paymentMethod}]`,
    createdAt: sale.createdAt,
    updatedAt: sale.createdAt,
    timeline: [
      {
        id: `tl-${Date.now()}`,
        toStatus: "confirmed",
        timestamp: sale.createdAt,
        authorName: sale.attendantName,
        note: `POS completed sale via ${sale.paymentMethod} (Simulated)`,
      },
    ],
    isSimulated: true,
  };

  saveOrder(orgId, createdOrder);
  return { posHistory, createdOrder };
}

export function buildCartItem(
  product: MenuItem,
  quantity: number,
  modifiers: SelectedModifier[],
  notes?: string
): PosCartItem {
  const modSum = modifiers.reduce((acc, m) => acc + m.priceCents, 0);
  const itemTotal = (product.priceCents + modSum) * Math.max(1, quantity);
  return {
    id: `pos-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    productId: product.id,
    productName: product.name,
    quantity,
    basePriceCents: product.priceCents,
    modifiers,
    subtotalCents: itemTotal,
    notes,
  };
}
