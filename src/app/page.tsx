"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plane } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { SettingsDialog } from "@/components/settings-dialog";
import { HelpPanel } from "@/components/help-panel";
import { HistoryDrawer } from "@/components/history-drawer";
import { PromptBar } from "@/components/prompt-bar";
import {
  PathCanvas,
  type PathCanvasHandle,
} from "@/components/path-canvas";
import { hasUserKey, subscribeUserKey } from "@/lib/user-key";
import {
  MODELS,
  DEFAULT_MODEL,
  durationLabel,
  durationSeconds,
  type ModelId,
  type VideoSettings,
} from "@/lib/models";
import { composeVideoPrompt, MOTION_FALLBACK } from "@/lib/prompt";
import {
  loadHistory,
  addHistory,
  clearHistory,
  newId,
  type GenEntry,
} from "@/lib/history";
import {
  uploadToFal,
  autoDrawPath,
  analyzePath,
  writeVideoPrompt,
  animate,
  MissingKeyError,
  AuthError,
} from "@/lib/fal-client";

/** sessionStorage handoff: the result page sets this id to reload a run here. */
const LOAD_KEY = "droneshot-load";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Page() {
  const canvasRef = useRef<PathCanvasHandle | null>(null);
  const router = useRouter();

  const [keyPresent, setKeyPresent] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Pipeline state.
  const [baseUrl, setBaseUrl] = useState<string | null>(null); // clean uploaded frame
  const [bgUrl, setBgUrl] = useState<string | null>(null); // stage background (clean → annotated after auto-path)
  const [text, setText] = useState(""); // optional extra vibe appended to the fixed prompt

  // History.
  const [history, setHistory] = useState<GenEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Model + per-model settings (only Seedance 2.0 Fast is exposed).
  const [modelId, setModelId] = useState<ModelId>(DEFAULT_MODEL);
  const [settings, setSettingsState] = useState<VideoSettings>(
    MODELS[DEFAULT_MODEL].defaults
  );

  // Step flags.
  const [uploading, setUploading] = useState(false);
  const [autoDrawing, setAutoDrawing] = useState(false);
  const [animating, setAnimating] = useState(false);

  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);

  // Drag-and-drop / paste attach. dragDepth tracks nested dragenter/leave so
  // the overlay doesn't flicker when the cursor crosses child elements.
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const pipelineBusy = autoDrawing || animating;
  const def = MODELS[modelId];

  useEffect(() => {
    setKeyPresent(hasUserKey());
    setHistory(loadHistory());
    return subscribeUserKey(setKeyPresent);
  }, []);

  useEffect(() => {
    if (!animating) return;
    startRef.current = Date.now();
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [animating]);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof MissingKeyError) {
      setSettingsOpen(true);
      return;
    }
    if (err instanceof AuthError) {
      setError(err.message);
      setSettingsOpen(true);
      return;
    }
    setError(err instanceof Error ? err.message : "Something went wrong");
  }, []);

  const pickModel = useCallback((id: ModelId) => {
    setModelId(id);
    setSettingsState(MODELS[id].defaults);
  }, []);

  const patchSettings = useCallback((patch: Partial<VideoSettings>) => {
    setSettingsState((s) => ({ ...s, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setBaseUrl(null);
    setBgUrl(null);
    setText("");
    setStatus(null);
    setError(null);
  }, []);

  const handleAttach = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setStatus("Uploading image to fal…");
      try {
        const url = await uploadToFal(file);
        setBaseUrl(url);
        setBgUrl(url);
        setStatus("Ready — press send to generate.");
      } catch (err) {
        handleError(err);
        setStatus(null);
      } finally {
        setUploading(false);
      }
    },
    [handleError]
  );

  // Shared entry point for drag-drop and paste: gate on the key, validate the
  // type, then run the normal upload.
  const acceptImage = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!keyPresent) {
        setSettingsOpen(true);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("That file isn't an image — attach a JPG, PNG or WebP.");
        return;
      }
      void handleAttach(file);
    },
    [keyPresent, handleAttach]
  );

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) acceptImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptImage]);

  const onDragEnter = useCallback((e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    dragDepth.current += 1;
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      acceptImage(e.dataTransfer.files?.[0]);
    },
    [acceptImage]
  );

  const saveEntry = useCallback(
    (e: Omit<GenEntry, "id" | "createdAt">) => {
      const entry: GenEntry = {
        ...e,
        id: newId(),
        createdAt: Date.now(),
      };
      setHistory(addHistory(entry));
      router.push(`/result/${entry.id}`);
    },
    [router]
  );

  const handleSend = useCallback(async () => {
    if (!baseUrl) return;
    setError(null);
    try {
      // 1. Nano draws the camera path, Vision reads it, the LLM turns it into
      //    motion language. The path frame is used ONLY to guide this analysis —
      //    Seedance itself gets the clean frame. All non-fatal — on any failure
      //    we fall back to a generic motion so Seedance still produces a shot.
      let annotatedUrl = baseUrl;
      let analysis: string | undefined;
      let motion: string | null = null;
      let pathSkipped = false;
      setAutoDrawing(true);
      try {
        setStatus("Sketching the drone path…");
        annotatedUrl = await autoDrawPath(baseUrl);

        setStatus("Reading the flight path…");
        analysis = await analyzePath(annotatedUrl);

        setStatus("Writing the camera motion…");
        motion = await writeVideoPrompt(analysis, "", durationSeconds(settings));
      } catch (pathErr) {
        console.warn(
          "Path / analysis step failed; using fallback motion.",
          pathErr
        );
        pathSkipped = true;
      } finally {
        setAutoDrawing(false);
      }

      // 2. Compose the fixed cinematic scaffold around the dynamic motion and
      //    render with the CLEAN frame — the path was only guidance for the
      //    motion analysis, so the model never sees (and can't bleed) the marks.
      const promptText = composeVideoPrompt(motion ?? MOTION_FALLBACK, text);

      setAnimating(true);
      setStatus(
        pathSkipped
          ? `${def.label} is rendering the drone shot (path step skipped)…`
          : `${def.label} is rendering your drone shot…`
      );
      const videoUrl = await animate({
        modelId,
        settings,
        imageUrl: baseUrl,
        prompt: promptText,
      });

      saveEntry({
        mode: "auto",
        modelId,
        modelLabel: def.label,
        durationLabel: durationLabel(settings.duration),
        baseUrl,
        frameUrl: annotatedUrl,
        intent: text || undefined,
        analysis,
        prompt: promptText,
        negative: settings.negativePrompt,
        settings,
        videoUrl,
      });
      setStatus("Done.");
    } catch (err) {
      handleError(err);
      setStatus(null);
    } finally {
      setAutoDrawing(false);
      setAnimating(false);
    }
  }, [baseUrl, text, def, modelId, settings, saveEntry, handleError]);

  const loadEntry = useCallback((e: GenEntry) => {
    setModelId(e.modelId);
    setSettingsState(e.settings);
    setBaseUrl(e.baseUrl);
    setBgUrl(e.baseUrl);
    setText(e.intent ?? "");
    setHistoryOpen(false);
  }, []);

  // "Load into editor" handoff from the result page: pick up the id, find the
  // run in history and preload it. Runs once on mount.
  useEffect(() => {
    let loadId: string | null = null;
    try {
      loadId = sessionStorage.getItem(LOAD_KEY);
      if (loadId) sessionStorage.removeItem(LOAD_KEY);
    } catch {
      /* private mode — ignore */
    }
    if (!loadId) return;
    const found = loadHistory().find((e) => e.id === loadId);
    if (found) loadEntry(found);
  }, [loadEntry]);

  const hasImage = !!baseUrl && !!bgUrl;

  // Defer mounting the hero background video until the page is interactive so
  // it never blocks first paint (the poster shows instantly). Only relevant on
  // the empty state, so we also drop it once an image is attached.
  const [heroVideo, setHeroVideo] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(() => setHeroVideo(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setHeroVideo(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#050505]"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {!hasImage && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden fade-in">
          {heroVideo && (
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/hero-poster.jpg"
            >
              <source src="/hero.mp4" type="video/mp4" />
            </video>
          )}
          {/* Slight overlay so the hero copy stays legible over the footage */}
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/25 to-[#050505]/85" />
        </div>
      )}

      <TopBar
        onSignIn={() => setSettingsOpen(true)}
        onReset={reset}
        onHelp={() => setHelpOpen((v) => !v)}
        onHistory={() => setHistoryOpen(true)}
        historyCount={history.length}
      />

      {/* Stage — fills the space above the prompt bar */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 pb-2 pt-[76px]">
        {!hasImage ? (
          <div className="flex flex-col items-center gap-4 text-center fade-in">
            <span className="lg-pill flex h-16 w-16 items-center justify-center rounded-2xl">
              <Plane className="h-7 w-7 -rotate-45 text-white" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Turn any photo into a drone shot
              </h1>
              <p className="mt-1 max-w-md text-sm text-white/55">
                Attach a Reference image below and press send — Nano Banana 2
                sketches the camera path, then Seedance 2.0 renders the
                cinematic FPV drone shot.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-0 w-full flex-1">
            <PathCanvas
              ref={canvasRef}
              backgroundUrl={bgUrl!}
              color="#ff2b2b"
              brushSize={0.011}
              disabled={true}
            />
          </div>
        )}
      </div>

      <div className="relative z-10 px-5 pb-5">
        <PromptBar
          hasKey={keyPresent}
          onRequestKey={() => setSettingsOpen(true)}
          imageUrl={baseUrl}
          uploading={uploading}
          onAttach={handleAttach}
          onRemoveImage={reset}
          text={text}
          setText={setText}
          modelId={modelId}
          setModelId={pickModel}
          settings={settings}
          setSettings={patchSettings}
          busy={pipelineBusy}
          onSend={handleSend}
        />
      </div>

      {pipelineBusy && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div className="lg-pill breathe flex items-center gap-3 rounded-full px-6 py-2.5 text-sm font-medium text-white">
            <Sparkles className="h-4 w-4" />
            <span>{status ?? "Working…"}</span>
            {animating && (
              <span className="tabular-nums text-white/70">
                {formatElapsed(elapsedMs)}
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="pointer-events-auto fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-2 text-sm text-white shadow-lg">
          {error}
          <button
            className="ml-3 underline"
            type="button"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm fade-in">
          <div className="lg-pill flex items-center gap-3 rounded-2xl border-2 border-dashed border-white/40 px-7 py-5 text-base font-medium text-white">
            <Plane className="h-5 w-5 -rotate-45" />
            {keyPresent
              ? "Drop your reference image to attach"
              : "Sign in with your fal key first"}
          </div>
        </div>
      )}

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <HistoryDrawer
        open={historyOpen}
        entries={history}
        onClose={() => setHistoryOpen(false)}
        onOpen={(e) => router.push(`/result/${e.id}`)}
        onClear={() => setHistory(clearHistory())}
      />
    </main>
  );
}
