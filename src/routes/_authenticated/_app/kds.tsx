import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  CookingPot, Clock, AlertTriangle, CheckCircle2, Play, Check, Flame,
  RotateCcw, Sparkles, Filter, Store, UtensilsCrossed, BellRing
} from "lucide-react";
import { toast } from "sonner";

import { useWorkspace } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Order, OrderStatus, KitchenStation,
  listOrders, updateOrderStatus, toggleOrderItemReady
} from "@/lib/orders-service";
import {
  calculateElapsedMinutes, getTicketUrgency, filterOrdersByStation,
  assignDefaultStation, simulateIncomingOrder, DEFAULT_THRESHOLDS
} from "@/lib/kds-service";

export const Route = createFileRoute("/_authenticated/_app/kds")({
  head: () => ({
    meta: [{ title: "Kitchen Display System (KDS) · Servora" }],
  }),
  component: KDSPage,
});

const STATIONS: { id: KitchenStation | "all"; label: string }[] = [
  { id: "all", label: "All Stations" },
  { id: "grill", label: "Grill" },
  { id: "fryer", label: "Fryer" },
  { id: "assembly", label: "Assembly" },
  { id: "bar", label: "Bar & Drinks" },
  { id: "expo", label: "Expo" },
];

export function KDSPage() {
  const { t } = useTranslation("orders");
  const { org, locationId, user } = useWorkspace();
  const staffName = user.fullName || user.email || "Kitchen Lead";
  const [orders, setOrders] = useState<Order[]>(() => listOrders(org.id, locationId));
  const [stationFilter, setStationFilter] = useState<KitchenStation | "all">("all");
  const [nowTick, setNowTick] = useState(Date.now());
  const [audioAlerts, setAudioAlerts] = useState(true);

  // Refresh timer every 10 seconds for real-time timers
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
      setOrders(listOrders(org.id, locationId));
    }, 8000);
    return () => clearInterval(interval);
  }, [org.id, locationId]);

  const filteredOrders = useMemo(() => {
    let list = listOrders(org.id, locationId);
    return filterOrdersByStation(list, stationFilter);
  }, [org.id, locationId, stationFilter, nowTick]);

  const columns = useMemo(() => {
    const active = filteredOrders.filter((o) => o.status !== "cancelled");
    return {
      new: active.filter((o) => o.status === "new" || o.status === "confirmed"),
      in_prep: active.filter((o) => o.status === "in_prep"),
      ready: active.filter((o) => o.status === "ready"),
      delivered: active.filter((o) => o.status === "delivered").slice(0, 10),
    };
  }, [filteredOrders]);

  const handleStatusChange = (orderId: string, next: OrderStatus) => {
    const updated = updateOrderStatus(org.id, orderId, next, staffName, `Updated via KDS`);
    if (updated) {
      setOrders(listOrders(org.id, locationId));
      toast.success(`Ticket #${updated.orderNumber} moved to ${next}`);
    }
  };

  const handleToggleItem = (orderId: string, itemId: string) => {
    const updated = toggleOrderItemReady(org.id, orderId, itemId);
    if (updated) {
      setOrders(listOrders(org.id, locationId));
    }
  };

  const handleSimulateNewOrder = () => {
    const targetLoc = locationId === "all" ? (org.locations[0]?.id || "loc-1") : locationId;
    const newOrd = simulateIncomingOrder(org.id, targetLoc);
    setOrders(listOrders(org.id, locationId));
    if (audioAlerts && typeof window !== "undefined") {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } catch {}
    }
    toast.info(`New simulated order received: ${newOrd.orderNumber}`);
  };

  return (
    <div className="flex flex-col gap-4 mx-auto max-w-[1600px] h-[calc(100vh-5.5rem)]">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border rounded-xl p-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CookingPot className="size-6 text-primary" />
            <div>
              <h1 className="font-bold text-base leading-none flex items-center gap-2">
                Kitchen Display System (KDS)
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-50/50 text-[10px]">
                  {t("simulatedBadge")}
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Station-routed production display with delay tracking</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Station Selector */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
            {STATIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStationFilter(s.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  stationFilter === s.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAudioAlerts(!audioAlerts)}
            className={`h-8 text-xs gap-1.5 ${audioAlerts ? "text-primary" : "text-muted-foreground"}`}
          >
            <BellRing className="size-3.5" />
            {audioAlerts ? "Chime ON" : "Muted"}
          </Button>

          <Button size="sm" onClick={handleSimulateNewOrder} className="h-8 text-xs gap-1.5">
            <Sparkles className="size-3.5" /> Simulate Order
          </Button>
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-hidden min-h-0">
        {/* Column: New */}
        <KDSColumn
          title="New Orders"
          count={columns.new.length}
          tone="blue"
          emptyMessage="No new tickets in queue"
        >
          {columns.new.map((order) => (
            <KDSTicketCard
              key={order.id}
              order={order}
              stationFilter={stationFilter}
              onAdvance={() => handleStatusChange(order.id, "in_prep")}
              advanceLabel="Start Cooking"
              advanceIcon={Play}
              onToggleItem={(itemId) => handleToggleItem(order.id, itemId)}
            />
          ))}
        </KDSColumn>

        {/* Column: In Prep */}
        <KDSColumn
          title="In Preparation"
          count={columns.in_prep.length}
          tone="amber"
          emptyMessage="No orders currently on line"
        >
          {columns.in_prep.map((order) => (
            <KDSTicketCard
              key={order.id}
              order={order}
              stationFilter={stationFilter}
              onAdvance={() => handleStatusChange(order.id, "ready")}
              advanceLabel="Mark Ready"
              advanceIcon={Check}
              onToggleItem={(itemId) => handleToggleItem(order.id, itemId)}
            />
          ))}
        </KDSColumn>

        {/* Column: Ready */}
        <KDSColumn
          title="Ready for Pickup"
          count={columns.ready.length}
          tone="emerald"
          emptyMessage="No completed orders waiting"
        >
          {columns.ready.map((order) => (
            <KDSTicketCard
              key={order.id}
              order={order}
              stationFilter={stationFilter}
              onAdvance={() => handleStatusChange(order.id, "delivered")}
              advanceLabel="Fulfill"
              advanceIcon={CheckCircle2}
              onToggleItem={(itemId) => handleToggleItem(order.id, itemId)}
            />
          ))}
        </KDSColumn>

        {/* Column: Completed */}
        <KDSColumn
          title="Completed (Recent)"
          count={columns.delivered.length}
          tone="muted"
          emptyMessage="Completed tickets show here"
        >
          {columns.delivered.map((order) => (
            <KDSTicketCard
              key={order.id}
              order={order}
              stationFilter={stationFilter}
              onAdvance={() => handleStatusChange(order.id, "in_prep")}
              advanceLabel="Reopen"
              advanceIcon={RotateCcw}
              onToggleItem={(itemId) => handleToggleItem(order.id, itemId)}
              isCompleted
            />
          ))}
        </KDSColumn>
      </div>
    </div>
  );
}

function KDSColumn({
  title,
  count,
  tone,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  tone: "blue" | "amber" | "emerald" | "muted";
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const toneColors = {
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    muted: "border-border bg-muted/20 text-muted-foreground",
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card/60 backdrop-blur overflow-hidden h-full shadow-xs">
      <div className={`flex items-center justify-between border-b px-3 py-2.5 font-semibold text-xs ${toneColors[tone]}`}>
        <span>{title}</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-bold">
          {count}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5 scrollbar-thin">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground my-auto">
            <UtensilsCrossed className="size-6 mb-2 opacity-30" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function KDSTicketCard({
  order,
  stationFilter,
  onAdvance,
  advanceLabel,
  advanceIcon: Icon,
  onToggleItem,
  isCompleted = false,
}: {
  order: Order;
  stationFilter: KitchenStation | "all";
  onAdvance: () => void;
  advanceLabel: string;
  advanceIcon: React.ElementType;
  onToggleItem: (id: string) => void;
  isCompleted?: boolean;
}) {
  const elapsed = calculateElapsedMinutes(order.createdAt);
  const urgency = getTicketUrgency(order.createdAt);

  const urgencyBorder = {
    normal: "border-border",
    warning: "border-amber-500/60 ring-1 ring-amber-500/20",
    delayed: "border-destructive/80 ring-2 ring-destructive/30 bg-destructive/5",
  }[isCompleted ? "normal" : urgency];

  const displayedItems = order.items.filter((item) => {
    if (stationFilter === "all") return true;
    return (item.station || assignDefaultStation(item.productName)) === stationFilter;
  });

  return (
    <div className={`rounded-lg border bg-card p-3 shadow-xs flex flex-col gap-2.5 transition-all ${urgencyBorder}`}>
      {/* Card Header */}
      <div className="flex items-start justify-between gap-1 border-b pb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm tracking-tight">{order.orderNumber}</span>
            <Badge variant="outline" className="text-[10px] capitalize px-1 py-0 h-4">
              {order.type.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
            {order.customer.tableNumber || order.customer.name}
          </p>
        </div>

        <div className="flex flex-col items-end">
          <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
            urgency === "delayed" && !isCompleted ? "text-destructive animate-pulse" : "text-muted-foreground"
          }`}>
            <Clock className="size-3" />
            {elapsed}m
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Items Checklist */}
      <div className="flex flex-col gap-1.5 divide-y divide-border/40">
        {displayedItems.map((item) => {
          const itemStation = item.station || assignDefaultStation(item.productName);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleItem(item.id)}
              className={`text-left pt-1.5 first:pt-0 flex items-start justify-between gap-2 group transition-opacity ${
                item.isItemReady ? "opacity-40 line-through" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-xs leading-tight flex items-center gap-1.5">
                  <span className="size-4 rounded-sm border flex items-center justify-center shrink-0 bg-muted/40 group-hover:border-primary text-[10px]">
                    {item.quantity}
                  </span>
                  <span className="truncate">{item.productName}</span>
                </p>
                {item.modifiers.length > 0 && (
                  <p className="text-[10px] text-muted-foreground pl-5.5">
                    {item.modifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
                {item.notes && (
                  <p className="text-[10px] italic text-amber-600 dark:text-amber-400 pl-5.5">
                    &ldquo;{item.notes}&rdquo;
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-[9px] uppercase px-1 py-0 shrink-0 h-4">
                {itemStation}
              </Badge>
            </button>
          );
        })}
      </div>

      {order.specialInstructions && (
        <p className="text-[10px] bg-muted/50 rounded p-1.5 text-muted-foreground italic">
          Note: {order.specialInstructions}
        </p>
      )}

      {/* Advance Action Button */}
      <Button
        size="sm"
        variant={urgency === "delayed" && !isCompleted ? "destructive" : "default"}
        onClick={onAdvance}
        className="w-full h-8 text-xs font-semibold gap-1.5 mt-auto"
      >
        <Icon className="size-3.5" />
        {advanceLabel}
      </Button>
    </div>
  );
}
