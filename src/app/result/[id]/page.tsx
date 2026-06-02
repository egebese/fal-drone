"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Upload,
  Image as ImageIcon,
  Route,
  Film,
} from "lucide-react";
import { loadHistory, type GenEntry } from "@/lib/history";
import { MODELS } from "@/lib/models";
import { useOnEscape } from "@/lib/use-escape";

const LOAD_KEY = "droneshot-load";

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  // Resolve from localStorage on the client. `ready` distinguishes "still
  // reading" from "read and not found" so we don't flash the not-found state.
  const [entry, setEntry] = useState<GenEntry | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const found = loadHistory().find((e) => e.id === id) ?? null;
    setEntry(found);
    setReady(true);
  }, [id]);

  const goHome = () => router.push("/");
  useOnEscape(true, goHome);

  if (!ready) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#050505] text-sm text-white/50">
        Loading…
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#050505] text-center">
        <span className="lg-pill flex h-14 w-14 items-center justify-center rounded-2xl">
          <Film className="h-6 w-6 text-white" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-white">Result not found</h1>
          <p className="mt-1 text-sm text-white/55">
            This generation isn&apos;t in your history on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={goHome}
          className="lg-solid flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </button>
      </main>
    );
  }

  const def = MODELS[entry.modelId];
  const has = (k: (typeof def.controls)[number]) => def.controls.includes(k);

  const chips: string[] = [entry.modelLabel, entry.durationLabel];
  if (has("resolution")) chips.push(entry.settings.resolution);
  if (has("aspectRatio")) chips.push(entry.settings.aspectRatio);
  if (has("shotType")) chips.push(entry.settings.shotType);
  if (has("cfgScale")) chips.push(`cfg ${entry.settings.cfgScale.toFixed(1)}`);
  if (has("audio"))
    chips.push(entry.settings.generateAudio ? "audio on" : "audio off");

  const loadIntoEditor = () => {
    try {
      sessionStorage.setItem(LOAD_KEY, entry.id);
    } catch {
      /* private mode — ignore, the editor just won't preload */
    }
    router.push("/");
  };

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#050505]">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={goHome}
          className="lg-pill flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-white/90 transition hover:brightness-110"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85"
            >
              {c}
            </span>
          ))}
          <span className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/55">
            {entry.mode}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={loadIntoEditor}
            className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/85 transition hover:border-white/40 hover:bg-white/10"
          >
            <Upload className="h-4 w-4" />
            Load into editor
          </button>
          <a
            href={entry.videoUrl}
            download="drone-shot.mp4"
            target="_blank"
            rel="noreferrer"
            className="lg-solid flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition hover:brightness-95"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </header>

      {/* Body */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {/* Source + path frames, side by side */}
          <div className="grid grid-cols-2 gap-4">
            <Frame
              label="Original image"
              url={entry.baseUrl}
              icon={<ImageIcon className="h-3.5 w-3.5" />}
            />
            <Frame
              label="Camera path"
              url={entry.frameUrl}
              icon={<Route className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Rendered video — kept compact and centered */}
          <div className="mx-auto flex w-full max-w-xl flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-white/50">
              <Film className="h-3.5 w-3.5" />
              Drone shot
            </div>
            <div className="lg-dark rounded-2xl p-2">
              <video
                src={entry.videoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full rounded-xl border border-white/10 bg-black"
              />
            </div>
          </div>

          {/* Prompts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {entry.intent?.trim() && (
              <Block title="Your vibe note">{entry.intent}</Block>
            )}
            {entry.analysis && (
              <Block title="Vision — path reading">{entry.analysis}</Block>
            )}
            <Block title="Video prompt">{entry.prompt || "(none)"}</Block>
            {entry.negative?.trim() && (
              <Block title="Negative prompt">{entry.negative}</Block>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Frame({
  label,
  url,
  icon,
}: {
  label: string;
  url: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-white/50">
        {icon}
        {label}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="w-full rounded-xl border border-white/10 bg-black object-contain"
      />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-white/45">
        {title}
      </div>
      <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] leading-relaxed text-white/80">
        {children}
      </p>
    </div>
  );
}
