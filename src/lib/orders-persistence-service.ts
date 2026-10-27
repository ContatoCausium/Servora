import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem, OrderStatus, OrderType, SelectedModifier } from "./orders-service";

export interface OrderFilterOptions {
  orgId: string;
  locationId?: string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  channel?: OrderType;
  limit?: number;
  offset?: number;
}

export interface PersistedOrderResult {
  orders: Order[];
  totalCount: number;
}

export async function fetchPersistedOrders(
  options: OrderFilterOptions
): Promise<PersistedOrderResult> {
  const { orgId, locationId, status, startDate, endDate, channel, limit = 50, offset = 0 } = options;
  try {
    let query = supabase
      .from("orders")
      .select(
        `
        id,
        org_id,
        location_id,
        order_number,
        order_type,
        status,
        customer_name,
        customer_phone,
        table_number,
        subtotal_cents,
        discount_cents,
        tax_cents,
        total_cents,
        special_instructions,
        created_at,
        updated_at,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          unit_price_cents,
          subtotal_cents,
          modifiers,
          notes,
          is_ready
        )
      `,
        { count: "exact" }
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (locationId && locationId !== "all") {
      query = query.eq("location_id", locationId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (channel) {
      query = query.eq("order_type", channel);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, count, error } = await query;
    if (error) {
      return { orders: [], totalCount: 0 };
    }

    const mappedOrders: Order[] = (data || []).map((row: any) => {
      const items: OrderItem[] = (row.order_items || []).map((it: any) => ({
        id: it.id,
        productId: it.product_id || "",
        productName: it.product_name || "Product",
        quantity: it.quantity || 1,
        basePriceCents: it.unit_price_cents || 0,
        modifiers: (it.modifiers as SelectedModifier[]) || [],
        subtotalCents: it.subtotal_cents || (it.unit_price_cents * (it.quantity || 1)),
        notes: it.notes || undefined,
        isItemReady: !!it.is_ready,
      }));

      return {
        id: row.id,
        orgId: row.org_id,
        locationId: row.location_id,
        orderNumber: row.order_number || `#${row.id.slice(0, 6)}`,
        type: (row.order_type as OrderType) || "dine_in",
        status: (row.status as OrderStatus) || "new",
        customer: {
          name: row.customer_name || "Walk-in",
          phone: row.customer_phone || "",
          tableNumber: row.table_number || undefined,
        },
        items,
        subtotalCents: row.subtotal_cents || 0,
        discountCents: row.discount_cents || 0,
        taxRatePercent: 8.875,
        taxCents: row.tax_cents || 0,
        totalCents: row.total_cents || 0,
        specialInstructions: row.special_instructions || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        timeline: [],
        isSimulated: false,
      };
    });

    return { orders: mappedOrders, totalCount: count || mappedOrders.length };
  } catch {
    return { orders: [], totalCount: 0 };
  }
}

export async function persistOrderToSupabase(
  orgId: string,
  order: Order
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: headerErr } = await supabase.from("orders").upsert(
      {
        id: order.id.startsWith("ord-") || order.id.startsWith("pos-") ? undefined : order.id,
        org_id: orgId,
        location_id: order.locationId,
        order_number: order.orderNumber,
        order_type: order.type,
        status: order.status,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        table_number: order.customer.tableNumber,
        subtotal_cents: order.subtotalCents,
        discount_cents: order.discountCents,
        tax_cents: order.taxCents,
        total_cents: order.totalCents,
        special_instructions: order.specialInstructions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (headerErr) {
      return { success: false, error: headerErr.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function persistOrderStatusTransition(
  orderId: string,
  status: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
