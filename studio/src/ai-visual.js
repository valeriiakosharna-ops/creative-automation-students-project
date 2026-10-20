import { BRAND_POLICY } from "./brand.js";
import { openaiRequest } from "./openai.js";
import visualPrompt, { version } from "./prompts/visual.js";
import { MODELS, CHANNEL_STYLES } from "./prompts/channel-styles.js";
export const VISUAL_PROMPT_VERSION = version;
export function artworkGeometry(output, logoCount) {
  const spec = BRAND_POLICY.formats[output.format],
    safe = spec.safeArea;
  const cols = Math.min(BRAND_POLICY.logos.maxColumns, logoCount),
    rows = Math.ceil(logoCount / cols);
  const shelfHeight = rows * spec.logoRowHeight + 32;
  return {
    safeArea: { ...safe },
    artworkRegion: {
      x: safe.left,
      y: safe.top,
      width: output.width - safe.left - safe.right,
      height:
        output.height -
        safe.top -
        safe.bottom -
        shelfHeight -
        (output.format === "instagram_story" ? 30 : 22),
    },
    logoShelf: {
      x: safe.left,
      y: output.height - safe.bottom - shelfHeight,
      width: output.width - safe.left - safe.right,
      height: shelfHeight,
    },
    cols,
    rows,
  };
}
function contain(context, bitmap, rect) {
  const scale = Math.min(
      rect.width / bitmap.width,
      rect.height / bitmap.height,
    ),
    width = bitmap.width * scale,
    height = bitmap.height * scale;
  const result = {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
  context.drawImage(bitmap, result.x, result.y, width, height);
  return result;
}
export async function finalizeAIVisual(blob, output, logos) {
  if (!logos.length || logos.length > 8)
    throw Error("Every visual requires 1–8 original logos.");
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d"),
    bitmaps = [];
  if (!context) throw Error("Canvas rendering is not available.");
  try {
    const image = await createImageBitmap(blob);
    bitmaps.push(image);
    if (image.width * image.height > 24e6)
      throw Error("OpenAI returned an oversized image.");
    const geometry = artworkGeometry(output, logos.length);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    const generatedRect = contain(context, image, geometry.artworkRegion);
    const shelf = geometry.logoShelf,
      cellWidth = (shelf.width - 24) / geometry.cols,
      cellHeight = (shelf.height - 24) / geometry.rows;
    const logoRects = [];
    for (let index = 0; index < logos.length; index++) {
      const logo = await createImageBitmap(logos[index].blob);
      try {
        const padY =
            (cellHeight * BRAND_POLICY.logos.clearSpaceFraction) /
            (1 + 2 * BRAND_POLICY.logos.clearSpaceFraction),
          padX = Math.max(12, padY);
        const rect = contain(context, logo, {
          x: shelf.x + 12 + (index % geometry.cols) * cellWidth + padX,
          y:
            shelf.y +
            12 +
            Math.floor(index / geometry.cols) * cellHeight +
            padY,
          width: cellWidth - 2 * padX,
          height: cellHeight - 2 * padY,
        });
        logoRects.push({ id: logos[index].id, ...rect });
      } finally {
        logo.close();
      }
    }
    const result = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (png) =>
          png ? resolve(png) : reject(Error("Could not encode the PNG.")),
        "image/png",
      ),
    );
    return {
      blob: result,
      style: {
        version: BRAND_POLICY.version,
        source: "openai",
        safeArea: geometry.safeArea,
        contentRect: {
          x: geometry.artworkRegion.x,
          y: geometry.artworkRegion.y,
          width: shelf.width,
          height:
            output.height - geometry.safeArea.top - geometry.safeArea.bottom,
        },
        generatedRect,
        logoShelf: shelf,
        logoRects,
      },
    };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
    canvas.width = 1;
    canvas.height = 1;
  }
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
      "ORIGINAL_LOGO: brand reference only, composited unchanged after image generation",
    );
  const context = {
    event: brief,
    frame: {
      id: output.id,
      format: output.format,
      language: output.language,
      position: output.variant,
      headline: output.headline,
      subheading: output.subheading,
      cta: output.cta,
      visualPlan: output.visualPlan,
    },
    storyboard: storyboardPost,
    visualStyle: CHANNEL_STYLES[output.format],
    brandPolicy: BRAND_POLICY,
    effectiveColors: brief.colors,
    targetCanvas: { width: output.width, height: output.height },
    ...artworkGeometry(output, logos.length),
    references,
    revisionInstructions: feedback.trim(),
  };
  const prompt = `${visualPrompt}\n${previousImage ? "This is a revision. Apply revisionInstructions to the PREVIOUS_VISUAL, preserving campaign identity, assigned-photo identity and all event facts. Do not change the whole composition unless requested. The original logo shelf will be reapplied after generation.\n" : ""}DATA:\n${JSON.stringify(context)}`;
  if (prompt.length > 32000)
    throw Error(
      "The visual prompt is too long. Shorten the event direction or revision instructions.",
    );
  body.set("prompt", prompt);
  body.set("model", MODELS.image);
  body.set("n", "1");
  body.set("quality", MODELS.imageQuality);
  body.set("input_fidelity", "high");
  body.set("output_format", "png");
  body.set(
    "size",
    output.format === "instagram_story"
      ? "1024x1536"
      : output.format === "instagram_post"
        ? "1024x1024"
        : "1536x1024",
  );
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
      logos,
    )),
    imageModel: MODELS.image,
    imageSource: "openai",
    visualPromptVersion: version,
  };
}
