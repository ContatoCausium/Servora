import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, BellRing, ShieldAlert, Sparkles, Check, Smartphone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function WhatsAppPreviewCard() {
  const { t } = useTranslation("common");
  const [phone, setPhone] = useState("+55 (11) 98765-4321");
  const [dailyBrief, setDailyBrief] = useState(true);
  const [alertCritical, setAlertCritical] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  const handleSaveSimulated = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info(
      "Módulo WhatsApp em pré-visualização. Nenhuma mensagem ou disparo foi realizado. O conector seguro estará ativo nas fases seguintes."
    );
  };

  return (
    <Card className="border-dashed border-primary/40 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Notificações & Resumos no WhatsApp</CardTitle>
              <CardDescription className="text-xs">
                Receba o resumo executivo matinal e avisos de ruptura diretamente no celular dos gestores.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]">
            Simulado · Conector Inativo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="rounded-lg border bg-muted/40 p-3 text-muted-foreground flex items-start gap-2.5">
          <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Esta área permite parametrizar horários e regras de alertas inteligentes futuros. Conforme a arquitetura da Fase 6.1,
            <strong> nenhuma mensagem real é despachada</strong> e nenhum webhook pago de terceiros foi acionado.
          </p>
        </div>

        <form onSubmit={handleSaveSimulated} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="font-medium text-foreground flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-muted-foreground" /> Número WhatsApp do Gestor Responsável
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 (11) 90000-0000"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-2 rounded-lg border p-3 bg-background/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Resumo Executivo Matinal (08:30)</p>
                <p className="text-[11px] text-muted-foreground">Vendas do dia anterior, CMV estimado e metas diárias.</p>
              </div>
              <Switch checked={dailyBrief} onCheckedChange={setDailyBrief} />
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <div>
                <p className="font-medium text-foreground">Alerta Imediato de Estoque Crítico</p>
                <p className="text-[11px] text-muted-foreground">Disparo quando itens de alto giro atingirem o nível zero.</p>
              </div>
              <Switch checked={alertCritical} onCheckedChange={setAlertCritical} />
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <div>
                <p className="font-medium text-foreground">Fechamento Semanal Consolidado</p>
                <p className="text-[11px] text-muted-foreground">DRE simplificado e comparação entre lojas no domingo à noite.</p>
              </div>
              <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
            </div>
          </div>

          <Button type="submit" variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> Salvar Preferências de Notificação (Simulado)
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
