"use client";

import type { ModelId, VideoSettings } from "./models";

/**
 * Local generation history. Each entry captures every step of a run so the
 * whole pipeline can be reviewed or reloaded later. Stored in localStorage —
 * nothing leaves the browser (fal media URLs stay valid on fal's CDN).
 */
export type GenEntry = {
  id: string;
  createdAt: number;
  mode: "auto" | "custom";
  modelId: ModelId;
  modelLabel: string;
  durationLabel: string;
  baseUrl: string; // clean frame fed to the model
  frameUrl: string; // annotated / path frame (falls back to base)
  intent?: string;
  analysis?: string; // Vision output (auto runs)
  prompt: string; // final video prompt
  negative?: string;
  settings: VideoSettings;
  videoUrl: string;
};

const KEY = "droneshot-history";
const CAP = 50;

/**
 * Unique id for a history entry. `crypto.randomUUID` only exists in secure
 * contexts (HTTPS / localhost); fall back to a timestamp + random suffix so
 * saving never throws on a plain-HTTP origin.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadHistory(): GenEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GenEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: GenEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, CAP)));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function addHistory(entry: GenEntry): GenEntry[] {
  const next = [entry, ...loadHistory()].slice(0, CAP);
  persist(next);
  return next;
}

export function removeHistory(id: string): GenEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): GenEntry[] {
  persist([]);
  return [];
}
