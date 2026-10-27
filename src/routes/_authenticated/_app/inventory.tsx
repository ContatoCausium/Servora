import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Boxes, Plus, Search, ArrowUpDown, ArrowDownLeft, ArrowUpRight, AlertCircle,
  History, ShieldAlert, ArrowLeftRight, CheckCircle2, ChefHat, Copy, RefreshCw, Layers
} from "lucide-react";
import { toast } from "sonner";

import { useWorkspace } from "@/components/app/workspace-context";
import { PageHeader, Panel } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  listInventory, saveInventoryItem, type InventoryItem, type InventoryCategory
} from "@/lib/inventory-service";
import {
  listInventoryMovements, recordInventoryMovement, type MovementType
} from "@/lib/inventory-movements-service";
import {
  listProductRecipes, getProductRecipe, saveProductRecipe, duplicateProductRecipe,
  syncRecipeWithInventoryPrices, checkRecipeStockAvailability,
  calculateIngredientCost, computeRecipeTotals, type ProductRecipe, type RecipeIngredient, type RecipeUnit
} from "@/lib/recipes-service";
import { DemoBadge } from "@/components/app/brand-mark";

export const Route = createFileRoute("/_authenticated/_app/inventory")({
  head: () => ({
    meta: [{ title: "Inventory & Stock Movements · Servora" }],
  }),
  component: InventoryPage,
});

export function InventoryPage() {
  const { t } = useTranslation("inventory");
  const { org, locationId, user, role } = useWorkspace();
  const canManage = role !== "staff";

  const [activeTab, setActiveTab] = useState<"items" | "movements" | "recipes">("items");
  const [items, setItems] = useState<InventoryItem[]>(() => listInventory(org.id, locationId));
  const [recipes, setRecipes] = useState<ProductRecipe[]>(() => listProductRecipes(org.id, locationId));
  const [movementsTick, setMovementsTick] = useState(0);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<ProductRecipe | null>(null);
  const [recipeFormData, setRecipeFormData] = useState<{
    productName: string;
    servings: number;
    yieldUnit: string;
    sellingPriceCents: number;
    prepInstructions: string;
    ingredients: RecipeIngredient[];
  }>({
    productName: "",
    servings: 1,
    yieldUnit: "porção",
    sellingPriceCents: 1200,
    prepInstructions: "",
    ingredients: [],
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedItemForMove, setSelectedItemForMove] = useState<InventoryItem | null>(null);

  // Movement form state
  const [moveType, setMoveType] = useState<MovementType>("in");
  const [moveQty, setMoveQty] = useState<string>("1");
  const [moveReason, setMoveReason] = useState<string>("");
  const [targetLocationId, setTargetLocationId] = useState<string>("");

  const refreshData = () => {
    setItems(listInventory(org.id, locationId));
    setRecipes(listProductRecipes(org.id, locationId));
    setMovementsTick((x) => x + 1);
  };

  const handleOpenRecipeModal = (recipe?: ProductRecipe) => {
    if (recipe) {
      setSelectedRecipe(recipe);
      setRecipeFormData({
        productName: recipe.productName,
        servings: recipe.servings,
        yieldUnit: recipe.yieldUnit,
        sellingPriceCents: recipe.sellingPriceCents,
        prepInstructions: recipe.prepInstructions || "",
        ingredients: [...recipe.ingredients],
      });
    } else {
      setSelectedRecipe(null);
      setRecipeFormData({
        productName: "",
        servings: 1,
        yieldUnit: "porção",
        sellingPriceCents: 1400,
        prepInstructions: "",
        ingredients: items[0]
          ? [
              {
                id: `ri-${Date.now()}`,
                inventoryItemId: items[0].id,
                name: items[0].name,
                quantity: 1,
                unit: (items[0].unit as RecipeUnit) || "units",
                wastePercentage: 0,
                unitCostCents: items[0].costCents,
                subtotalCostCents: items[0].costCents,
              },
            ]
          : [],
      });
    }
    setRecipeModalOpen(true);
  };

  const handleSaveRecipeForm = () => {
    if (!recipeFormData.productName.trim()) {
      toast.error("Informe o nome do prato ou produto da ficha técnica");
      return;
    }
    if (recipeFormData.ingredients.length === 0) {
      toast.error("Adicione pelo menos um insumo à ficha técnica");
      return;
    }

    const saved = saveProductRecipe(
      org.id,
      {
        id: selectedRecipe?.id,
        orgId: org.id,
        productId: selectedRecipe?.productId || `prod-${Date.now()}`,
        productName: recipeFormData.productName.trim(),
        locationId: locationId === "all" ? undefined : locationId,
        servings: recipeFormData.servings,
        yieldQuantity: recipeFormData.servings,
        yieldUnit: recipeFormData.yieldUnit,
        prepInstructions: recipeFormData.prepInstructions,
        sellingPriceCents: recipeFormData.sellingPriceCents,
        ingredients: recipeFormData.ingredients,
        totalCostCents: 0,
        costPerServingCents: 0,
        estimatedMarginPercent: 0,
        history: selectedRecipe?.history || [],
      },
      user.fullName || user.email || "Operator"
    );

    setRecipeModalOpen(false);
    refreshData();
    toast.success("Ficha técnica salva com sucesso!");
  };

  const handleDuplicateRecipe = (r: ProductRecipe) => {
    try {
      duplicateProductRecipe(org.id, r.id, user.fullName || user.email || "Operator");
      refreshData();
      toast.success(`Ficha técnica ${r.productName} duplicada`);
    } catch (e) { 
      toast.error("Erro ao duplicar receita");
    }
  };

  const handleSyncRecipePrices = (r: ProductRecipe) => {
    try {
      syncRecipeWithInventoryPrices(org.id, r.id, user.fullName || user.email || "System");
      refreshData();
      toast.success(`Custos atualizados conforme preços vigentes do estoque`);
    } catch (e) { 
      toast.error("Erro ao sincronizar custos");
    }
  };

  const movements = useMemo(() => {
    return listInventoryMovements(org.id, {
      locationId: locationId === "all" ? undefined : locationId,
    });
  }, [org.id, locationId, movementsTick]);

  const filteredItems = useMemo(() => {
    return items.filter((itm) => {
      const matchCat = categoryFilter === "all" || itm.category === categoryFilter;
      const matchSearch = itm.name.toLowerCase().includes(search.toLowerCase()) ||
        itm.sku.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, categoryFilter, search]);

  const handleOpenMovementModal = (item?: InventoryItem) => {
    setSelectedItemForMove(item || items[0] || null);
    setMoveType("in");
    setMoveQty("1");
    setMoveReason("");
    const otherLoc = org.locations.find((l) => l.id !== locationId);
    setTargetLocationId(otherLoc?.id || org.locations[0]?.id || "");
    setMovementModalOpen(true);
  };

  const handleRecordMovement = () => {
    if (!selectedItemForMove) return;
    const qty = parseFloat(moveQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Informe uma quantidade válida maior que zero");
      return;
    }
    if (!moveReason.trim()) {
      toast.error("Informe o motivo ou justificativa da movimentação");
      return;
    }

    const effectiveSource = selectedItemForMove.locationId || (locationId !== "all" ? locationId : org.locations[0]?.id || "loc-1");

    try {
      recordInventoryMovement({
        orgId: org.id,
        itemId: selectedItemForMove.id,
        type: moveType,
        quantity: qty,
        reason: moveReason.trim(),
        performedBy: user.fullName || user.email || "Staff Lead",
        sourceLocationId: effectiveSource,
        targetLocationId: moveType === "transfer" ? targetLocationId : undefined,
        allowNegativeStock: false,
      });

      toast.success("Movimentação registrada com sucesso");
      setMovementModalOpen(false);
      refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar movimentação");
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-2">
            <span className="eyebrow">{org.name}</span>
            <DemoBadge label={t("simulatedBadge", { defaultValue: "Simulação Interativa" })} />
          </div>
        }
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs mr-2">
              <button
                onClick={() => setActiveTab("items")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === "items" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("title")}
              </button>
              <button
                onClick={() => setActiveTab("movements")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === "movements" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Movimentações
              </button>
              <button
                onClick={() => setActiveTab("recipes")}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === "recipes" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("recipes.tab", { defaultValue: "Fichas Técnicas" })}
              </button>
            </div>

            {canManage && activeTab === "recipes" && (
              <Button size="sm" onClick={() => handleOpenRecipeModal()}>
                <Plus className="mr-1.5 size-4" />
                {t("recipes.newRecipe", { defaultValue: "Nova Ficha Técnica" })}
              </Button>
            )}
            {canManage && activeTab !== "recipes" && (
              <Button size="sm" onClick={() => handleOpenMovementModal()}>
                <ArrowUpDown className="mr-1.5 size-4" />
                Registrar Movimento
              </Button>
            )}
          </div>
        }
      />

      {activeTab === "recipes" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((rec) => {
              const availability = checkRecipeStockAvailability(rec, items);
              const hasMissing = availability.some((a) => !a.isSufficient);
              return (
                <div key={rec.id} className="rounded-xl border bg-card p-4 flex flex-col justify-between shadow-xs transition-all hover:border-primary/50">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm leading-tight">{rec.productName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Rendimento: {rec.servings} {rec.yieldUnit}</p>
                      </div>
                      <Badge variant={hasMissing ? "destructive" : "outline"} className="text-[10px]">
                        {hasMissing ? t("recipes.insufficient", { defaultValue: "Insumo Baixo" }) : t("recipes.sufficient", { defaultValue: "Disponível" })}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted/30 p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Custo/Porção</span>
                        <p className="font-bold text-sm text-foreground">${(rec.costPerServingCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">Venda</span>
                        <p className="font-bold text-sm text-foreground">${(rec.sellingPriceCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">Margem</span>
                        <p className={`font-bold text-sm ${rec.estimatedMarginPercent >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                          {rec.estimatedMarginPercent}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs">
                      <span className="font-medium text-muted-foreground text-[11px]">{rec.ingredients.length} Ingredientes Calculados:</span>
                      <div className="divide-y rounded-md border p-1.5 bg-background/50 max-h-36 overflow-y-auto">
                        {rec.ingredients.map((ing) => (
                          <div key={ing.id} className="flex items-center justify-between py-1 text-[11px]">
                            <span className="truncate max-w-[150px]">{ing.name}</span>
                            <span className="font-mono text-muted-foreground">{ing.quantity} {ing.unit} (${(ing.subtotalCostCents / 100).toFixed(2)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t flex flex-wrap justify-between gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => handleSyncRecipePrices(rec)} title="Atualizar custos">
                      <RefreshCw className="size-3 mr-1" /> Custos
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => handleDuplicateRecipe(rec)}>
                        <Copy className="size-3 mr-1" /> Copiar
                      </Button>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleOpenRecipeModal(rec)}>
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {recipes.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                <ChefHat className="mx-auto size-8 mb-2 opacity-40" />
                <p className="font-medium">Nenhuma ficha técnica cadastrada nesta unidade.</p>
                <Button size="sm" onClick={() => handleOpenRecipeModal()} className="mt-3">
                  <Plus className="size-3.5 mr-1" /> Criar Primeira Ficha Técnica
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "items" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar insumo ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-4 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.sku} · {item.supplier}</p>
                    </div>
                    <Badge variant={item.quantity <= item.minQuantity ? "destructive" : "outline"} className="text-[10px]">
                      {item.quantity <= 0 ? "Esgotado" : item.quantity <= item.minQuantity ? "Estoque Baixo" : "Normal"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between border-t pt-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Quantidade</span>
                      <p className="text-lg font-bold">{item.quantity} {item.unit}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Mínimo</span>
                      <p className="text-sm font-medium">{item.minQuantity} {item.unit}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleOpenMovementModal(item)}
                  >
                    <ArrowUpDown className="size-3 mr-1" /> Movimentar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Panel title="Histórico de Movimentações Auditável" subtitle="Rastreabilidade ponta a ponta de saldo, perdas, ajustes e transferências">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 px-3 font-medium">Data/Hora</th>
                  <th className="py-2 px-3 font-medium">Insumo</th>
                  <th className="py-2 px-3 font-medium">Tipo</th>
                  <th className="py-2 px-3 font-medium">Variação</th>
                  <th className="py-2 px-3 font-medium">Saldo Resultante</th>
                  <th className="py-2 px-3 font-medium">Motivo</th>
                  <th className="py-2 px-3 font-medium">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{m.itemName}</td>
                    <td className="py-2.5 px-3 capitalize">
                      <Badge variant="outline" className="text-[10px]">
                        {m.type === "in" ? "Entrada" : m.type === "out" ? "Saída" : m.type === "loss" ? "Perda" : m.type === "transfer" ? "Transferência" : "Ajuste"}
                      </Badge>
                    </td>
                    <td className={`py-2.5 px-3 font-semibold ${m.quantityDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{m.resultingQuantity}</td>
                    <td className="py-2.5 px-3 text-muted-foreground truncate max-w-xs">{m.reason}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{m.performedBy}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      Nenhuma movimentação registrada nesta unidade.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Modal de Ficha Técnica */}
      <Dialog open={recipeModalOpen} onOpenChange={setRecipeModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRecipe ? "Editar Ficha Técnica" : "Nova Ficha Técnica (BOM)"}</DialogTitle>
            <DialogDescription>
              Configure quantidades, perdas, rendimento e calcule o custo unitário e margem líquida por porção.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome do Prato / Receita</Label>
                <Input
                  value={recipeFormData.productName}
                  onChange={(e) => setRecipeFormData({ ...recipeFormData, productName: e.target.value })}
                  placeholder="Ex: Smash Burger Artesanal Clássico"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Porções / Rendimento</Label>
                <Input
                  type="number"
                  min="1"
                  value={recipeFormData.servings}
                  onChange={(e) => setRecipeFormData({ ...recipeFormData, servings: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço de Venda Estimado (USD)</Label>
                <Input
                  type="number"
                  step="0.50"
                  value={(recipeFormData.sellingPriceCents / 100).toFixed(2)}
                  onChange={(e) => setRecipeFormData({ ...recipeFormData, sellingPriceCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Composição de Ingredientes ({recipeFormData.ingredients.length})</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (!items[0]) return;
                    setRecipeFormData({
                      ...recipeFormData,
                      ingredients: [
                        ...recipeFormData.ingredients,
                        {
                          id: `ri-${Date.now()}`,
                          inventoryItemId: items[0].id,
                          name: items[0].name,
                          quantity: 1,
                          unit: (items[0].unit as RecipeUnit) || "units",
                          wastePercentage: 0,
                          unitCostCents: items[0].costCents,
                          subtotalCostCents: items[0].costCents,
                        },
                      ],
                    });
                  }}
                >
                  <Plus className="size-3 mr-1" /> Adicionar Insumo
                </Button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {recipeFormData.ingredients.map((ing, idx) => (
                  <div key={ing.id} className="rounded-lg border p-2 text-xs grid grid-cols-12 gap-2 items-center bg-muted/20">
                    <div className="col-span-5">
                      <select
                        value={ing.inventoryItemId}
                        onChange={(e) => {
                          const chosen = items.find((i) => i.id === e.target.value);
                          if (!chosen) return;
                          const updated = [...recipeFormData.ingredients];
                          const costs = calculateIngredientCost(chosen, ing.quantity, ing.unit, ing.wastePercentage);
                          updated[idx] = {
                            ...ing,
                            inventoryItemId: chosen.id,
                            name: chosen.name,
                            unitCostCents: costs.unitCostCents,
                            subtotalCostCents: costs.subtotalCostCents,
                          };
                          setRecipeFormData({ ...recipeFormData, ingredients: updated });
                        }}
                        className="w-full h-8 rounded border bg-background px-2 text-xs truncate"
                      >
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (${(i.costCents / 100).toFixed(2)}/{i.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3 flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.05"
                        min="0.01"
                        value={ing.quantity}
                        onChange={(e) => {
                          const qty = Math.max(0.001, parseFloat(e.target.value || "0"));
                          const chosen = items.find((i) => i.id === ing.inventoryItemId) || items[0];
                          const updated = [...recipeFormData.ingredients];
                          const costs = chosen ? calculateIngredientCost(chosen, qty, ing.unit, ing.wastePercentage) : { unitCostCents: 0, subtotalCostCents: 0 };
                          updated[idx] = {
                            ...ing,
                            quantity: qty,
                            subtotalCostCents: costs.subtotalCostCents,
                          };
                          setRecipeFormData({ ...recipeFormData, ingredients: updated });
                        }}
                        className="h-8 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground uppercase">{ing.unit}</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="font-bold font-mono text-xs">
                        ${(ing.subtotalCostCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive"
                        onClick={() => {
                          setRecipeFormData({
                            ...recipeFormData,
                            ingredients: recipeFormData.ingredients.filter((_, i) => i !== idx),
                          });
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border-t pt-2">
              <Label>Instruções de Preparo (KDS / Linha)</Label>
              <Input
                placeholder="Ex: Grelhar por 3 min cada lado, aplicar queijo sob abafador..."
                value={recipeFormData.prepInstructions}
                onChange={(e) => setRecipeFormData({ ...recipeFormData, prepInstructions: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipeModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRecipeForm}>Salvar Ficha Técnica</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Movimentação */}
      <Dialog open={movementModalOpen} onOpenChange={setMovementModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Movimentação de Estoque</DialogTitle>
            <DialogDescription>
              Entrada, saída, perda, ajuste de inventário ou transferência entre filiais autorizadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>Insumo</Label>
              <select
                value={selectedItemForMove?.id || ""}
                onChange={(e) => {
                  const itm = items.find((i) => i.id === e.target.value);
                  setSelectedItemForMove(itm || null);
                }}
                className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.quantity} {i.unit} disponíveis)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Movimentação</Label>
              <div className="grid grid-cols-5 gap-1 text-xs">
                {(['in', 'out', 'loss', 'adjustment', 'transfer'] as MovementType[]).map((tType) => (
                  <Button
                    key={tType}
                    type="button"
                    size="sm"
                    variant={moveType === tType ? "default" : "outline"}
                    onClick={() => setMoveType(tType)}
                    className="h-8 px-1 text-[11px] capitalize"
                  >
                    {tType === "in" ? "Entrada" : tType === "out" ? "Saída" : tType === "loss" ? "Perda" : tType === "adjustment" ? "Ajuste" : "Transf."}
                  </Button>
                ))}
              </div>
            </div>

            {moveType === "transfer" && (
              <div className="space-y-1.5">
                <Label>Unidade de Destino</Label>
                <select
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                >
                  {org.locations.filter((l) => l.id !== locationId).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {moveType === "adjustment" ? "Nova Quantidade Contada" : "Quantidade a Movimentar"}
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0.1"
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Motivo / Justificativa</Label>
              <Input
                placeholder="Ex: Recebimento de carga, refugo de corte, remanejamento de salão..."
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleRecordMovement}>Confirmar Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
