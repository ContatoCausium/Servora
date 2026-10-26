import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { History } from "lucide-react";

import { LoadFailure } from "@/components/control/load-failure";
import { EmptyState } from "@/components/app/states";
import { inputCls, LoadingRows } from "@/components/control/control-ui";
import { useControlData } from "@/components/control/use-control-data";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/control/audit")({
  head: () => ({
    meta: [
      { title: "Audit log · Servora Control Center" },
      { name: "description", content: "Immutable record of sensitive changes across the Servora platform." },
      { property: "og:title", content: "Audit log · Servora Control Center" },
      { property: "og:description", content: "Immutable record of sensitive changes across the Servora platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { t, i18n } = useTranslation("control");
  const { data, error, loading, reload } = useControlData(500);
  const [org, setOrg] = useState("all");
  const [scope, setScope] = useState<"all" | "platform">("all");
  const rows = useMemo(() => (data?.audit ?? []).filter((a) =>
    (org === "all" || a.org_id === org) && (scope === "all" || a.action.startsWith("platform.")),
  ), [data, org, scope]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{t("nav.audit")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("auditPage.subtitle")}</p>
      </header>
      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,240px)_minmax(0,200px)]">
        <select aria-label={t("audit.org")} className={inputCls} value={org} onChange={(e) => setOrg(e.target.value)}>
          <option value="all">{t("auditPage.allOrgs")}</option>
          {data?.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select aria-label={t("auditPage.scope")} className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as "all" | "platform")}>
          <option value="all">{t("auditPage.allEvents")}</option><option value="platform">{t("auditPage.platformOnly")}</option>
        </select>
      </div>
      {error && <LoadFailure kind={error} retry={() => void reload()} />}
      {loading ? <LoadingRows /> : !data ? null : rows.length === 0 ? <EmptyState icon={<History className="size-5" />} title={t("audit.empty")} /> : (
        <div className="surface min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>{["when", "action", "org", "reason"].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{t(`audit.${h}`)}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted-foreground">{fmtDate(r.created_at, i18n.language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-4 py-2.5 font-medium">{t(`actions.${r.action}`, { defaultValue: r.action })}</td>
                  <td className="px-4 py-2.5">{r.org_name ?? t("audit.platform")}</td>
                  <td className="max-w-[320px] truncate px-4 py-2.5 text-muted-foreground" title={typeof r.metadata?.["reason"] === "string" ? r.metadata["reason"] : ""}>
                    {typeof r.metadata?.["reason"] === "string" ? r.metadata["reason"] : typeof r.metadata?.["authorization_note"] === "string" ? r.metadata["authorization_note"] : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
