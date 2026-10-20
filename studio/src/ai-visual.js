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
  { previousImage, feedback = "" } = {},
) {
  const logos = output.logoIds.map((id) =>
    assets.logos.find((asset) => asset.id === id),
  );
  if (!logos.length || logos.some((logo) => !logo?.blob))
    throw Error("Every visual requires its original uploaded logos.");
  const photo = output.photoId
    ? assets.photos.find((asset) => asset.id === output.photoId)
    : null;
  if (output.photoId && !photo?.blob)
    throw Error("The assigned original photo is missing.");
  const references = [],
    body = new FormData();
  function append(blob, role) {
    const index = references.length + 1,
      extension =
        blob.type === "image/jpeg"
          ? "jpg"
          : blob.type === "image/webp"
            ? "webp"
            : "png";
    body.append("image[]", blob, `reference-${index}.${extension}`);
    references.push({ index, role });
  }
  if (previousImage)
    append(
      previousImage,
      "PREVIOUS_VISUAL: revise this image according to revisionInstructions, preserving everything else that remains correct",
    );
  if (photo)
    append(
      photo.blob,
      "ASSIGNED_EVENT_PHOTO: the only event photograph permitted in this frame",
    );
  for (const logo of logos)
    append(
      logo.blob,
      "ORIGINAL_LOGO: include this logo once, organically integrated into the design",
    );
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
      cta: output.cta,
      visualPlan: storyboardPost?.campaignStyle ? output.visualPlan : { role: output.visualPlan?.role },
    },
    storyboard: storyboardPost?.campaignStyle ? storyboardPost : { visuals: (storyboardPost?.visuals || []).map(({ id, headline, subheading, cta }) => ({ id, headline, subheading, cta })) },
    visualStyle: CHANNEL_STYLES[output.format],
    effectiveColors: brief.colors,
    targetCanvas: { width: output.width, height: output.height },
    references,
    revisionInstructions: feedback.trim(),
  };
  const prompt = `${visualPrompt}\n${previousImage ? "This is a revision. Apply revisionInstructions to the PREVIOUS_VISUAL, preserving campaign identity, assigned-photo identity and all event facts. Do not change the whole composition unless requested.\n" : ""}DATA:\n${JSON.stringify(context)}`;
  if (prompt.length > 32000)
    throw Error(
      "The visual prompt is too long. Shorten the event direction or revision instructions.",
    );
  body.set("prompt", prompt);
  body.set("model", MODELS.image);
  body.set("n", "1");
  body.set("quality", MODELS.imageQuality);
  body.set("output_format", "png");
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
