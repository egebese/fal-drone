"use client";

import { Plane, Check, HelpCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { hasUserKey, subscribeUserKey } from "@/lib/user-key";

type Props = {
  onSignIn: () => void;
  onReset: () => void;
  onHelp: () => void;
  onHistory: () => void;
  historyCount: number;
};

export function TopBar({
  onSignIn,
  onReset,
  onHelp,
  onHistory,
  historyCount,
}: Props) {
  const [keyPresent, setKeyPresent] = useState(false);
  useEffect(() => {
    setKeyPresent(hasUserKey());
    return subscribeUserKey(setKeyPresent);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onReset}
        className="pointer-events-auto absolute left-5 top-5 z-30 flex items-center gap-3"
        aria-label="New drone shot"
      >
        <span className="lg-pill flex h-9 w-9 items-center justify-center rounded-xl">
          <Plane className="h-[18px] w-[18px] -rotate-45 text-white" />
        </span>
        <span className="text-base font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          Drone Shot
        </span>
        <span className="lg-pill rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
          Beta
        </span>
      </button>

      <div className="pointer-events-auto absolute right-5 top-5 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={onHistory}
          className="lg-pill relative flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-white/90 transition hover:brightness-110"
        >
          <Clock className="h-4 w-4" />
          History
          {historyCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-semibold tabular-nums">
              {historyCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onHelp}
          className="lg-pill flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-white/90 transition hover:brightness-110"
        >
          <HelpCircle className="h-4 w-4" />
          How it works
        </button>
        <button
          type="button"
          onClick={onSignIn}
          className="lg-solid flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition hover:brightness-95"
        >
          {keyPresent ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              API key
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </div>
    </>
  );
}
