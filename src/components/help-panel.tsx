"use client";

import { X } from "lucide-react";
import { useOnEscape } from "@/lib/use-escape";

type Props = { open: boolean; onClose: () => void };

export function HelpPanel({ open, onClose }: Props) {
  useOnEscape(open, onClose);
  if (!open) return null;
  return (
    <aside className="pointer-events-auto absolute right-5 top-20 z-40 w-[360px] max-w-[calc(100vw-40px)] fade-in">
      <div className="lg-dark rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-white/90">
            How it works
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="space-y-3 text-[13px] leading-relaxed text-white/75">
          <li>
            <b className="text-white/90">1. Attach</b> a photo as the first
            frame of the shot.
          </li>
          <li>
            <b className="text-white/90">2. Path.</b>{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">
              nano-banana-2
            </code>{" "}
            sketches a smooth red drone-camera path on the image with 4
            numbered waypoints.
          </li>
          <li>
            <b className="text-white/90">3. Animate.</b>{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">
              seedance-2.0
            </code>{" "}
            receives the path-annotated frame and a fixed cinematic FPV prompt
            that tells it to follow the path but keep the red marks out of the
            final video.
          </li>
          <li>
            <b className="text-white/90">4. Tweak.</b> Open the model settings
            to change duration, resolution, aspect ratio or audio — or add an
            optional vibe note above the send button.
          </li>
        </ol>
        <p className="mt-4 text-[11px] leading-relaxed text-white/45">
          Every step runs on fal.ai with your own key. Nothing is stored on a
          server.
        </p>
      </div>
    </aside>
  );
}
