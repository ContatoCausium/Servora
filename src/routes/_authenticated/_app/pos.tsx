import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, Plus, Minus, Trash2, ShoppingBag, PauseCircle, PlayCircle,
  DollarSign, CreditCard, Smartphone, Receipt, XCircle, Tag, Printer
} from "lucide-react";

import { useWorkspace } from "@/components/app/workspace-context";
import { listMenuItems, type MenuItem, type ModifierOption } from "@/lib/menu-service";
import {
  getPOSSession, savePOSSession, addItemToCart, updateCartItemQuantity,
  removeItemFromCart, applyDiscount, setOrderType, setCustomerInfo,
  suspendSession, resumeSession, finalizeSale, simulatePayment,
  type POSCartItem, type POSPaymentMethod
} from "@/lib/pos-service";
import { type OrderType } from "@/lib/orders-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_app/pos")({
  component: POSPage,
});

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function POSPage() {
  const { t } = useTranslation("orders");
  const { org, locationId, user } = useWorkspace();
  const activeLocId = locationId === "all" ? (org.locations[0]?.id || "loc-1") : locationId;
  const cashierName = user.fullName || user.email || "Cashier";

  const [session, setSession] = useState(() => getPOSSession(org.id, activeLocId, cashierName));
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [modModalItem, setModModalItem] = useState<MenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<Record<string, ModifierOption[]>>({});
  const [itemNotes, setItemNotes] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [payMethod, setPayMethod] = useState<POSPaymentMethod>("cash");
  const [tenderedInput, setTenderedInput] = useState("");
  const [receiptSession, setReceiptSession] = useState<typeof session | null>(null);

  // Refresh session when active location changes
  useEffect(() => {
    setSession(getPOSSession(org.id, activeLocId, cashierName));
  }, [org.id, activeLocId, cashierName]);

  const menuItems = useMemo(() => listMenuItems(org.id), [org.id]);
  const categories = useMemo(() => {
    const cats = new Set(menuItems.map((m) => m.category));
    return ["all", ...Array.from(cats)];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((i) => {
      const matchCat = selectedCat === "all" || i.category === selectedCat;
      const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCat, search]);

  const handleOpenItem = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setModModalItem(item);
      setSelectedMods({});
      setItemNotes("");
    } else {
      const updated = addItemToCart(session, item, [], 1);
      setSession(updated);
      toast.success(`${item.name} added`);
    }
  };

  const handleConfirmModifiers = () => {
    if (!modModalItem) return;
    // Verify required modifier groups
    const missingRequired = modModalItem.modifierGroups?.filter(
      (g) => g.required && (!selectedMods[g.id] || selectedMods[g.id]!.length === 0)
    );
    if (missingRequired && missingRequired.length > 0) {
      toast.error(t("pos.requiredModifier"));
      return;
    }
    const flatMods = Object.entries(selectedMods).flatMap(([groupId, opts]) => {
      const group = modModalItem.modifierGroups?.find((g) => g.id === groupId);
      return opts.map((opt) => ({
        groupId,
        groupName: group?.name || "",
        optionId: opt.id,
        optionName: opt.name,
        priceCents: opt.priceCents,
      }));
    });
    const updated = addItemToCart(session, modModalItem, flatMods, 1, itemNotes.trim() || undefined);
    setSession(updated);
    setModModalItem(null);
    toast.success(`${modModalItem.name} added`);
  };

  const handleQuantity = (cartItemId: string, delta: number) => {
    const itm = session.cart.find((c) => c.id === cartItemId);
    if (!itm) return;
    const nextQty = itm.quantity + delta;
    const updated = nextQty <= 0
      ? removeItemFromCart(session, cartItemId)
      : updateCartItemQuantity(session, cartItemId, nextQty);
    setSession(updated);
  };

  const handleClearTicket = () => {
    if (session.cart.length === 0) return;
    setSession(getPOSSession(org.id, activeLocId, cashierName));
    toast.info(t("pos.clearTicket"));
  };

  const handleApplyDiscountSubmit = () => {
    const val = parseFloat(discountInput || "0");
    const cents = Math.round(Math.max(0, isNaN(val) ? 0 : val) * 100);
    const updated = applyDiscount(session, cents);
    setSession(updated);
    setDiscountModalOpen(false);
    toast.success(t("pos.applyDiscount"));
  };

  const handleSuspend = () => {
    if (session.cart.length === 0) return;
    suspendSession(session);
    toast.info(t("pos.suspend"));
    setSession(getPOSSession(org.id, activeLocId, cashierName));
  };

  const handleResume = (id: string) => {
    const resumed = resumeSession(org.id, id);
    if (resumed) {
      setSession(resumed);
      toast.success(t("pos.resume"));
    }
  };

  const handleStartCheckout = () => {
    if (session.cart.length === 0) return;
    setTenderedInput((session.totalCents / 100).toFixed(2));
    setCheckoutOpen(true);
  };

  const handleCompleteSale = () => {
    const centsTendered = Math.round(parseFloat(tenderedInput || "0") * 100);
    const paid = simulatePayment(session, payMethod, centsTendered);
    if (payMethod === "cash" && centsTendered < paid.totalCents) {
      toast.error("Amount tendered is less than total amount");
      return;
    }
    const finalized = finalizeSale(paid);
    setReceiptSession(finalized);
    setCheckoutOpen(false);
    setSession(getPOSSession(org.id, activeLocId, cashierName));
    toast.success("Sale completed successfully!");
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4 overflow-hidden lg:flex-row">
      {/* Main Catalog View */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 bg-muted/20">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-xs">
              {t("pos.simulatedBadge")}
            </Badge>
            {session.suspendedSessions.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-xs text-muted-foreground hidden sm:inline">{t("pos.suspended")}:</span>
                {session.suspendedSessions.map((s) => (
                  <Button key={s.id} size="sm" variant="secondary" onClick={() => handleResume(s.id)} className="h-7 text-xs px-2">
                    <PlayCircle className="size-3 mr-1" /> {s.customerName || t("pos.resume")}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto border-b p-2 scrollbar-none">
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={selectedCat === c ? "default" : "outline"}
              onClick={() => setSelectedCat(c)}
              className="h-8 text-xs capitalize shrink-0"
            >
              {c}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleOpenItem(item)}
              className="flex flex-col text-left justify-between p-3 rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm active:scale-[0.98] transition-all duration-150"
            >
              <div>
                <p className="font-medium text-sm leading-snug line-clamp-2">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t w-full">
                <span className="font-semibold text-sm">{formatMoney(item.priceCents)}</span>
                <Plus className="size-4 text-primary" />
              </div>
            </button>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ShoppingBag className="size-10 mb-2 opacity-40" />
              <p>No products match your criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Cart Sidebar */}
      <div className="flex w-full lg:w-96 flex-col rounded-xl border bg-card shrink-0 overflow-hidden">
        {/* Header Order Settings */}
        <div className="border-b p-3 bg-muted/20 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <p className="font-semibold text-sm">Current Ticket</p>
            <span className="text-xs text-muted-foreground">Attendant: {session.cashierName}</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['dine_in', 'takeout', 'delivery'] as OrderType[]).map((tType) => (
              <Button
                key={tType}
                size="sm"
                variant={session.orderType === tType ? "default" : "outline"}
                onClick={() => setSession(setOrderType(session, tType))}
                className="h-7 text-xs capitalize"
              >
                {tType.replace('_', ' ')}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Customer (e.g. Table 5 / Alex)"
            value={session.customerName || ""}
            onChange={(e) => setSession(setCustomerInfo(session, e.target.value))}
            className="h-8 text-xs"
          />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 divide-y">
          {session.cart.map((cartItem) => (
            <div key={cartItem.id} className="pt-2 first:pt-0 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium leading-tight">{cartItem.productName}</p>
                  {cartItem.modifiers.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {cartItem.modifiers.map((m) => m.optionName).join(", ")}
                    </p>
                  )}
                  {cartItem.notes && (
                    <p className="text-[11px] italic text-muted-foreground">Note: {cartItem.notes}</p>
                  )}
                </div>
                <span className="text-sm font-semibold">{formatMoney(cartItem.subtotalCents)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="size-6" onClick={() => handleQuantity(cartItem.id, -1)}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-xs font-semibold">{cartItem.quantity}</span>
                  <Button size="icon" variant="outline" className="size-6" onClick={() => handleQuantity(cartItem.id, 1)}>
                    <Plus className="size-3" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost" className="size-6 text-destructive hover:bg-destructive/10" onClick={() => setSession(removeItemFromCart(session, cartItem.id))}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
          {session.cart.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs">
              Tap items from the left catalogue to add them to this ticket.
            </div>
          )}
        </div>

        {/* Totals & Quick Actions */}
        <div className="border-t p-3 bg-muted/10 flex flex-col gap-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal:</span>
            <span>{formatMoney(session.subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({session.taxRatePercent}%):</span>
            <span>{formatMoney(session.taxCents)}</span>
          </div>
          {session.discountCents > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
              <span>Authorized Discount:</span>
              <span>-{formatMoney(session.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-1 border-t text-foreground">
            <span>Total USD:</span>
            <span>{formatMoney(session.totalCents)}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <Button size="sm" variant="outline" onClick={() => { setDiscountInput((session.discountCents / 100).toFixed(2)); setDiscountModalOpen(true); }} className="h-8 text-[11px] px-1">
              <Tag className="size-3 mr-1" /> {t("pos.discount")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSuspend} disabled={session.cart.length === 0} className="h-8 text-[11px] px-1">
              <PauseCircle className="size-3 mr-1" /> {t("pos.suspend")}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClearTicket} disabled={session.cart.length === 0} className="h-8 text-[11px] px-1">
              <XCircle className="size-3 mr-1" /> {t("pos.clearTicket")}
            </Button>
          </div>
          <Button size="sm" variant="default" onClick={handleStartCheckout} disabled={session.cart.length === 0} className="w-full h-9 text-xs font-semibold mt-1">
            {t("pos.pay", { amount: formatMoney(session.totalCents) })}
          </Button>
        </div>
      </div>

      {/* Modifiers Dialog */}
      <Dialog open={!!modModalItem} onOpenChange={(open) => !open && setModModalItem(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modModalItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {modModalItem?.modifierGroups?.map((group) => (
              <div key={group.id} className="flex flex-col gap-2 border-b pb-3">
                <p className="font-medium text-sm flex items-center justify-between">
                  <span>{group.name}</span>
                  {group.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.options.map((opt) => {
                    const currentSelected = selectedMods[group.id] || [];
                    const isSelected = currentSelected.some((o) => o.id === opt.id);
                    return (
                      <Button
                        key={opt.id}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => {
                          setSelectedMods((prev) => ({
                            ...prev,
                            [group.id]: [opt],
                          }));
                        }}
                        className="h-9 text-xs justify-between px-2"
                      >
                        <span className="truncate">{opt.name}</span>
                        {opt.priceCents > 0 && <span className="text-[10px] opacity-75">+{formatMoney(opt.priceCents)}</span>}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Item Notes</label>
              <Input placeholder="e.g. Extra dressing on side" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModModalItem(null)}>Cancel</Button>
            <Button onClick={handleConfirmModifiers}>Add to Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("pos.applyDiscount")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">Discount (USD)</label>
            <Input
              type="number"
              step="0.50"
              min="0"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountModalOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyDiscountSubmit}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pos.checkoutTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="p-3 bg-muted/40 rounded-lg text-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("pos.amountDue")}</span>
              <p className="text-3xl font-bold mt-1 text-primary">{formatMoney(session.totalCents)}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={payMethod === "cash" ? "default" : "outline"}
                onClick={() => setPayMethod("cash")}
                className="flex-col h-14 text-xs gap-1"
              >
                <DollarSign className="size-4" /> {t("pos.methods.cash")}
              </Button>
              <Button
                type="button"
                variant={payMethod === "card" ? "default" : "outline"}
                onClick={() => setPayMethod("card")}
                className="flex-col h-14 text-xs gap-1"
              >
                <CreditCard className="size-4" /> {t("pos.methods.card")}
              </Button>
              <Button
                type="button"
                variant={payMethod === "digital" ? "default" : "outline"}
                onClick={() => setPayMethod("digital")}
                className="flex-col h-14 text-xs gap-1"
              >
                <Smartphone className="size-4" /> {t("pos.methods.digital")}
              </Button>
            </div>

            {payMethod === "cash" && (
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-medium">{t("pos.tendered")}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={tenderedInput}
                  onChange={(e) => setTenderedInput(e.target.value)}
                />
                <div className="flex gap-1.5">
                  {[10, 20, 50, 100].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs flex-1"
                      onClick={() => setTenderedInput(String(preset))}
                    >
                      ${preset}
                    </Button>
                  ))}
                </div>
                {parseFloat(tenderedInput) * 100 > session.totalCents && (
                  <p className="text-xs text-emerald-600 font-medium pt-1">
                    {t("pos.changeDue")}: {formatMoney(Math.round(parseFloat(tenderedInput) * 100) - session.totalCents)}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button onClick={handleCompleteSale} className="bg-primary text-primary-foreground">
              {t("pos.confirmSale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog open={!!receiptSession} onOpenChange={(open) => !open && setReceiptSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-emerald-600" /> {t("pos.receiptTitle")}
            </DialogTitle>
          </DialogHeader>
          {receiptSession && (
            <div className="flex flex-col gap-3 font-mono text-xs border rounded-md p-4 bg-muted/10 shadow-inner">
              <div className="text-center border-b pb-2 space-y-0.5">
                <p className="font-bold text-base">{org.name}</p>
                <p className="text-[10px] text-muted-foreground">{t("pos.simulatedBadge")}</p>
                <p className="text-[10px] text-muted-foreground">Ticket #{receiptSession.id.slice(-6).toUpperCase()}</p>
                <p className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString()}</p>
              </div>
              <div className="flex flex-col gap-1 border-b pb-2">
                {receiptSession.cart.map((itm) => (
                  <div key={itm.id} className="flex justify-between items-start">
                    <div>
                      <span>{itm.quantity}x {itm.productName}</span>
                      {itm.modifiers.length > 0 && (
                        <span className="block text-[10px] text-muted-foreground">+ {itm.modifiers.map(m => m.optionName).join(", ")}</span>
                      )}
                    </div>
                    <span>{formatMoney(itm.subtotalCents)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1 text-right">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal:</span><span>{formatMoney(receiptSession.subtotalCents)}</span></div>
                {receiptSession.discountCents > 0 && (
                  <div className="flex justify-between text-emerald-600"><span>Discount:</span><span>-{formatMoney(receiptSession.discountCents)}</span></div>
                )}
                <div className="flex justify-between text-muted-foreground"><span>Tax ({receiptSession.taxRatePercent}%):</span><span>{formatMoney(receiptSession.taxCents)}</span></div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t text-foreground"><span>Total:</span><span>{formatMoney(receiptSession.totalCents)}</span></div>
                {receiptSession.tenderedCents ? (
                  <div className="flex justify-between text-muted-foreground pt-1"><span>Tendered ({receiptSession.paymentMethod}):</span><span>{formatMoney(receiptSession.tenderedCents)}</span></div>
                ) : null}
                {receiptSession.changeDueCents ? (
                  <div className="flex justify-between text-emerald-600 font-semibold"><span>Change:</span><span>{formatMoney(receiptSession.changeDueCents)}</span></div>
                ) : null}
              </div>
              <p className="text-center text-[10px] text-muted-foreground pt-2 border-t border-dashed">
                {t("pos.receiptNote")}
              </p>
            </div>
          )}
          <DialogFooter className="flex-row gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
              <Printer className="size-3.5" /> Print
            </Button>
            <Button size="sm" onClick={() => setReceiptSession(null)}>{t("pos.closeNewOrder")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
