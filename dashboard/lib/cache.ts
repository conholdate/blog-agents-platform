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
