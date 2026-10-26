import { MenuItem } from "./menu-service";
import { Order, OrderItem, OrderType, SelectedModifier, calculateOrderSummary, saveOrder } from "./orders-service";

export type POSPaymentMethod = "cash" | "card" | "digital";
export type PaymentMethod = POSPaymentMethod;

export interface POSCartItem extends OrderItem {}
export type PosCartItem = POSCartItem;

export interface POSSession {
  id: string;
  orgId: string;
  locationId: string;
  cashierName: string;
  customerName?: string;
  orderType: OrderType;
  cart: POSCartItem[];
  discountCents: number;
  taxRatePercent: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethod?: POSPaymentMethod;
  tenderedCents?: number;
  changeDueCents?: number;
  suspendedSessions: SuspendedSale[];
  completedAt?: string;
}

export interface SuspendedSale {
  id: string;
  orgId: string;
  locationId: string;
  note?: string;
  suspendedAt: string;
  orderType: OrderType;
  attendantName: string;
  customerName?: string;
  items: POSCartItem[];
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
  items: POSCartItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethod: POSPaymentMethod;
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
  const updated = [sale, ...existing.filter((s) => s.id !== sale.id)];
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
): POSCartItem {
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

function recalculateSession(session: POSSession): POSSession {
  const summary = calculateOrderSummary(session.cart, session.taxRatePercent, session.discountCents);
  return {
    ...session,
    subtotalCents: summary.subtotalCents,
    taxCents: summary.taxCents,
    totalCents: summary.totalCents,
  };
}

export function getPOSSession(orgId: string, locationId: string, cashierName: string): POSSession {
  const suspended = listSuspendedSales(orgId, locationId);
  return recalculateSession({
    id: `pos-${Date.now()}`,
    orgId,
    locationId,
    cashierName,
    orderType: "dine_in",
    cart: [],
    discountCents: 0,
    taxRatePercent: 8.875,
    subtotalCents: 0,
    taxCents: 0,
    totalCents: 0,
    suspendedSessions: suspended,
  });
}

export function savePOSSession(session: POSSession): POSSession {
  return recalculateSession(session);
}

export function addItemToCart(
  session: POSSession,
  product: MenuItem,
  modifiers: SelectedModifier[] = [],
  quantity: number = 1,
  notes?: string
): POSSession {
  const item = buildCartItem(product, quantity, modifiers, notes);
  return recalculateSession({
    ...session,
    cart: [...session.cart, item],
  });
}

export function updateCartItemQuantity(session: POSSession, cartItemId: string, quantity: number): POSSession {
  const nextCart = session.cart.map((item) => {
    if (item.id !== cartItemId) return item;
    const modSum = item.modifiers.reduce((acc, m) => acc + m.priceCents, 0);
    return {
      ...item,
      quantity,
      subtotalCents: (item.basePriceCents + modSum) * Math.max(1, quantity),
    };
  });
  return recalculateSession({
    ...session,
    cart: nextCart,
  });
}

export function removeItemFromCart(session: POSSession, cartItemId: string): POSSession {
  return recalculateSession({
    ...session,
    cart: session.cart.filter((item) => item.id !== cartItemId),
  });
}

export function applyDiscount(session: POSSession, discountCents: number): POSSession {
  return recalculateSession({
    ...session,
    discountCents: Math.max(0, discountCents),
  });
}

export function setOrderType(session: POSSession, orderType: OrderType): POSSession {
  return { ...session, orderType };
}

export function setCustomerInfo(session: POSSession, customerName: string): POSSession {
  return { ...session, customerName };
}

export function suspendSession(session: POSSession): void {
  if (session.cart.length === 0) return;
  const sale: SuspendedSale = {
    id: session.id,
    orgId: session.orgId,
    locationId: session.locationId,
    attendantName: session.cashierName,
    customerName: session.customerName,
    orderType: session.orderType,
    items: session.cart,
    discountCents: session.discountCents,
    taxRatePercent: session.taxRatePercent,
    suspendedAt: new Date().toISOString(),
  };
  suspendSale(session.orgId, sale);
}

export function resumeSession(orgId: string, saleId: string): POSSession | null {
  const sales = listSuspendedSales(orgId);
  const found = sales.find((s) => s.id === saleId);
  if (!found) return null;
  removeSuspendedSale(orgId, saleId);
  const activeSuspended = listSuspendedSales(orgId, found.locationId);
  return recalculateSession({
    id: found.id,
    orgId,
    locationId: found.locationId,
    cashierName: found.attendantName,
    customerName: found.customerName,
    orderType: found.orderType,
    cart: found.items,
    discountCents: found.discountCents,
    taxRatePercent: found.taxRatePercent,
    subtotalCents: 0,
    taxCents: 0,
    totalCents: 0,
    suspendedSessions: activeSuspended,
  });
}

export function simulatePayment(
  session: POSSession,
  method: POSPaymentMethod,
  tenderedCents: number
): POSSession {
  const changeDueCents = method === "cash" ? calculateChange(tenderedCents, session.totalCents) : 0;
  return {
    ...session,
    paymentMethod: method,
    tenderedCents,
    changeDueCents,
  };
}

export function finalizeSale(session: POSSession): POSSession {
  const completed: CompletedPosSale = {
    id: session.id,
    orderNumber: `#POS-${session.id.slice(-4).toUpperCase()}`,
    orgId: session.orgId,
    locationId: session.locationId,
    attendantName: session.cashierName,
    orderType: session.orderType,
    customerName: session.customerName,
    items: session.cart,
    subtotalCents: session.subtotalCents,
    discountCents: session.discountCents,
    taxCents: session.taxCents,
    totalCents: session.totalCents,
    paymentMethod: session.paymentMethod || "cash",
    tenderedCents: session.tenderedCents || session.totalCents,
    changeCents: session.changeDueCents || 0,
    createdAt: new Date().toISOString(),
    isSimulated: true,
  };

  recordCompletedSale(session.orgId, completed);
  return {
    ...session,
    completedAt: completed.createdAt,
  };
}
