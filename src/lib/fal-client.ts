"use client";

import { fal } from "@fal-ai/client";
import { getUserKey } from "./user-key";
import {
  AUTO_PATH_PROMPT,
  VISION_SYSTEM,
  VISION_PROMPT,
  PROMPT_WRITER_SYSTEM,
  buildPromptWriterInput,
} from "./prompt";
import { MODELS, type ModelId, type VideoSettings } from "./models";

/* ── Endpoints (every step is a fal model) ───────────────────────── */
const NANO_PATH = "fal-ai/nano-banana-2/edit"; // auto-draw the camera path
const VISION = "openrouter/router/vision"; // read the path + scene
const LLM = "openrouter/router"; // write the video prompt

/* OpenRouter model slugs. Vision-capable model for the analysis step. */
const VISION_MODEL = "google/gemini-2.5-flash";
const LLM_MODEL = "google/gemini-2.5-flash";

export class MissingKeyError extends Error {
  constructor() {
    super("Add your fal API key via Sign in to start.");
    this.name = "MissingKeyError";
  }
}

/** fal rejected the key (401/403) — the key is present but invalid/revoked. */
export class AuthError extends Error {
  constructor() {
    super(
      "fal rejected your API key (401 Unauthorized). Open Sign in and re-enter a valid key from fal.ai/dashboard/keys."
    );
    this.name = "AuthError";
  }
}

/** Map a fal client error to AuthError when it's an authorization failure. */
function mapFalError(err: unknown): unknown {
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 401 || status === 403 || /\b(401|403|unauthor|forbidden)/i.test(msg)) {
    return new AuthError();
  }
  return err;
}

function configure(): void {
  const key = getUserKey();
  if (!key) throw new MissingKeyError();
  fal.config({ credentials: key });
}

/* ── Upload ───────────────────────────────────────────────────────── */
export async function uploadToFal(file: File | Blob): Promise<string> {
  configure();
  try {
    return await fal.storage.upload(file as File);
  } catch (err) {
    throw mapFalError(err);
  }
}

/**
 * Authenticated health-check for the saved key. Uploads a tiny blob — exactly
 * the same path that 401s with a bad key — so the user can tell a rejected key
 * apart from other failures. Throws AuthError when fal rejects the key,
 * MissingKeyError when none is saved.
 */
export async function verifyKey(): Promise<void> {
  configure();
  try {
    const probe = new Blob(["droneshot-key-check"], { type: "text/plain" });
    await fal.storage.upload(probe as unknown as File);
  } catch (err) {
    throw mapFalError(err);
  }
}

/* ── Step 1 (optional): auto-draw the drone path with Nano Banana 2 ── */
type ImageOutput = { images?: Array<{ url?: string }>; description?: string };

export async function autoDrawPath(
  baseImageUrl: string,
  resolution: "1K" | "2K" = "2K"
): Promise<string> {
  configure();
  const result = await fal
    .subscribe(NANO_PATH, {
      input: {
        prompt: AUTO_PATH_PROMPT,
        image_urls: [baseImageUrl],
        aspect_ratio: "auto",
        resolution,
        num_images: 1,
        output_format: "png",
      },
      logs: false,
    })
    .catch((err) => {
      throw mapFalError(err);
    });
  const data = result.data as ImageOutput;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("Path generation returned no image.");
  return url;
}

/* ── Step 2: read the path overlay with OpenRouter Vision ──────────── */
type TextOutput = { output?: string; error?: unknown };

export async function analyzePath(annotatedUrl: string): Promise<string> {
  configure();
  const result = await fal
    .subscribe(VISION, {
      input: {
        model: VISION_MODEL,
        system_prompt: VISION_SYSTEM,
        prompt: VISION_PROMPT,
        image_urls: [annotatedUrl],
        temperature: 0.4,
      },
      logs: false,
    })
    .catch((err) => {
      throw mapFalError(err);
    });
  const data = result.data as TextOutput;
  if (!data.output) throw new Error("Vision returned no analysis.");
  return data.output.trim();
}

/* ── Step 3: write the video prompt with OpenRouter LLM ────────────── */
export async function writeVideoPrompt(
  analysis: string,
  intent: string,
  totalSeconds: number
): Promise<string> {
  configure();
  const result = await fal
    .subscribe(LLM, {
      input: {
        model: LLM_MODEL,
        system_prompt: PROMPT_WRITER_SYSTEM,
        prompt: buildPromptWriterInput(analysis, intent, totalSeconds),
        temperature: 0.7,
      },
      logs: false,
    })
    .catch((err) => {
      throw mapFalError(err);
    });
  const data = result.data as TextOutput;
  if (!data.output) throw new Error("Prompt writer returned nothing.");
  return data.output.trim().replace(/^["'\s]+|["'\s]+$/g, "");
}

/* ── Step 4: animate the clean frame with the chosen model ─────────── */
type VideoOutput = {
  video?: { url?: string } | string;
  url?: string;
};

function extractVideoUrl(data: VideoOutput): string | undefined {
  if (typeof data.video === "string") return data.video;
  if (data.video?.url) return data.video.url;
  return data.url;
}

export async function animate(params: {
  modelId: ModelId;
  settings: VideoSettings;
  imageUrl: string;
  prompt: string;
}): Promise<string> {
  configure();
  const def = MODELS[params.modelId];
  // Typed as `string` so the client's (sometimes stale) literal input types
  // don't fight the live API shape. `endpointFor` lets a model switch endpoint
  // by setting (e.g. Kling 1080p → Pro, 4K → 4K endpoint).
  const endpoint: string = def.endpointFor
    ? def.endpointFor(params.settings)
    : def.endpoint;
  const input = def.build(params.settings, params.imageUrl, params.prompt);
  const result = await fal
    .subscribe(endpoint, {
      input: input as Record<string, unknown>,
      logs: false,
    })
    .catch((err) => {
      throw mapFalError(err);
    });
  const url = extractVideoUrl(result.data as VideoOutput);
  if (!url) throw new Error("Model returned no video.");
  return url;
}
