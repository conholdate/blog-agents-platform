export const TTL_KEYWORDS    = 2 * 60 * 60 * 1000; // 2 hours — keyword rows & summaries
export const TTL_OPTIMIZATION = 4 * 60 * 60 * 1000; // 4 hours — optimization queue & log
export const TTL_TRANSLATION = 4 * 60 * 60 * 1000; // 4 hours — translation scan & history (daily scan cadence)
export const TTL_URL_VALIDATOR = 6 * 60 * 60 * 1000; // 6 hours — scan results (date-stamped)
export const TTL_WORKFLOWS = 5 * 60 * 1000; // 5 minutes — CI runs change on the order of minutes
export const TTL_WORKFLOW_SCHEDULES = 6 * 60 * 60 * 1000; // 6 hours — cron schedules only change when a workflow YAML is edited
export const TTL_REPO_DOCTOR = 6 * 60 * 60 * 1000; // 6 hours — scan results; weekly cron/webhook explicitly invalidate on change
export const TTL_REPO_DOCTOR_PREVIEW = 10 * 60 * 1000; // 10 minutes — short-lived fix preview, so confirm commits exactly what was shown

interface Entry<T> { data: T; ts: number }

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string, ttlMs: number): T | null {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return null;
  if (Date.now() - e.ts > ttlMs) { store.delete(key); return null; }
  return e.data;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidateCache(...keys: string[]): void {
  keys.forEach((k) => store.delete(k));
}
