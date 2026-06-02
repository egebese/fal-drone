"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type PathCanvasState = { strokes: number; canRedo: boolean };

export type PathCanvasHandle = {
  /** The visible canvas is already the full-resolution composite. */
  exportComposite: () => Promise<Blob | null>;
  hasStrokes: () => boolean;
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

type Point = { x: number; y: number }; // normalized 0..1
type Stroke = { color: string; width: number; points: Point[] }; // width = fraction of min dim

type Props = {
  backgroundUrl: string;
  color: string;
  /** Brush width as a fraction of the image's shorter side. */
  brushSize: number;
  disabled?: boolean;
  onState?: (s: PathCanvasState) => void;
};

const MAX_DIM = 2048; // cap backing-store resolution for performance

export const PathCanvas = forwardRef<PathCanvasHandle, Props>(
  function PathCanvas(
    { backgroundUrl, color, brushSize, disabled = false, onState },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const redoRef = useRef<Stroke[]>([]);
    const drawingRef = useRef<Stroke | null>(null);
    const [ready, setReady] = useState(false);

    const emit = useCallback(() => {
      onState?.({
        strokes: strokesRef.current.length,
        canRedo: redoRef.current.length > 0,
      });
    }, [onState]);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      }
      const minDim = Math.min(w, h);
      const all = drawingRef.current
        ? [...strokesRef.current, drawingRef.current]
        : strokesRef.current;
      for (const s of all) drawStroke(ctx, s, w, h, minDim);
      if (all.some((s) => s.points.length > 1)) {
        drawWaypoints(ctx, all, w, h, minDim);
      }
    }, []);

    /* Load background; size the backing store to the image's real aspect ratio. */
    useEffect(() => {
      setReady(false);
      const img = new Image();
      img.crossOrigin = "anonymous";
      const apply = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const natW = img.naturalWidth || 1280;
        const natH = img.naturalHeight || 720;
        const scale = Math.min(1, MAX_DIM / Math.max(natW, natH));
        canvas.width = Math.max(1, Math.round(natW * scale));
        canvas.height = Math.max(1, Math.round(natH * scale));
        imgRef.current = img;
        setReady(true);
        render();
      };
      img.onload = apply;
      img.onerror = apply;
      img.src = backgroundUrl;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [backgroundUrl]);

    const toNorm = (e: React.PointerEvent): Point => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: clamp01((e.clientX - rect.left) / rect.width),
        y: clamp01((e.clientY - rect.top) / rect.height),
      };
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (disabled || !ready) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drawingRef.current = { color, width: brushSize, points: [toNorm(e)] };
      render();
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      drawingRef.current.points.push(toNorm(e));
      render();
    };

    const endStroke = () => {
      const stroke = drawingRef.current;
      drawingRef.current = null;
      if (stroke && stroke.points.length > 1) {
        strokesRef.current.push(stroke);
        redoRef.current = []; // a new stroke invalidates the redo stack
        emit();
      }
      render();
    };

    useImperativeHandle(ref, () => ({
      hasStrokes: () => strokesRef.current.length > 0,
      undo: () => {
        const s = strokesRef.current.pop();
        if (s) redoRef.current.push(s);
        emit();
        render();
      },
      redo: () => {
        const s = redoRef.current.pop();
        if (s) strokesRef.current.push(s);
        emit();
        render();
      },
      clear: () => {
        strokesRef.current = [];
        redoRef.current = [];
        drawingRef.current = null;
        emit();
        render();
      },
      exportComposite: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
      },
    }));

    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="relative inline-flex max-h-full max-w-full">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            className="block h-auto max-h-full w-auto max-w-full touch-none select-none rounded-xl"
            style={{ cursor: disabled ? "default" : "crosshair" }}
          />
          {!ready && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/50">
              Loading image…
            </div>
          )}
        </div>
      </div>
    );
  }
);

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
  minDim: number
) {
  if (stroke.points.length < 1) return;
  const lineW = Math.max(1.5, stroke.width * minDim);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Soft glow underlay in the stroke's own color.
  ctx.strokeStyle = withAlpha(stroke.color, 0.35);
  ctx.lineWidth = lineW * 2.4;
  ctx.beginPath();
  traceCatmullRom(ctx, stroke.points, w, h);
  ctx.stroke();

  // Crisp line.
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  traceCatmullRom(ctx, stroke.points, w, h);
  ctx.stroke();
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const n =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Sample N points evenly along the combined path (by arc length). Used to
 * place numbered maneuver waypoints — Vision reads them and the LLM allocates
 * a time slice per waypoint so the video covers the whole path.
 */
function samplePathPoints(strokes: Stroke[], n: number): Point[] {
  const pts: Point[] = strokes.flatMap((s) => s.points);
  if (pts.length < 2) return [];
  const dists: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    dists.push(
      dists[i - 1] +
        Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    );
  }
  const total = dists[dists.length - 1];
  if (total === 0) return [];
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const target = ((i + 0.5) / n) * total;
    let j = 1;
    while (j < dists.length - 1 && dists[j] < target) j++;
    const span = dists[j] - dists[j - 1] || 1;
    const t = (target - dists[j - 1]) / span;
    out.push({
      x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t,
      y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t,
    });
  }
  return out;
}

function drawWaypoints(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  w: number,
  h: number,
  minDim: number
) {
  const pts = samplePathPoints(strokes, 4);
  if (pts.length === 0) return;
  const fill = strokes[0]?.color ?? "#ff2b2b";
  const r = Math.max(10, minDim * 0.024);
  const ring = Math.max(1.5, minDim * 0.0035);
  ctx.font = `bold ${Math.round(r * 1.25)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i].x * w;
    const y = pts[i].y * h;
    // halo
    ctx.beginPath();
    ctx.arc(x, y, r + ring + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fill();
    // filled marker
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    // white ring
    ctx.lineWidth = ring;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    // number
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(i + 1), x, y + r * 0.04);
  }
}

/** Smooth the polyline with a Catmull-Rom spline so paths look like flight arcs. */
function traceCatmullRom(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  w: number,
  h: number
) {
  if (pts.length === 1) {
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    ctx.lineTo(pts[0].x * w, pts[0].y * h);
    return;
  }
  const p = pts.map((pt) => ({ x: pt.x * w, y: pt.y * h }));
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i === 0 ? 0 : i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2 < p.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}
