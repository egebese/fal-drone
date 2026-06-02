/**
 * Prompts for the drone-shot pipeline.
 *
 * The red line a user draws (or that Nano Banana 2 generates) is a *camera
 * path*: it tells the pipeline how a drone should fly through the still
 * image. Vision reads that path, the LLM turns it into motion language, and
 * LTX 2.3 animates the clean frame along it.
 */

/**
 * Auto-mode Seedance prompt is composed from three parts: a fixed cinematic
 * preamble, the dynamic per-path motion written by the LLM (or a fallback),
 * and a fixed style/quality tail. Seedance receives the CLEAN frame (the drawn
 * path is used only to guide the Vision/LLM motion analysis), so the preamble
 * just sets up a first-person aerial take that follows the described motion.
 */

/** Opening framing — first-person camera, no visible aircraft, follow the motion. */
export const VIDEO_PROMPT_PREAMBLE =
  "Create one continuous, ultra-realistic first-person FPV aerial drone shot from " +
  "this still image. The CAMERA itself is the aircraft — film entirely from a " +
  "first-person aerial point of view, as if mounted on the nose of the drone. " +
  "Never show a drone, quadcopter, helicopter, airplane, propellers, rotors, or " +
  "any flying vehicle in the frame, and never show its shadow on the ground. " +
  "There is no aircraft visible anywhere — only the scene seen from the moving " +
  "camera.\n\n" +
  "Move the camera smoothly through the scene along the trajectory described " +
  "below, in one continuous cinematic take:";

/** Closing style/quality guidance appended after the dynamic motion. */
export const VIDEO_PROMPT_STYLE =
  "Ultra-realistic FPV movement, cinematic speed ramps, realistic inertia, " +
  "strong motion continuity, grounded aerial realism, no cuts, no duplicated " +
  "buildings, no distortion, no text, no watermark.";

/**
 * Generic, path-agnostic motion used when the Nano/Vision/LLM path step is
 * unavailable, so the run still produces a valid drone shot.
 */
export const MOTION_FALLBACK =
  "Glide smoothly forward from the foreground, sweeping through the most " +
  "cinematic part of the scene toward a focal point in the distance, with " +
  "gentle banking, speed ramps and subtle altitude changes that reveal depth.";

/**
 * Stitch the fixed scaffold around the dynamic motion. The user's optional
 * intent is appended once here (not passed to the LLM) to avoid duplication.
 */
export function composeVideoPrompt(motion: string, intent?: string): string {
  const extra = intent?.trim()
    ? `\n\nAdditional direction: ${intent.trim()}`
    : "";
  return `${VIDEO_PROMPT_PREAMBLE}\n\n${motion.trim()}\n\n${VIDEO_PROMPT_STYLE}${extra}`;
}

/** Nano Banana 2 — auto-draw a drone flight path over the uploaded image. */
export const AUTO_PATH_PROMPT =
  "Overlay a single smooth, THIN, semi-transparent red drone flight-path line on " +
  "this aerial photo — a delicate, fine guide line like a subtle planning diagram, " +
  "NOT a thick or bold stroke. The line should start in the foreground and sweep " +
  "naturally through the most cinematic part of the scene toward a focal point in " +
  "the distance, curving gently rather than running straight. Place EXACTLY 4 small, " +
  "unobtrusive red circular waypoint markers along the line, evenly spaced, each " +
  "containing the white numeral 1, 2, 3 or 4 in order from start to end (marker 1 at " +
  "the beginning, marker 4 at the end). Keep the markers and line small and faint so " +
  "they barely obscure the photo. Keep the underlying photograph completely unchanged " +
  "— only add the faint red path and the four small numbered markers.";

/** OpenRouter Vision — system instruction for reading the path overlay. */
export const VISION_SYSTEM =
  "You are an aerial-cinematography analyst. You are shown a photo with a hand-drawn " +
  "line and 4 numbered waypoint markers (1, 2, 3, 4 in order from start to end) " +
  "overlaid on it. That line is the flight path of the drone CAMERA itself moving " +
  "through the scene — the camera is the drone (first-person aerial view); the drone " +
  "aircraft is never in the shot. " +
  "Report, in 4-6 tight sentences: (1) what the scene is; (2) the trajectory the line " +
  "traces, broken down waypoint-by-waypoint — what is at waypoint 1, then how the line " +
  "moves to waypoint 2 (direction, curve, altitude change), then to waypoint 3, then to " +
  "waypoint 4, naming the look-target at each (foreground subject, midground feature, " +
  "focal point, distant background); (3) implied speed changes. " +
  "Translate the line and the numbered waypoints into camera movement — never describe " +
  "the drawn line or numbers as part of the scene itself.";

export const VISION_PROMPT =
  "Read the drone flight-path overlay (with its 4 numbered waypoints) and describe the " +
  "scene and the exact camera trajectory from waypoint 1 to 4.";

/**
 * Default "negative" guidance. LTX 2.3 has no negative-prompt input, so these
 * avoidances are folded into the positive prompt by the LLM instead. They keep
 * the motion physically plausible and free of the drawn guide lines.
 */
export const NEGATIVE_PROMPT_DEFAULT =
  "low quality, blurry, low resolution, pixelated; the drone, quadcopter or any " +
  "aircraft visible in frame; drone propellers; drone shadow on the ground; visible red " +
  "flight-path line, guide lines, drawn path overlays, arrows or waypoint markers; " +
  "warping, morphing or melting buildings; bending or distorted architecture; jittery, " +
  "shaky or unstable camera; abrupt jump cuts or teleporting motion; objects sliding or " +
  "floating unnaturally; broken perspective; smeared motion blur; frame flicker or " +
  "strobing; duplicated or ghosted objects; deformed faces or limbs; extra people or " +
  "vehicles appearing; watermark, text, captions or logos; cartoonish or physically " +
  "impossible movement.";

/** OpenRouter LLM — system instruction for writing the LTX video prompt. */
export const PROMPT_WRITER_SYSTEM =
  "You write prompts for image-to-video models, specialized in drone and aerial " +
  "cinematography. Given a scene analysis, a drone camera path with 4 numbered " +
  "waypoints (1→2→3→4) and the total video duration in seconds, output ONE vivid " +
  "cinematic prompt (max 120 words). " +
  "CRITICAL: the camera ITSELF is the drone — a smooth first-person aerial point of " +
  "view that flies along the path; the drone or aircraft NEVER appears in the shot " +
  "(no drone body, propellers, or shadow). " +
  "PACING: the camera MUST traverse the ENTIRE path within the total duration, reaching " +
  "each numbered waypoint by its time slice. Split the run into 4 equal phases and " +
  "write EXPLICIT time-stamped instructions for each — e.g. for an 8-second shot: " +
  "\"0–2s: glide forward and reach waypoint 1; 2–4s: bank right toward waypoint 2; " +
  "4–6s: descend to waypoint 3; 6–8s: pull back and settle at waypoint 4.\" Use " +
  "concrete camera verbs (push in, glide, bank, orbit, ascend, descend, reveal, pull " +
  "back) and add brief easing/speed notes. Preserve every real subject with natural " +
  "parallax, consistent lighting and stable, non-warping geometry; do not invent new " +
  "objects, text, people, or scene changes. Output ONLY the prompt text — no preamble, " +
  "no quotes, no markdown.";

export function buildPromptWriterInput(
  analysis: string,
  intent: string,
  totalSeconds: number
): string {
  const per = totalSeconds / 4;
  const phases = [1, 2, 3, 4]
    .map((i) => `${formatSec((i - 1) * per)}–${formatSec(i * per)}s → waypoint ${i}`)
    .join("; ");
  const extra = intent.trim()
    ? `\n\nAdditional creative direction from the user: ${intent.trim()}`
    : "";
  return (
    `Scene & camera-path analysis (with 4 numbered waypoints 1→2→3→4):\n` +
    `${analysis.trim()}\n\n` +
    `Total video duration: ${totalSeconds}s.\n` +
    `Pace as 4 phases (~${trimZero(per)}s each): ${phases}.\n` +
    `The camera must visibly reach every waypoint by its slice — do not stall in the ` +
    `first quarter of the path.${extra}\n\n` +
    `Write the drone-shot video prompt now with explicit time-stamped phases.`
  );
}

function formatSec(n: number): string {
  return trimZero(Math.round(n * 10) / 10);
}
function trimZero(n: number): string {
  return String(n).replace(/\.0$/, "");
}
