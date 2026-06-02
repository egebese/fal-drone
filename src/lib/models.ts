/**
 * Video-model registry.
 *
 * Every drone shot is an image-to-video call, but each model has its own
 * input shape and its own set of meaningful settings. A single `VideoSettings`
 * object holds every possible control; each model declares which controls it
 * exposes (`controls`), its option lists, its defaults, and a `build()` that
 * maps the settings to that model's exact API input.
 *
 * Negative prompt is applied uniformly here: models with a native
 * `negative_prompt` input receive it as a field; models without one get it
 * appended to the positive prompt. This keeps the standard negative in effect
 * in both Auto and Custom modes, for every model.
 */

import { NEGATIVE_PROMPT_DEFAULT } from "./prompt";

export type ModelId =
  | "ltx-fast"
  | "ltx-pro"
  | "veo3.1"
  | "seedance2"
  | "kling-v3-pro";

export type ControlKind =
  | "duration"
  | "resolution"
  | "aspectRatio"
  | "audio"
  | "negative"
  | "cfgScale"
  | "shotType";

export type VideoSettings = {
  duration: string;
  resolution: string;
  aspectRatio: string;
  generateAudio: boolean;
  negativePrompt: string;
  cfgScale: number;
  shotType: string;
};

export type ModelDef = {
  id: ModelId;
  label: string;
  sub: string;
  endpoint: string;
  /** Resolve the endpoint from settings (e.g. Kling switches to a 4K endpoint). */
  endpointFor?: (s: VideoSettings) => string;
  controls: ControlKind[];
  durations?: string[];
  resolutions?: string[];
  aspectRatios?: string[];
  shotTypes?: string[];
  /** Native negative-prompt input. When false, the negative is appended to the prompt. */
  supportsNegative: boolean;
  defaults: VideoSettings;
  /** Disable a setting option that would be invalid given the rest of the settings. */
  isOptionDisabled?: (
    kind: ControlKind,
    value: string,
    s: VideoSettings
  ) => boolean;
  build: (
    s: VideoSettings,
    imageUrl: string,
    prompt: string
  ) => Record<string, unknown>;
};

const baseDefaults: VideoSettings = {
  duration: "6",
  resolution: "1080p",
  aspectRatio: "auto",
  generateAudio: true,
  negativePrompt: NEGATIVE_PROMPT_DEFAULT,
  cfgScale: 0.5,
  shotType: "customize",
};

/** Append the negative as plain guidance for models lacking a negative input. */
function withNegative(prompt: string, negative: string): string {
  const n = negative.trim();
  return n ? `${prompt}\n\nAvoid: ${n}` : prompt;
}

function ltx(
  id: "ltx-fast" | "ltx-pro",
  endpoint: string,
  label: string
): ModelDef {
  return {
    id,
    label,
    sub: endpoint.replace("fal-ai/", ""),
    endpoint,
    controls: ["duration", "resolution", "aspectRatio", "audio", "negative"],
    durations: ["6", "8", "10", "12", "14", "16", "18", "20"],
    resolutions: ["1080p", "1440p", "2160p"],
    aspectRatios: ["auto", "16:9", "9:16"],
    supportsNegative: false,
    defaults: { ...baseDefaults, duration: "6", resolution: "1080p" },
    // LTX: durations over 10s are only supported at 1080p.
    isOptionDisabled: (kind, value, s) => {
      if (kind !== "duration" && kind !== "resolution") return false;
      const dur = kind === "duration" ? Number(value) : Number(s.duration);
      const res = kind === "resolution" ? value : s.resolution;
      return dur > 10 && res !== "1080p";
    },
    build: (s, imageUrl, prompt) => {
      // Safety clamp mirroring the UI constraint above.
      const resolution =
        Number(s.duration) > 10 && s.resolution !== "1080p"
          ? "1080p"
          : s.resolution;
      return {
        image_url: imageUrl,
        prompt: withNegative(prompt, s.negativePrompt),
        duration: Number(s.duration),
        resolution,
        aspect_ratio: s.aspectRatio,
        generate_audio: s.generateAudio,
      };
    },
  };
}

const KLING_PRO = "fal-ai/kling-video/v3/pro/image-to-video";
const KLING_4K = "fal-ai/kling-video/v3/4k/image-to-video";

export const MODELS: Record<ModelId, ModelDef> = {
  "ltx-fast": ltx(
    "ltx-fast",
    "fal-ai/ltx-2.3/image-to-video/fast",
    "LTX 2.3 Fast"
  ),
  "ltx-pro": ltx("ltx-pro", "fal-ai/ltx-2.3/image-to-video", "LTX 2.3 Pro"),

  "veo3.1": {
    id: "veo3.1",
    label: "Veo 3.1",
    sub: "fal-ai/veo3.1",
    endpoint: "fal-ai/veo3.1/image-to-video",
    controls: ["duration", "resolution", "aspectRatio", "audio", "negative"],
    durations: ["4s", "6s", "8s"],
    resolutions: ["720p", "1080p", "4k"],
    aspectRatios: ["auto", "16:9", "9:16"],
    supportsNegative: true,
    defaults: { ...baseDefaults, duration: "8s", resolution: "720p" },
    build: (s, imageUrl, prompt) => ({
      image_url: imageUrl,
      prompt,
      duration: s.duration,
      resolution: s.resolution,
      aspect_ratio: s.aspectRatio,
      generate_audio: s.generateAudio,
      ...(s.negativePrompt.trim()
        ? { negative_prompt: s.negativePrompt.trim() }
        : {}),
    }),
  },

  seedance2: {
    id: "seedance2",
    label: "Seedance 2.0",
    sub: "bytedance/seedance-2.0",
    endpoint: "bytedance/seedance-2.0/image-to-video",
    controls: ["duration", "resolution", "aspectRatio", "audio", "negative"],
    durations: ["auto", "4", "5", "6", "7", "8", "9", "10", "12", "15"],
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    supportsNegative: false,
    // Audio defaults OFF: a silent FPV drone shot doesn't need it, and
    // generated audio can trip fal's content policy (422 on output audio).
    defaults: {
      ...baseDefaults,
      duration: "auto",
      resolution: "1080p",
      generateAudio: false,
    },
    build: (s, imageUrl, prompt) => ({
      image_url: imageUrl,
      prompt: withNegative(prompt, s.negativePrompt),
      duration: s.duration,
      resolution: s.resolution,
      aspect_ratio: s.aspectRatio,
      generate_audio: s.generateAudio,
    }),
  },

  "kling-v3-pro": {
    id: "kling-v3-pro",
    label: "Kling v3 Pro",
    sub: "fal-ai/kling-video/v3",
    endpoint: KLING_PRO,
    // Pro renders 1080p; the 4K endpoint shares the exact same input shape.
    endpointFor: (s) => (s.resolution === "4k" ? KLING_4K : KLING_PRO),
    controls: ["duration", "resolution", "audio", "negative", "cfgScale", "shotType"],
    durations: ["3", "4", "5", "6", "7", "8", "9", "10", "12", "15"],
    resolutions: ["1080p", "4k"],
    shotTypes: ["customize", "intelligent"],
    supportsNegative: true,
    defaults: {
      ...baseDefaults,
      duration: "5",
      resolution: "1080p",
      cfgScale: 0.5,
      shotType: "customize",
    },
    build: (s, imageUrl, prompt) => ({
      start_image_url: imageUrl,
      prompt,
      duration: s.duration,
      generate_audio: s.generateAudio,
      cfg_scale: s.cfgScale,
      shot_type: s.shotType,
      ...(s.negativePrompt.trim()
        ? { negative_prompt: s.negativePrompt.trim() }
        : {}),
    }),
  },
};

/**
 * Currently exposed models. The other definitions stay in MODELS so they can
 * be re-enabled by adding their id back to this list — no registry rewrite
 * needed.
 */
export const MODEL_LIST: ModelDef[] = [MODELS["seedance2"]];

export const DEFAULT_MODEL: ModelId = "seedance2";

/** Pretty label for a duration option (e.g. "6" → "6s", "8s" → "8s", "auto" → "Auto"). */
export function durationLabel(v: string): string {
  if (v === "auto") return "Auto";
  return /s$/.test(v) ? v : `${v}s`;
}

/**
 * Numeric duration (seconds) for the LLM's pacing logic. Strips a trailing "s"
 * (Veo style), and for Seedance's "auto" picks a sensible 5s default — the
 * model itself still decides internally, but the prompt's time-stamped phases
 * need a concrete number to plan against.
 */
export function durationSeconds(s: VideoSettings): number {
  if (s.duration === "auto") return 5;
  const n = parseFloat(s.duration.replace(/s$/i, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 6;
}
