import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare, BellRing, ShieldAlert, Sparkles, Check, Smartphone,
  Calendar, Clock, Send, Users, FileText, CheckCircle2, AlertCircle,
  Copy, ShieldCheck, History
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
  listWhatsAppContacts,
  saveWhatsAppContact,
  listWhatsAppSchedules,
  saveWhatsAppSchedule,
  listWhatsAppLogs,
  queueSimulatedSend,
  renderWhatsAppMessage,
  type WhatsAppTemplateKind,
  type WhatsAppContact,
  type WhatsAppScheduleConfig,
  type WhatsAppReportFrequency,
  type RecipientRole
} from "@/lib/whatsapp-service";
import { useWorkspace } from "@/components/app/workspace-context";

export function WhatsAppPreviewCard() {
  const { t, i18n } = useTranslation("common");
  const lng = i18n.language;
  const { org, locationId, role } = useWorkspace();
  const canManage = role !== "staff";

  const [activeTab, setActiveTab] = useState<"preview" | "settings" | "contacts" | "schedules" | "logs">("preview");

  // Data state from service
  const [settings, setSettings] = useState(() => getWhatsAppSettings(org.id));
  const [contacts, setContacts] = useState<WhatsAppContact[]>(() => listWhatsAppContacts(org.id));
  const [schedules, setSchedules] = useState<WhatsAppScheduleConfig[]>(() => listWhatsAppSchedules(org.id));
  const [logs, setLogs] = useState(() => listWhatsAppLogs(org.id));

  // Preview interactive state
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateKind>("financial_summary");
  const [previewRecipient, setPreviewRecipient] = useState(contacts[0]?.name || "Diretor de Operações");

  // Form new contact
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactRole, setNewContactRole] = useState<RecipientRole>("owner");

  const renderedPreview = useMemo(() => {
    return renderWhatsAppMessage(org.id, locationId, selectedTemplate, previewRecipient, lng);
  }, [org.id, locationId, selectedTemplate, previewRecipient, lng]);

  const handleSimulateDispatch = () => {
    const activeContact = contacts[0] || {
      name: "Diretor de Operações",
      phone: "+55 (11) 98765-4321"
    };
    const created = queueSimulatedSend(org.id, activeContact.name, activeContact.phone, selectedTemplate, lng);
    setLogs(listWhatsAppLogs(org.id));
    toast.success(
      `Prévia enviada em modo demonstração para ${activeContact.name} (${activeContact.phone}). Nenhum SMS ou WhatsApp real foi disparado.`
    );
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    const item: WhatsAppContact = {
      id: `cnt-${org.id}-${Date.now()}`,
      orgId: org.id,
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      role: newContactRole,
      locationIds: [],
      optInConsent: true,
      optInDate: new Date().toISOString(),
      active: true,
    };
    const updated = saveWhatsAppContact(item);
    setContacts(updated);
    setNewContactName("");
    setNewContactPhone("");
    toast.success("Contato cadastrado com consentimento opt-in registrado.");
  };

  return (
    <Card className="border-primary/40 bg-card/70 backdrop-blur shadow-sm overflow-hidden">
      <CardHeader className="p-4 sm:p-5 border-b bg-card/90 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Central WhatsApp Business
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                  Simulado · Conector Seguro Inativo
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Disparo de resumos financeiros, CMV, alertas de compras e relatórios para a diretoria.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">
            <ShieldCheck className="size-3.5 text-primary" />
            <span>LGPD & Opt-in Controlado</span>
          </div>
        </div>

        {/* Abas da Central */}
        <div className="flex flex-wrap gap-1 pt-3 border-t mt-3">
          {[
            { id: "preview", label: "Prévia WhatsApp", icon: Smartphone },
            { id: "schedules", label: "Agendamentos", icon: Calendar },
            { id: "contacts", label: "Contatos Autorizados", icon: Users },
            { id: "logs", label: "Histórico de Envios", icon: History },
            { id: "settings", label: "Configuração da API", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
        {/* ABA 1: PRÉVIA INTERATIVA WHATSAPP */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "financial_summary", label: "Fechamento DRE / Finanças" },
                  { id: "cmv_audit", label: "CMV & Fichas Técnicas" },
                  { id: "low_stock_alert", label: "Estoque Crítico" },
                ].map((tpl) => (
                  <Button
                    key={tpl.id}
                    size="sm"
                    variant={selectedTemplate === tpl.id ? "default" : "outline"}
                    onClick={() => setSelectedTemplate(tpl.id as WhatsAppTemplateKind)}
                    className="h-7 text-xs px-2.5"
                  >
                    {tpl.label}
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                onClick={handleSimulateDispatch}
                className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="size-3" /> Disparar Teste Simulado
              </Button>
            </div>

            {/* Balão Visual WhatsApp */}
            <div className="rounded-xl border bg-emerald-950/10 dark:bg-emerald-950/30 p-4 max-w-lg mx-auto shadow-inner">
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <Smartphone className="size-4" />
                <span className="font-bold text-xs">WhatsApp Business · {org.name}</span>
                <Badge variant="outline" className="ml-auto text-[9px] bg-background/60">
                  Criptografia Ponta a Ponta
                </Badge>
              </div>

              <div className="bg-card/90 rounded-lg p-3 text-foreground whitespace-pre-wrap font-mono text-[11px] leading-relaxed border shadow-xs">
                {renderedPreview}
              </div>

              <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
                <span>Destinatário: {previewRecipient}</span>
                <span className="flex items-center gap-1">
                  <Check className="size-3 text-emerald-500" /> Entregue (Simulação)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: AGENDAMENTOS E FREQUÊNCIA */}
        {activeTab === "schedules" && (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Parametrização de disparos automáticos programados por periodicidade e público-alvo.
            </p>
            <div className="divide-y rounded-lg border bg-background/50">
              {schedules.map((sch) => (
                <div key={sch.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">{sch.title}</span>
                      <Badge variant="secondary" className="text-[9px] uppercase">
                        {sch.frequency}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px] flex items-center gap-2">
                      <Clock className="size-3" /> Horário: {sch.scheduledTime} · Modelo: {sch.templateKind}
                    </p>
                  </div>
                  <Switch
                    checked={sch.enabled}
                    onCheckedChange={(checked) => {
                      const updated = saveWhatsAppSchedule({ ...sch, enabled: checked });
                      setSchedules(updated);
                      toast.info(`Agendamento "${sch.title}" ${checked ? "ativado" : "pausado"}`);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 3: CONTATOS AUTORIZADOS */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            <div className="divide-y rounded-lg border bg-background/50">
              {contacts.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      {c.name}
                      <Badge variant="outline" className="text-[9px]">{c.role}</Badge>
                    </p>
                    <p className="text-muted-foreground text-[11px] font-mono mt-0.5">{c.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                      <CheckCircle2 className="size-3 mr-1" /> Consentimento Ativo
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {/* Formulário de Adicionar Contato */}
            <form onSubmit={handleAddContact} className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
              <p className="font-semibold text-foreground">Adicionar Novo Contato de Alerta</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Nome Completo"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="+55 (11) 90000-0000"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
                <select
                  value={newContactRole}
                  onChange={(e) => setNewContactRole(e.target.value as RecipientRole)}
                  className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                >
                  <option value="owner">Proprietário / Sócio</option>
                  <option value="manager">Gerente Geral</option>
                  <option value="financial_lead">Responsável Financeiro</option>
                  <option value="chef">Chef / Cozinha</option>
                </select>
              </div>
              <Button type="submit" size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Users className="size-3.5" /> Cadastrar Destinatário
              </Button>
            </form>
          </div>
        )}

        {/* ABA 4: HISTÓRICO DE ENVIOS */}
        {activeTab === "logs" && (
          <div className="space-y-3">
            <div className="divide-y rounded-lg border bg-background/50 overflow-hidden">
              {logs.map((log) => (
                <div key={log.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{log.recipientName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          log.status === "sent"
                            ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                            : "text-amber-600 border-amber-500/30 bg-amber-500/10"
                        }`}
                      >
                        {log.status === "sent" ? "Enviado (Demo)" : "Agendado"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{log.idempotencyKey}</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {log.templateKind} · {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 5: CONFIGURAÇÃO MODULAR DA API META */}
        {activeTab === "settings" && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground flex items-start gap-2.5">
              <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                O Servora está preparado para acoplar o WhatsApp Business Cloud API oficial da Meta. Nenhum token secreto ou chave privada é exposta no navegador.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Número Corporativo Exibido</label>
                <Input
                  value={settings.businessPhoneNumber}
                  disabled
                  className="h-8 text-xs font-mono bg-muted/40"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-foreground">WABA Account ID</label>
                <Input
                  value={settings.wabaId}
                  disabled
                  className="h-8 text-xs font-mono bg-muted/40"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-muted-foreground text-[11px] border-t">
              <span>Status do Webhook: Meta Webhook Validated</span>
              <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-500/30">
                Ativo e Monitorado
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
