import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { btnPrimary, inputCls, LoadingRows, Section, useErr } from "@/components/control/control-ui";
import { listPlatformAdmins, setPlatformRole, type PlatformAdmin } from "@/lib/admin-service";
import { LoadFailure } from "@/components/control/load-failure";
import { requestErrorKind, type RequestErrorKind } from "@/lib/request-error";

export const Route = createFileRoute("/_authenticated/control/admins")({
  head: () => ({
    meta: [
      { title: "Administrators · Servora Control Center" },
      { name: "description", content: "Manage platform administrator and support roles with audited, reason-required changes." },
      { property: "og:title", content: "Administrators · Servora Control Center" },
      { property: "og:description", content: "Manage platform administrator and support roles with audited, reason-required changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admins,
});

function Admins() {
  const { t } = useTranslation("control");
  const errText = useErr();
  const [admins, setAdmins] = useState<PlatformAdmin[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformAdmin["role"]>("support");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<RequestErrorKind | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try { setAdmins(await listPlatformAdmins()); }
    catch (e) { setAdmins(null); setLoadError(requestErrorKind(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); toast.success(t("saved")); setEmail(""); setReason(""); await load(); } catch (e) { setError(errText(e)); }
  };

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{t("nav.admins")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("admins.intro")}</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {loadError ? <LoadFailure kind={loadError} retry={() => void load()} /> : loading ? <LoadingRows rows={2} /> : !admins ? null : (
          <Section title={t("admins.current")}>
            <ul className="divide-y">
              {admins.length === 0 && <li className="p-5 text-sm text-muted-foreground">{t("admins.empty")}</li>}
              {admins.map((a) => (
                <li key={`${a.user_id}-${a.role}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{a.email}</p><p className="text-xs text-muted-foreground">{t(`roles.${a.role}`)}</p></div>
                  <button onClick={() => { const r = window.prompt(t("admins.reasonPrompt")); if (r) void run(() => setPlatformRole(a.email, a.role, false, r)); }}
                    className="h-8 rounded-md px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5">{t("admins.revoke")}</button>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title={t("admins.grantTitle")} hint={t("admins.grantHint")}>
          <div className="grid gap-3 p-5">
            <label className="grid gap-1.5 text-sm font-medium">{t("admins.email")}<input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-medium">{t("admins.role")}
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as PlatformAdmin["role"])}>
                <option value="support">{t("roles.support")}</option><option value="platform_admin">{t("roles.platform_admin")}</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">{t("edit.reason")}<input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button onClick={() => void run(() => setPlatformRole(email.trim(), role, true, reason.trim()))} className={btnPrimary}>{t("admins.grant")}</button>
          </div>
        </Section>
      </div>
    </>
  );
}
