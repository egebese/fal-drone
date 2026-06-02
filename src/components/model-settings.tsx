"use client";

import { Volume2, VolumeX } from "lucide-react";
import {
  MODEL_LIST,
  durationLabel,
  type ModelDef,
  type ModelId,
  type VideoSettings,
} from "@/lib/models";

type Props = {
  modelId: ModelId;
  def: ModelDef;
  settings: VideoSettings;
  onPickModel: (id: ModelId) => void;
  onChange: (patch: Partial<VideoSettings>) => void;
};

export function ModelSettings({
  modelId,
  def,
  settings,
  onPickModel,
  onChange,
}: Props) {
  const has = (k: ModelDef["controls"][number]) => def.controls.includes(k);

  return (
    <div className="flex flex-col gap-4">
      {/* Model picker — hidden when only one model is exposed. */}
      {MODEL_LIST.length > 1 && (
        <div>
          <Label>Video model</Label>
          <div className="mt-1.5 grid grid-cols-1 gap-1.5">
            {MODEL_LIST.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPickModel(m.id)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  m.id === modelId
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-black/30 hover:border-white/25"
                }`}
              >
                <span className="text-sm font-medium text-white">{m.label}</span>
                <span className="text-[10px] text-white/45">{m.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {has("duration") && def.durations && (
        <PillRow
          label="Duration"
          options={def.durations}
          value={settings.duration}
          render={durationLabel}
          disabledFn={(v) => def.isOptionDisabled?.("duration", v, settings) ?? false}
          onChange={(v) => onChange({ duration: v })}
        />
      )}

      {has("resolution") && def.resolutions && (
        <PillRow
          label="Resolution"
          options={def.resolutions}
          value={settings.resolution}
          disabledFn={(v) => def.isOptionDisabled?.("resolution", v, settings) ?? false}
          onChange={(v) => onChange({ resolution: v })}
        />
      )}

      {has("aspectRatio") && def.aspectRatios && (
        <PillRow
          label="Aspect ratio"
          options={def.aspectRatios}
          value={settings.aspectRatio}
          onChange={(v) => onChange({ aspectRatio: v })}
        />
      )}

      {has("shotType") && def.shotTypes && (
        <PillRow
          label="Shot type"
          options={def.shotTypes}
          value={settings.shotType}
          render={(v) => v[0].toUpperCase() + v.slice(1)}
          onChange={(v) => onChange({ shotType: v })}
        />
      )}

      {has("cfgScale") && (
        <div className="flex items-center justify-between gap-3">
          <Label>
            CFG scale{" "}
            <span className="ml-1 tabular-nums text-white/50">
              {settings.cfgScale.toFixed(1)}
            </span>
          </Label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.cfgScale}
            onChange={(e) => onChange({ cfgScale: Number(e.target.value) })}
            className="w-40 accent-white"
          />
        </div>
      )}

      {has("audio") && (
        <button
          type="button"
          onClick={() => onChange({ generateAudio: !settings.generateAudio })}
          className="flex w-full items-center justify-between rounded-lg border border-white/12 px-3 py-2 text-sm text-white/85 transition hover:border-white/30"
        >
          <span className="flex items-center gap-2">
            {settings.generateAudio ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            Generate audio
          </span>
          <span
            className={`relative h-5 w-9 rounded-full transition ${
              settings.generateAudio ? "bg-emerald-500/80" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                settings.generateAudio ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      )}

      {has("negative") && (
        <div>
          <Label>
            Negative prompt
            <span className="ml-1 font-normal normal-case text-white/40">
              {def.supportsNegative
                ? "(native)"
                : "(added to the prompt)"}
            </span>
          </Label>
          <textarea
            value={settings.negativePrompt}
            onChange={(e) => onChange({ negativePrompt: e.target.value })}
            rows={2}
            placeholder="What to avoid: guide lines, warping, shaky camera…"
            className="scroll-thin mt-1.5 w-full resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[13px] leading-relaxed text-white outline-none focus:border-white/40"
          />
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
      {children}
    </span>
  );
}

function PillRow({
  label,
  options,
  value,
  render,
  disabledFn,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  render?: (v: string) => string;
  disabledFn?: (v: string) => boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Label>{label}</Label>
      <div className="flex max-w-[230px] flex-wrap justify-end gap-1">
        {options.map((o) => {
          const disabled = disabledFn?.(o) ?? false;
          return (
            <button
              key={o}
              type="button"
              disabled={disabled}
              title={disabled ? "Not available with the current settings" : undefined}
              onClick={() => onChange(o)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                value === o
                  ? "bg-white text-black"
                  : "border border-white/10 bg-black/30 text-white/70 hover:text-white"
              } ${disabled ? "cursor-not-allowed opacity-30 hover:text-white/70" : ""}`}
            >
              {render ? render(o) : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
