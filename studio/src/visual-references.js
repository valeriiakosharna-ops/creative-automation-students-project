// Shared by per-frame vision planning and image generation, including revisions.
// Allocation belongs to planner.js; no AI response can change these bindings.
export function visualReferences(output, assets) {
  const logos = assets.logos || [];
  if (!logos.length || logos.length > 8 || new Set(logos.map((logo) => logo.id)).size !== logos.length ||
      logos.some((logo) => !logo.blob) || output.logoIds?.length !== logos.length ||
      new Set(output.logoIds).size !== logos.length || logos.some((logo) => !output.logoIds.includes(logo.id)))
    throw Error("Every visual requires all original uploaded logos.");
  const photo = output.photoId ? assets.photos.find((asset) => asset.id === output.photoId) : null;
  if (output.photoId && !photo?.blob) throw Error("The assigned original photo is missing.");
  const items = [];
  if (photo) items.push({ asset: photo, role: "ASSIGNED_EVENT_PHOTO: the sole source of event people and photography for this frame" });
  for (const logo of logos) items.push({ asset: logo, role: "ORIGINAL_LOGO: branding only; never use as a source for event people" });
  for (const { asset } of items)
    if (!["image/png", "image/jpeg", "image/webp"].includes(asset.blob.type))
      throw Error("Use PNG, JPEG or WebP original references.");
  return { photo, logos, items,
    references: items.map(({ role }, index) => ({ index: index + 1, role })) };
}
async function planningPreview(blob, isPhoto) {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    if (Math.max(bitmap.width, bitmap.height) <= 1024 && blob.size <= 1024 * 1024) return blob;
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    try {
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(Error("Could not prepare a planning reference.")),
        isPhoto ? "image/jpeg" : "image/png", 0.85));
    } finally { canvas.width = 1; canvas.height = 1; }
  } finally { bitmap.close(); }
}
export async function visionReferences(items, signal) {
  const images = [];
  // Bound vision request size and release decoded bitmaps one at a time.
  // Image generation still receives the full original files.
  for (const { asset, role } of items) {
    if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
    const blob = await planningPreview(asset.blob, role.startsWith("ASSIGNED_EVENT_PHOTO"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768)
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    images.push({ type: "image_url", image_url: { url: `data:${blob.type};base64,${btoa(binary)}`, detail: "auto" } });
  }
  return images;
}
