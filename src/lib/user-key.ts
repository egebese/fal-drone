"use client";

/**
 * Browser-side helper for the user's fal API key (BYOK).
 * The key is stored in localStorage and attached to every fal request via
 * `fal.config({ credentials })`. The server never keeps a key of its own —
 * all model calls go straight from the browser to fal.run.
 */

const STORAGE_KEY = "fal-user-key";
const KEY_SHAPE = /^[A-Za-z0-9_-]{12,}:[A-Za-z0-9_-]{12,}$|^fal_[A-Za-z0-9_-]{20,}$/;

export function getUserKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function setUserKey(key: string): void {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  try {
    if (!trimmed) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* noop */
  }
  try {
    window.dispatchEvent(new Event("fal-user-key-change"));
  } catch {
    /* noop */
  }
}

export function clearUserKey(): void {
  setUserKey("");
}

export function hasUserKey(): boolean {
  return !!getUserKey();
}

export function isValidKeyShape(candidate: string): boolean {
  return KEY_SHAPE.test(candidate.trim());
}

/** Masked preview of a key (first 4 + last 4 chars) so the user can confirm
 * which key is saved without revealing the secret. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (k.length <= 10) return "•".repeat(Math.max(k.length, 4));
  return `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} chars)`;
}

export function subscribeUserKey(cb: (present: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(hasUserKey());
  window.addEventListener("fal-user-key-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("fal-user-key-change", handler);
    window.removeEventListener("storage", handler);
  };
}
