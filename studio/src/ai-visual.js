import { hasReferencePlan } from "./frame-planner.js";
import { visualReferences } from "./visual-references.js";
import { openaiRequest } from "./openai.js";
import visualPrompt, { version } from "./prompts/visual.js";
import { MODELS, CHANNEL_STYLES } from "./prompts/channel-styles.js";
export const VISUAL_PROMPT_VERSION = version;
// Native supported sizes preserve the exact destination aspect ratios.
export const imageSize = (format) => ({
  instagram_post: "1024x1024",
  instagram_story: "1152x2048",
  facebook: "1280x672",
  google_chat: "1280x720",
})[format];
export async function finalizeAIVisual(blob, output) {
  const bitmap = await createImageBitmap(blob);
  try {
    if (bitmap.width * bitmap.height > 24e6) throw Error("OpenAI returned an oversized image.");
    const style = { source: "openai", composition: "model-designed", processing: "full-canvas-resize-only", generatedWidth: bitmap.width, generatedHeight: bitmap.height };
    if (bitmap.width === output.width && bitmap.height === output.height) return { blob, style };
    const canvas = document.createElement("canvas");
    canvas.width = output.width; canvas.height = output.height;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw Error("Canvas rendering is not available.");
      // No margins, crop, logo shelf, extra logos or font/layout processing.
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const png = await new Promise((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(Error("Could not encode the PNG.")), "image/png"));
      return { blob: png, style };
    } finally { canvas.width = 1; canvas.height = 1; }
  } finally { bitmap.close(); }
}
export async function generateAIVisual(
  brief,
  output,
  storyboardPost,
  assets,
  apiKey,
  signal,
  { feedback = "" } = {},
) {
  const { photo, items, references } = visualReferences(output, assets);
  if (!hasReferencePlan(output)) throw Error("Plan this visual with its original references before generating it.");
  const body = new FormData();
  for (const [index, { asset }] of items.entries()) {
    const extension = asset.blob.type === "image/jpeg" ? "jpg" : asset.blob.type === "image/webp" ? "webp" : "png";
    body.append("image[]", asset.blob, `reference-${index + 1}.${extension}`);
  }
  const context = {
    event: Object.fromEntries(["title", "description", "dateMode", "date", "endDate", "dateText", "time", "timeZone", "location", "url", "sourceLanguage", "titleEn", "titleUk", "descriptionEn", "descriptionUk"].map((key) => [key, brief[key]])),
    desiredStyle: brief.direction || "Contemporary, organic event storytelling",
    campaignStyle: storyboardPost?.campaignStyle,
    frame: {
      id: output.id,
      format: output.format,
      language: output.language,
      position: output.variant,
      headline: output.headline,
      subheading: output.subheading,
      cta: "",
      photoSummary: photo ? output.photoSummary : "",
      visualPlan: storyboardPost?.campaignStyle ? output.visualPlan : { role: output.visualPlan?.role },
    },
    storyboard: { campaignStyle: storyboardPost?.campaignStyle,
      visuals: (storyboardPost?.visuals || []).map(({ id, headline, subheading, visualPlan }) => ({ id, headline, subheading, narrativeRole: visualPlan?.role })) },
    backgroundPreference: "light: white, warm white or pale brand tints",
    peoplePolicy: photo ? "Only preserve people already present in the assigned original photo; never add or replace people" : "No people, faces, bodies, avatars, silhouettes, crowds or fictional event photography",
    photoAvailable: Boolean(photo),
    callToAction: false,
    visualStyle: CHANNEL_STYLES[output.format],
    effectiveColors: brief.colors,
    targetCanvas: { width: output.width, height: output.height },
    references,
    revisionInstructions: feedback.trim(),
  };
  const prompt = `${visualPrompt}\nDATA:\n${JSON.stringify(context)}`;
  if (prompt.length > 32000)
    throw Error(
      "The visual prompt is too long. Shorten the event direction or revision instructions.",
    );
  body.set("prompt", prompt);
  body.set("model", MODELS.image);
  body.set("n", "1");
  body.set("quality", MODELS.imageQuality);
  body.set("output_format", "png");
  body.set("background", "opaque");
  body.set("size", imageSize(output.format));
  const data = await openaiRequest(
    "images/edits",
    body,
    apiKey,
    signal,
    300000,
  );
  const encoded = data?.data?.[0]?.b64_json;
  if (
    data?.data?.length !== 1 ||
    typeof encoded !== "string" ||
    !encoded.length ||
    encoded.length > 40e6 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
  )
    throw Error(
      "OpenAI returned invalid image content. No template image was substituted.",
    );
  let bytes;
  try {
    bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  } catch {
    throw Error(
      "OpenAI returned invalid image content. No template image was substituted.",
    );
  }
  if (
    ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    throw Error(
      "OpenAI returned invalid image content. No template image was substituted.",
    );
  if (signal?.aborted)
    throw signal.reason || new DOMException("Aborted", "AbortError");
  return {
    ...(await finalizeAIVisual(
      new Blob([bytes], { type: "image/png" }),
      output,
    )),
    imageModel: MODELS.image,
    imageSource: "openai",
    visualPromptVersion: version,
  };
}
