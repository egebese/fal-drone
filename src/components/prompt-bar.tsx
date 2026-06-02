"use client";

import { useEffect, useRef, useState } from "react";
import {
  ImageIcon,
  Send,
  Loader2,
  KeyRound,
  Sliders,
  X,
  ChevronDown,
} from "lucide-react";
import { ModelSettings } from "./model-settings";
import { MODELS, type ModelId, type VideoSettings } from "@/lib/models";
import { useOnEscape } from "@/lib/use-escape";

const MAX_CHARS = 1000;

type Props = {
  hasKey: boolean;
  onRequestKey: () => void;

  imageUrl: string | null;
  uploading: boolean;
  onAttach: (file: File) => void;
  onRemoveImage: () => void;

  text: string;
  setText: (v: string) => void;

  modelId: ModelId;
  setModelId: (id: ModelId) => void;
  settings: VideoSettings;
  setSettings: (patch: Partial<VideoSettings>) => void;

  busy: boolean; // any pipeline step in flight
  onSend: () => void; // main action
};

export function PromptBar(p: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const def = MODELS[p.modelId];

  useOnEscape(settingsOpen, () => setSettingsOpen(false));

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [p.text]);

  const hasImage = !!p.imageUrl;
  const canSend = !p.busy && p.hasKey && hasImage;

  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!p.hasKey) {
      p.onRequestKey();
      return;
    }
    if (file.type.startsWith("image/")) p.onAttach(file);
  };

  const placeholder = !p.hasKey
    ? "Sign in with your fal key to start…"
    : !hasImage
      ? "Attach a Reference image to begin…"
      : "Optional — add a vibe note (golden hour, faster pace, …) or just press send.";

  return (
    <div
      className={`pointer-events-auto relative mx-auto w-[min(960px,calc(100vw-40px))] ${
        settingsOpen ? "z-50" : "z-30"
      }`}
    >
      {/* Settings popover — floats above the bar on the top layer (over the
          stage) without shifting layout. The transparent full-screen layer
          behind it closes the panel on an outside click. */}
      {settingsOpen && (
        <>
          <div
            className="fixed inset-0"
            onClick={() => setSettingsOpen(false)}
            aria-hidden="true"
          />
          <div className="lg-dark fade-in absolute inset-x-0 bottom-full mb-2 rounded-2xl">
            <div
              className="scroll-thin overflow-y-auto p-4"
              style={{ maxHeight: "60vh" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  Model &amp; settings
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ModelSettings
                modelId={p.modelId}
                def={def}
                settings={p.settings}
                onPickModel={p.setModelId}
                onChange={p.setSettings}
              />
            </div>
          </div>
        </>
      )}

      <div className="lg-dark rounded-[26px] px-4 pt-3 pb-2.5">
        {/* Top row: model + settings button (model selector hidden — only one model exposed) */}
        <div className="mb-2.5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              settingsOpen
                ? "border-white/40 bg-white/10 text-white"
                : "border-white/12 bg-white/[0.04] text-white/85 hover:border-white/30"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            {def.label}
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${settingsOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Reference thumbnail */}
        {hasImage && (
          <div className="mb-2.5 flex items-center gap-2">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl!}
                alt="Reference"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={p.onRemoveImage}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <span className="text-xs text-white/55">
              Press send — Nano Banana 2 will sketch the camera path, then
              Seedance 2.0 renders the drone shot.
            </span>
          </div>
        )}

        {!p.hasKey && (
          <button
            type="button"
            onClick={p.onRequestKey}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 transition hover:border-white/30 hover:bg-white/10"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Add your fal API key to start generating
          </button>
        )}

        <textarea
          ref={taRef}
          value={p.text}
          onChange={(e) => p.setText(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) p.onSend();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none placeholder:text-white/55"
          style={{ minHeight: 28 }}
        />

        {/* Bottom row */}
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!p.hasKey) return p.onRequestKey();
              fileRef.current?.click();
            }}
            disabled={p.uploading}
            className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 text-sm text-white/85 transition hover:border-white/35 hover:bg-white/[0.12]"
          >
            {p.uploading ? (
              <Loader2 className="h-4 w-4 spin-slow" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {hasImage ? "Replace" : "Reference"}
          </button>

          <div className="ml-auto mr-1 text-xs tabular-nums text-white/55">
            {p.text.length} / {MAX_CHARS}
          </div>

          <button
            type="button"
            onClick={p.onSend}
            disabled={!canSend}
            className="lg-solid flex h-9 w-9 items-center justify-center rounded-full transition hover:brightness-95 disabled:opacity-40"
            aria-label="Generate drone shot"
            title="Generate the drone shot"
          >
            {p.busy ? (
              <Loader2 className="h-4 w-4 spin-slow" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
