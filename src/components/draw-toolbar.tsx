"use client";

import { Undo2, Redo2, Trash2, Check } from "lucide-react";

export const PATH_COLORS = [
  "#ff2b2b",
  "#ffd400",
  "#22d3ee",
  "#ff3df0",
  "#ffffff",
];

export const BRUSH_SIZES = [
  { label: "S", value: 0.006 },
  { label: "M", value: 0.011 },
  { label: "L", value: 0.018 },
];

type Props = {
  color: string;
  setColor: (c: string) => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  disabled?: boolean;
};

export function DrawToolbar({
  color,
  setColor,
  brushSize,
  setBrushSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  disabled,
}: Props) {
  return (
    <div className="lg-dark pointer-events-auto flex items-center gap-3 rounded-full px-3 py-2">
      {/* Colors */}
      <div className="flex items-center gap-1.5">
        {PATH_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => setColor(c)}
            className="relative h-6 w-6 rounded-full border border-white/20 transition hover:scale-110"
            style={{ background: c }}
            aria-label={`Color ${c}`}
          >
            {color === c && (
              <Check
                className="absolute inset-0 m-auto h-3.5 w-3.5"
                style={{ color: c === "#ffffff" ? "#000" : "#fff" }}
              />
            )}
          </button>
        ))}
        <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-white/20">
          <span
            className="block h-full w-full"
            style={{
              background:
                "conic-gradient(#ff2b2b,#ffd400,#22d3ee,#3b82f6,#ff3df0,#ff2b2b)",
            }}
          />
          <input
            type="color"
            value={color}
            disabled={disabled}
            onChange={(e) => setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom color"
          />
        </label>
      </div>

      <span className="h-5 w-px bg-white/15" />

      {/* Brush size */}
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
        {BRUSH_SIZES.map((b) => (
          <button
            key={b.label}
            type="button"
            disabled={disabled}
            onClick={() => setBrushSize(b.value)}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition ${
              brushSize === b.value
                ? "bg-white text-black"
                : "text-white/70 hover:text-white"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <span className="h-5 w-px bg-white/15" />

      {/* History */}
      <div className="flex items-center gap-1">
        <ToolBtn label="Undo" onClick={onUndo} disabled={disabled || !canUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Redo" onClick={onRedo} disabled={disabled || !canRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Clear"
          onClick={onClear}
          disabled={disabled || !canUndo}
        >
          <Trash2 className="h-4 w-4" />
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
