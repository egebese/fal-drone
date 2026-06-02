"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Key,
  ExternalLink,
  Check,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import {
  clearUserKey,
  getUserKey,
  isValidKeyShape,
  maskKey,
  setUserKey,
  subscribeUserKey,
} from "@/lib/user-key";
import { verifyKey, MissingKeyError, AuthError } from "@/lib/fal-client";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsDialog({ open, onClose }: Props) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [savedPreview, setSavedPreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      const k = getUserKey();
      setHasKey(!!k);
      setSavedPreview(k ? maskKey(k) : null);
    };
    refresh();
    return subscribeUserKey(refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    setValue(getUserKey() ?? "");
    setSaved(false);
    setVerifyResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = () => {
    const v = value.trim();
    setUserKey(v);
    setSaved(true);
    setVerifyResult(null);
    setTimeout(() => setSaved(false), 1200);
  };

  const clear = () => {
    clearUserKey();
    setValue("");
    setVerifyResult(null);
  };

  // Save the entered key, then run a real authenticated check against fal.
  const verify = async () => {
    const v = value.trim();
    if (!v) return;
    setUserKey(v);
    setVerifying(true);
    setVerifyResult(null);
    try {
      await verifyKey();
      setVerifyResult({ ok: true });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? "fal rejected this key (401). Copy it again from the dashboard — it may be revoked or mistyped."
          : err instanceof MissingKeyError
            ? "Enter a key first."
            : err instanceof Error
              ? err.message
              : "Could not verify the key.";
      setVerifyResult({ ok: false, message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="lg-dark w-full max-w-md rounded-2xl p-6 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <Key className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Your fal API key</h2>
              <p className="text-xs text-white/60">
                Stored only in your browser. Never sent anywhere else.
              </p>
            </div>
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

        <label className="block text-xs font-medium uppercase tracking-wider text-white/60">
          API Key
        </label>
        <input
          ref={inputRef}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder="key_id:secret (or fal_xxx…)"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"
        />

        {value.trim() && !isValidKeyShape(value) && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/90">
            This doesn&apos;t look like a fal key. Keys are usually
            <code className="mx-1 text-amber-200">key_id:secret</code>— copy it
            exactly from fal.ai/dashboard/keys.
          </p>
        )}

        {savedPreview && (
          <p className="mt-2 text-[11px] text-white/50">
            Currently saved:{" "}
            <code className="text-white/70">{savedPreview}</code>
          </p>
        )}

        {verifyResult && (
          <p
            className={`mt-2 flex items-center gap-1.5 text-[12px] leading-relaxed ${
              verifyResult.ok ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {verifyResult.ok ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                This key works — fal accepted it.
              </>
            ) : (
              <>
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{verifyResult.message}</span>
              </>
            )}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
          <ExternalLink className="h-3.5 w-3.5" />
          <a
            href="https://fal.ai/dashboard/keys"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-white"
          >
            Create a key at fal.ai/dashboard/keys
          </a>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!value.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:bg-white/30"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              "Save key"
            )}
          </button>
          <button
            type="button"
            onClick={verify}
            disabled={!value.trim() || verifying}
            className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2.5 text-sm text-white/80 transition hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 spin-slow" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verify
          </button>
          {hasKey && (
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2.5 text-sm text-white/80 transition hover:border-white/40 hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-white/45">
          Your key is attached per-request straight from your browser to{" "}
          <code className="text-white/70">fal.run</code> via the fal client.
          Nothing is stored on any server — Nano Banana 2, OpenRouter and LTX
          2.3 are all billed directly to your fal account.
        </p>
      </div>
    </div>
  );
}
