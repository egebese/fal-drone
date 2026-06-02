"use client";

import { useEffect } from "react";

/**
 * Close an overlay when Escape is pressed. No-op while `active` is false so the
 * listener is only attached for the open surface.
 */
export function useOnEscape(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}
