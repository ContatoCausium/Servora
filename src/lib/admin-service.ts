/**
 * Platform Control Center data access. Every call is authorized server-side by
 * `is_platform_admin()` inside security-definer database functions and audited.
 * Nothing here grants restaurant (organization) membership implicitly.
 */
import { supabase } from "@/integrations/supabase/client";
import type { OrgStatus } from "@/lib/org-service";
import { requestErrorKind } from "@/lib/request-error";

export type PlanId = "starter" | "growth" | "enterprise";
export type PlatformOrg = {
  id: string; name: string; slug: string; status: OrgStatus; plan: PlanId; store_limit: number;
  store_count: number; member_count: number; owner_count: number; is_demo: boolean; created_at: string;
};
export type PlatformAudit = { id: string; org_id: string | null; org_name: string | null; actor_id: string | null; action: string; target: string | null; metadata: Record<string, unknown>; created_at: string };
export type PlatformAdmin = { user_id: string; email: string; role: "platform_admin" | "support" };

const code = (msg: string) => ["forbidden", "reason_required", "verification_required", "user_not_found", "last_admin", "not_found"].find((c) => msg.includes(c)) ?? "unknown";
async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw new Error(code(error.message) === "unknown" ? requestErrorKind(error) : code(error.message));
  return data as T;
}

export const isPlatformAdmin = async () => {
  try { return Boolean(await call<boolean>("is_platform_admin")); } catch { return false; }
};
export const listOrganizations = () => call<PlatformOrg[]>("admin_list_organizations");
export const listPlatformAudit = (limit = 100) => call<PlatformAudit[]>("admin_list_audit", { _limit: limit });
export const listPlatformAdmins = () => call<PlatformAdmin[]>("admin_list_platform_admins");
export const updateOrganization = (orgId: string, patch: { status?: OrgStatus; plan?: PlanId; storeLimit?: number }, reason: string) =>
  call<void>("admin_update_organization", { _org_id: orgId, _status: patch.status ?? null, _plan: patch.plan ?? null, _store_limit: patch.storeLimit ?? null, _reason: reason });
export const assignOwner = (orgId: string, email: string, verificationNote: string) =>
  call<void>("admin_assign_owner", { _org_id: orgId, _email: email, _verification_note: verificationNote });
export const setPlatformRole = (email: string, role: PlatformAdmin["role"], grant: boolean, reason: string) =>
  call<void>("admin_set_platform_role", { _email: email, _role: role, _grant: grant, _reason: reason });

export type { OrgInsight, PlanDef } from "@/lib/platform-metrics";
import type { OrgInsight, PlanDef } from "@/lib/platform-metrics";
const num = (v: unknown) => Number(v ?? 0);
export const listOrgInsights = async () =>
  (await call<OrgInsight[]>("admin_org_insights")).map((o) => ({
    ...o, store_count: num(o.store_count), active_store_count: num(o.active_store_count), store_limit: num(o.store_limit),
    member_count: num(o.member_count), owner_count: num(o.owner_count), pending_invites: num(o.pending_invites),
  }));
export async function listPlans(): Promise<PlanDef[]> {
  const { data, error } = await supabase.from("billing_plans")
    .select("id,name,price_per_location_cents,currency,default_store_limit,trial_store_limit,trial_days,is_placeholder_pricing")
    .order("price_per_location_cents");
  if (error) throw new Error(requestErrorKind(error));
  return data as PlanDef[];
}
/** Round-trip latency to the backend authorization check (integration health). */
export async function pingBackend() {
  const t0 = performance.now();
  const ok = await call<boolean>("is_platform_admin");
  if (!ok) throw new Error("forbidden");
  return { ok: true, ms: Math.round(performance.now() - t0) };
}
