import { cn } from "@/lib/utils";

export function OrgLogo({
  logoUrl,
  initials,
  className,
}: {
  logoUrl?: string | undefined;
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-card text-xs font-semibold text-primary",
        className,
      )}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="size-full object-contain p-0.5" /> : initials}
    </span>
  );
}

export function DemoBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "demo-stripe inline-flex items-center gap-1.5 rounded-full border border-warning/40 px-2 py-0.5 text-[11px] font-medium text-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-warning" aria-hidden />
      {label}
    </span>
  );
}

export function ServoraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M9 19.5c0 2.2 3 3.5 7 3.5s7-1.3 7-3.5H9Z" fill="var(--background)" />
      <path d="M10 17.5a6 6 0 0 1 12 0H10Z" fill="var(--background)" opacity=".7" />
      <circle cx="16" cy="9.5" r="1.6" fill="var(--background)" />
    </svg>
  );
}
