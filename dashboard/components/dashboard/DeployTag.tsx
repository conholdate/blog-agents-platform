"use client";

// Identity tags for deploy env/provider — deliberately distinct from the green/red/
// blue/amber palette WorkflowStatusBadge reserves for run status, so they never
// read as a second status signal.
const ENV_STYLES: Record<"production" | "staging", string> = {
  production: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-700",
  staging:    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

const PROVIDER_STYLES: Record<"aws" | "ceph", string> = {
  aws:  "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-700",
  ceph: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-700",
};

export function EnvTag({ env }: { env: "production" | "staging" }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border shrink-0 ${ENV_STYLES[env]}`}>
      {env === "production" ? "Prod" : "Staging"}
    </span>
  );
}

export function ProviderTag({ provider }: { provider: "aws" | "ceph" }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide border shrink-0 ${PROVIDER_STYLES[provider]}`}>
      {provider}
    </span>
  );
}
