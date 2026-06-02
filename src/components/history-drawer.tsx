"use client";

import { X, Trash2, Clock, Film } from "lucide-react";
import type { GenEntry } from "@/lib/history";
import { useOnEscape } from "@/lib/use-escape";

type Props = {
  open: boolean;
  entries: GenEntry[];
  onClose: () => void;
  onOpen: (e: GenEntry) => void;
  onClear: () => void;
};

export function HistoryDrawer({ open, entries, onClose, onOpen, onClear }: Props) {
  useOnEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="lg-dark fade-in relative z-10 flex h-full w-[380px] max-w-[calc(100vw-32px)] flex-col rounded-l-2xl">
        <div className="flex shrink-0 items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/70" />
            <h2 className="text-sm font-semibold text-white">History</h2>
            <span className="text-xs text-white/40">{entries.length}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5">
          {entries.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-2 text-center text-white/45">
              <Film className="h-8 w-8" />
              <p className="text-sm">No drone shots yet.</p>
              <p className="text-xs">Your generations and their steps land here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              {entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.frameUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] text-white/90">
                      {e.durationLabel}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-white">
                        {e.modelLabel}
                      </span>
                      <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white/60">
                        {e.mode}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-white/50">
                      {e.prompt || "(no prompt)"}
                    </p>
                    <p className="text-[10px] text-white/35">{relTime(e.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div className="shrink-0 p-5 pt-3">
            <button
              type="button"
              onClick={onClear}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 transition hover:border-red-400/40 hover:text-red-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear history
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
