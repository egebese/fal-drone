# Drone Shot

Turn any photo into a cinematic **FPV drone-shot video** — every step powered
entirely by [fal.ai](https://fal.ai), with your own API key (BYOK).

Upload a still, press send, and the app sketches a camera flight path, reads it,
writes the motion, and animates your photo into a continuous aerial shot.

## Pipeline

| Step | Model (fal) | What it does |
| --- | --- | --- |
| 1. Path | `fal-ai/nano-banana-2/edit` | Sketches a red drone flight path with numbered waypoints on a copy of your image. |
| 2. Vision | `openrouter/router/vision` | Reads that path and describes the camera trajectory + scene. |
| 3. Prompt | `openrouter/router` | Turns the analysis into a timed camera-motion prompt. |
| 4. Animate | `bytedance/seedance-2.0/image-to-video` | Animates the **clean** frame into the drone shot. |

The annotated (red-line) frame is used **only** to guide the Vision/LLM motion
analysis — Seedance itself receives the clean uploaded frame, so no guide marks
ever bleed into the video. Each run is saved to local history and opens on a
dedicated result page (original frame, camera path, the video and every prompt).

If the path/Vision step fails, the run falls back to a generic motion prompt and
still produces a valid drone shot.

## BYOK — bring your own key

There is **no server-side key** and no `/api` route. Your fal key is stored in
`localStorage` and attached per-request straight from the browser to `fal.run`
via [`@fal-ai/client`](https://www.npmjs.com/package/@fal-ai/client). Add it via
the **Sign in** button → [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys).

Because calls go directly from the browser, the
`The fal credentials are exposed in the browser's environment` console warning is
expected for this BYOK design.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, add your fal key, and upload an image.

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## Stack

- Next.js 15 (App Router) · React 19 · Tailwind CSS 4
- `@fal-ai/client` for storage + queue (client-side only)
- HTML canvas for the flight-path rendering (Catmull-Rom smoothed strokes)
- `lucide-react` icons · liquid-glass UI
