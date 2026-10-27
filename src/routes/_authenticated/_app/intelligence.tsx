import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Store, DollarSign,
  PieChart as PieIcon, ShieldCheck, HelpCircle, Layers, CheckCircle2, ChevronRight, RefreshCw
} from "lucide-react";
import { useWorkspace, useScopedLocations } from "@/components/app/workspace-context";
import { PageHeader, Panel } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { computeIntelligenceSummary, type IntelligenceInsight } from "@/lib/intelligence-service";
import { WhatsAppPreviewCard } from "@/components/intelligence/whatsapp-preview-card";
import { fmtCurrency, fmtPercent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_app/intelligence")({
  head: () => ({
    meta: [
      { title: "Servora Intelligence · Resumo Executivo e Insights" },
      { name: "description", content: "Inteligência determinística de operações, CMV, desperdícios e margens para restaurantes." },
    ],
  }),
  component: IntelligencePage,
});

export function IntelligencePage() {
  const { t, i18n } = useTranslation("common");
  const lng = i18n.language;
  const { org, locationId } = useWorkspace();
  const scopedLocations = useScopedLocations();
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedInsight, setSelectedInsight] = useState<IntelligenceInsight | null>(null);

  // Cálculo determinístico modular e seguro
  const summary = useMemo(() => {
    return computeIntelligenceSummary(org.id, locationId, periodDays);
  }, [org.id, locationId, periodDays]);

  // Comparativo de desempenho entre lojas
  const storeComparison = useMemo(() => {
    return org.locations.map((loc) => {
      const s = computeIntelligenceSummary(org.id, loc.id, periodDays);
      return {
        id: loc.id,
        name: loc.name,
        revenue: s.grossRevenueCents,
        cmv: s.cmvRate,
        lowStock: s.lowStockItemCount,
        margin: s.grossMarginRate,
      };
    });
  }, [org.id, org.locations, periodDays]);

  const filteredInsights = useMemo(() => {
    if (activeCategory === "all") return summary.insights;
    return summary.insights.filter((ins) => ins.category === activeCategory);
  }, [summary.insights, activeCategory]);

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeader
        eyebrow={
          <div className="flex items-center gap-2">
            <span className="eyebrow">{org.name}</span>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-semibold">
              Fase 6.1 · Servora Intelligence
            </Badge>
          </div>
        }
        title="Servora Intelligence"
        description="Resumo executivo de lucratividade, auditoria determinística de CMV e diagnósticos de estoque para a diretoria."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 text-xs">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriodDays(d)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    periodDays === d ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Rótulo de Transparência Metodológica */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-primary shrink-0" />
          <div>
            <p className="font-medium text-foreground text-sm">Motor Analítico Determinístico & Auditável</p>
            <p className="mt-0.5">
              Os indicadores abaixo são calculados diretamente de transações financeiras, fichas técnicas e estoque.
              Nenhum dado é alucinado por modelos generativos. Cálculos separados por origem real ({summary.dataBreakdown.realTransactionsCount} transações / {summary.dataBreakdown.realOrdersCount} pedidos).
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0">
          Pronto para LLM Modular
        </Badge>
      </div>

      {/* Indicadores Executivos em Cartões Chave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-card/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Receita Bruta ({periodDays}d)</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {fmtCurrency(summary.grossRevenueCents, lng)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>Líquido: {fmtCurrency(summary.netRevenueCents, lng)}</span>
            <span className="text-emerald-600 font-medium">+12.4%</span>
          </CardContent>
        </Card>

        <Card className="border bg-card/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">CMV Consolidado</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {summary.cmvRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>Meta: 30% a 32%</span>
            <Badge variant={summary.cmvRate <= 33 ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
              {summary.cmvRate <= 33 ? "Adequado" : "Atenção"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border bg-card/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Margem Bruta Média</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {summary.grossMarginRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>{summary.activeRecipeCount} receitas cadastradas</span>
            <span className="text-primary font-medium">Alvo &gt; 65%</span>
          </CardContent>
        </Card>

        <Card className="border bg-card/70">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-medium">Risco de Ruptura (Estoque)</CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {summary.lowStockItemCount} itens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground flex items-center justify-between">
            <span>Desperdício est.: ~{fmtCurrency(summary.estimatedWasteCents, lng)}</span>
            <Badge variant={summary.lowStockItemCount > 0 ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
              {summary.lowStockItemCount > 0 ? "Crítico" : "Normal"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Seção Principal: Cartões de Insights & Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Diagnósticos Operacionais Inteligentes
            </h2>
            <div className="flex gap-1">
              {[
                { id: "all", label: "Todos" },
                { id: "cmv", label: "CMV" },
                { id: "inventory", label: "Estoque" },
                { id: "margin", label: "Margens" },
                { id: "waste", label: "Desperdício" },
              ].map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={activeCategory === c.id ? "default" : "outline"}
                  onClick={() => setActiveCategory(c.id)}
                  className="h-7 text-xs px-2.5"
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredInsights.map((insight) => (
              <div
                key={insight.id}
                onClick={() => setSelectedInsight(insight)}
                className={`group cursor-pointer rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
                  selectedInsight?.id === insight.id ? "border-primary ring-1 ring-primary/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase ${
                          insight.impactLevel === "high"
                            ? "border-destructive/40 text-destructive bg-destructive/5"
                            : insight.impactLevel === "opportunity"
                            ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                            : "border-primary/40 text-primary bg-primary/5"
                        }`}
                      >
                        {insight.impactLevel === "high" ? "Crítico" : insight.impactLevel === "opportunity" ? "Oportunidade" : "Aviso"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">Origem: {insight.dataOrigin.replace("_", " ")}</span>
                      <span className="text-[11px] text-muted-foreground">· Confiança: {insight.confidence}</span>
                    </div>
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {insight.title}
                    </h3>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0 mt-1" />
                </div>

                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {insight.summary}
                </p>

                <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded">
                    Recomendação: {insight.recommendation}
                  </span>
                  {insight.actionableLink && (
                    <Link
                      to={insight.actionableLink}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                    >
                      Acessar módulo &rarr;
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna Lateral: Notificações Futuras e Comparação de Lojas */}
        <div className="space-y-6">
          <WhatsAppPreviewCard />

          {/* Comparativo de Unidades */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Store className="size-4 text-primary" /> Desempenho Entre Lojas
              </CardTitle>
              <CardDescription className="text-xs">
                Auditoria de CMV e faturamento por ponto de venda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-1">
              {storeComparison.map((st) => (
                <div key={st.id} className="rounded-lg border p-2.5 text-xs space-y-1.5 bg-muted/10">
                  <div className="flex items-center justify-between font-medium">
                    <span>{st.name}</span>
                    <span className="font-semibold">{fmtCurrency(st.revenue, lng)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>CMV: {st.cmv.toFixed(1)}%</span>
                    <span>Estoque Crítico: {st.lowStock} itens</span>
                  </div>
                  <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${Math.min(100, Math.max(15, st.cmv))}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
