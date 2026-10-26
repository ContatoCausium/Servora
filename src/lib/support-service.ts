import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin, listOrganizations } from "@/lib/admin-service";

export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportComment = {
  id: string;
  authorEmail: string;
  authorRole: "support" | "platform_admin";
  content: string;
  isInternal: boolean;
  createdAt: string;
};

export type SupportActivity = {
  id: string;
  action: string;
  actorEmail: string;
  timestamp: string;
  details: string;
};

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  orgId: string | null;
  orgName: string;
  requesterEmail: string;
  assignedTo: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  category: "technical" | "billing_inquiry" | "account_access" | "feature_request";
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  comments: SupportComment[];
  activity: SupportActivity[];
};

export type PlatformNotificationCategory = "system" | "billing" | "security" | "tenant_activity";
export type PlatformNotificationSeverity = "info" | "warning" | "critical";

export type PlatformNotification = {
  id: string;
  title: string;
  message: string;
  category: PlatformNotificationCategory;
  severity: PlatformNotificationSeverity;
  isRead: boolean;
  isDemo: boolean;
  createdAt: string;
  link?: string;
  metadata?: Record<string, unknown>;
};

export type NotificationPreferences = {
  emailAlerts: boolean;
  systemDowntime: boolean;
  securityEvents: boolean;
  billingAlerts: boolean;
  newTicketAssignment: boolean;
};

const INITIAL_DEMO_TICKETS: SupportTicket[] = [
  {
    id: "tkt-demo-1",
    ticketNumber: "SRV-1042",
    subject: "Inconsistência na sincronização de horários de funcionamento",
    description: "Cliente reporta que loja de teste não salva horário após as 22h no painel.",
    orgId: null,
    orgName: "Fictional Bistro Org",
    requesterEmail: "manager@fictionalbistro.com",
    assignedTo: "support@servora.app",
    priority: "medium",
    status: "open",
    category: "technical",
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    comments: [
      {
        id: "cm-1",
        authorEmail: "support@servora.app",
        authorRole: "support",
        content: "Validado no sandbox, trigger exige formato estrito de 24 horas.",
        isInternal: true,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
    activity: [
      {
        id: "act-1",
        action: "ticket.created",
        actorEmail: "manager@fictionalbistro.com",
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        details: "Ticket gerado via portal do cliente",
      },
    ],
  },
  {
    id: "tkt-demo-2",
    ticketNumber: "SRV-1043",
    subject: "Dúvida sobre upgrade de plano Growth para Enterprise",
    description: "Solicita confirmação dos limites de unidades antes de migrar assinatura.",
    orgId: null,
    orgName: "Cantina Demo",
    requesterEmail: "finance@cantinademo.io",
    assignedTo: null,
    priority: "high",
    status: "in_progress",
    category: "billing_inquiry",
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    comments: [],
    activity: [
      {
        id: "act-2",
        action: "ticket.status_changed",
        actorEmail: "support@servora.app",
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        details: "Status alterado para em andamento",
      },
    ],
  },
];

const INITIAL_DEMO_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: "notif-1",
    title: "Certificado SSL renovado com sucesso",
    message: "Infraestrutura de borda renovou todos os certificados wildcard sem instabilidade.",
    category: "system",
    severity: "info",
    isRead: false,
    isDemo: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "notif-2",
    title: "Tentativa repetida de login administrativo bloqueada",
    message: "Múltiplas tentativas falhas registradas de IP desconhecido para conta de suporte.",
    category: "security",
    severity: "critical",
    isRead: false,
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "notif-3",
    title: "Período de teste expirando em 2 organizações",
    message: "Tenants de demonstração alcançam limite de 14 dias nas próximas 24 horas.",
    category: "billing",
    severity: "warning",
    isRead: true,
    isDemo: true,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

let localTickets: SupportTicket[] = [...INITIAL_DEMO_TICKETS];
let localNotifications: PlatformNotification[] = [...INITIAL_DEMO_NOTIFICATIONS];
let localPreferences: NotificationPreferences = {
  emailAlerts: true,
  systemDowntime: true,
  securityEvents: true,
  billingAlerts: true,
  newTicketAssignment: true,
};

export async function getPlatformRole(): Promise<"platform_admin" | "support" | null> {
  try {
    const isAdmin = await isPlatformAdmin();
    if (isAdmin) return "platform_admin";
    const { data } = await supabase.from("user_roles").select("role").limit(1);
    if (data && data.length > 0 && data[0]?.role) {
      return data[0].role as "platform_admin" | "support";
    }
    return null;
  } catch {
    return null;
  }
}

export async function canAccessSupport(): Promise<boolean> {
  const role = await getPlatformRole();
  return role === "platform_admin" || role === "support";
}

export async function listSupportTickets(): Promise<SupportTicket[]> {
  return [...localTickets];
}

export async function createSupportTicket(params: {
  subject: string;
  description: string;
  orgId: string | null;
  requesterEmail: string;
  priority: TicketPriority;
  category: SupportTicket["category"];
  actorEmail: string;
}): Promise<SupportTicket> {
  if (!params.subject.trim() || !params.description.trim() || !params.requesterEmail.trim()) {
    throw new Error("missing_fields");
  }

  let orgName = "Plataforma / Global";
  if (params.orgId) {
    const orgs = await listOrganizations().catch(() => []);
    const found = orgs.find((o) => o.id === params.orgId);
    if (found) orgName = found.name;
  }

  const newTicket: SupportTicket = {
    id: `tkt-${Date.now()}`,
    ticketNumber: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
    subject: params.subject.trim(),
    description: params.description.trim(),
    orgId: params.orgId,
    orgName,
    requesterEmail: params.requesterEmail.trim(),
    assignedTo: null,
    priority: params.priority,
    status: "open",
    category: params.category,
    isDemo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    activity: [
      {
        id: `act-${Date.now()}`,
        action: "ticket.created",
        actorEmail: params.actorEmail,
        timestamp: new Date().toISOString(),
        details: "Ticket registrado pelo operador",
      },
    ],
  };

  localTickets = [newTicket, ...localTickets];
  return newTicket;
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  actorEmail: string,
): Promise<SupportTicket> {
  const t = localTickets.find((x) => x.id === ticketId);
  if (!t) throw new Error("ticket_not_found");

  t.status = status;
  t.updatedAt = new Date().toISOString();
  t.activity.push({
    id: `act-${Date.now()}`,
    action: "ticket.status_changed",
    actorEmail,
    timestamp: new Date().toISOString(),
    details: `Status alterado para ${status}`,
  });
  return { ...t };
}

export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority,
  actorEmail: string,
): Promise<SupportTicket> {
  const t = localTickets.find((x) => x.id === ticketId);
  if (!t) throw new Error("ticket_not_found");

  t.priority = priority;
  t.updatedAt = new Date().toISOString();
  t.activity.push({
    id: `act-${Date.now()}`,
    action: "ticket.priority_changed",
    actorEmail,
    timestamp: new Date().toISOString(),
    details: `Prioridade alterada para ${priority}`,
  });
  return { ...t };
}

export async function assignTicket(
  ticketId: string,
  assignedTo: string | null,
  actorEmail: string,
): Promise<SupportTicket> {
  const t = localTickets.find((x) => x.id === ticketId);
  if (!t) throw new Error("ticket_not_found");

  t.assignedTo = assignedTo;
  t.updatedAt = new Date().toISOString();
  t.activity.push({
    id: `act-${Date.now()}`,
    action: "ticket.assigned",
    actorEmail,
    timestamp: new Date().toISOString(),
    details: assignedTo ? `Atribuído a ${assignedTo}` : "Atribuição removida",
  });
  return { ...t };
}

export async function addTicketComment(
  ticketId: string,
  content: string,
  authorEmail: string,
  isInternal: boolean = true,
): Promise<SupportTicket> {
  const t = localTickets.find((x) => x.id === ticketId);
  if (!t) throw new Error("ticket_not_found");
  if (!content.trim()) throw new Error("empty_comment");

  const role = (await getPlatformRole()) ?? "support";
  t.comments.push({
    id: `cm-${Date.now()}`,
    authorEmail,
    authorRole: role,
    content: content.trim(),
    isInternal,
    createdAt: new Date().toISOString(),
  });
  t.updatedAt = new Date().toISOString();
  return { ...t };
}

export async function listNotifications(): Promise<PlatformNotification[]> {
  return [...localNotifications];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const n = localNotifications.find((x) => x.id === id);
  if (n) n.isRead = true;
}

export async function markAllNotificationsAsRead(): Promise<void> {
  localNotifications = localNotifications.map((n) => ({ ...n, isRead: true }));
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return { ...localPreferences };
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  localPreferences = { ...localPreferences, ...prefs };
  return { ...localPreferences };
}

export function resetSupportDemoData(): void {
  localTickets = [...INITIAL_DEMO_TICKETS];
  localNotifications = [...INITIAL_DEMO_NOTIFICATIONS];
}
