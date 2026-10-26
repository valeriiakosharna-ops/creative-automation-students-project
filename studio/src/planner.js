import { BRAND_POLICY } from "./brand.js";
export const FORMATS = BRAND_POLICY.formats;
export const LANGUAGES = { en: "English", uk: "Ukrainian" };
export const quantityFor = (brief, format) =>
  brief.quantities?.[format] ?? brief.variants;
export function validateBrief(b, logos) {
  const errors = [];
  if (!b.title?.trim()) errors.push("Enter an event title.");
  if (!b.description?.trim()) errors.push("Describe your event.");
  const mode = b.dateMode || "single";
  const validDate = (date) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date || "") &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (!["single", "range", "list", "text"].includes(mode))
    errors.push("Choose a supported schedule type.");
  else if (["list", "text"].includes(mode)) {
    if (!b.dateText?.trim() || b.dateText.length > 200)
      errors.push("Enter a schedule of up to 200 characters.");
  } else {
    if (!validDate(b.date)) errors.push("Choose an event date.");
    if (mode === "range" && (!validDate(b.endDate) || b.endDate < b.date))
      errors.push("Choose an end date on or after the start date.");
  }
  if (!b.timeZone) errors.push("Choose a time zone.");
  if (!b.formats?.length || b.formats.some((f) => !FORMATS[f]))
    errors.push("Select at least one supported format.");
  if (
    !b.languages?.length ||
    b.languages.some((l) => !BRAND_POLICY.languages.includes(l))
  )
    errors.push("Choose English, Ukrainian, or both.");
  if (
    b.formats?.some(
      (format) =>
        !Number.isInteger(quantityFor(b, format)) ||
        quantityFor(b, format) < 1 ||
        quantityFor(b, format) > 10,
    )
  )
    errors.push("Choose 1–10 visuals for each selected format and language.");
  if (
    b.formats?.reduce((sum, format) => sum + (quantityFor(b, format) || 0), 0) *
      b.languages?.length >
    24
  )
    errors.push("A run can contain at most 24 visuals.");
  if (!logos.length)
    errors.push("Upload at least one logo. All logos appear on every visual.");
  if (b.colors?.length !== 3 || b.colors.some((c) => !/^#[\da-f]{6}$/i.test(c)))
    errors.push("Use three valid #RRGGBB brand colors.");
  if (b.url) {
    try {
      if (!["https:", "http:"].includes(new URL(b.url).protocol)) throw Error();
    } catch {
      errors.push("Use a complete http:// or https:// event link.");
    }
  }
  return errors;
}
// Share a photo cursor across all formats, variants and languages of one network.
export function planOutputs(b, photos, logos) {
  const counters = {},
    outputs = [];
  for (const format of b.formats) {
    const spec = FORMATS[format];
    if (!spec) throw Error("Unsupported format");
    if (
      !Number.isInteger(quantityFor(b, format)) ||
      quantityFor(b, format) < 1 ||
      quantityFor(b, format) > 10
    )
      continue;
    for (const language of b.languages)
      for (let variant = 1; variant <= quantityFor(b, format); variant++) {
        const index = counters[spec.network] || 0;
        counters[spec.network] = index + 1;
        outputs.push({
          id: `${format}-${language}-${variant}`,
          postId: `${format}-${language}`,
          position: variant,
          sequenceLength: quantityFor(b, format),
          format,
          network: spec.network,
          language,
          variant,
          width: spec.width,
          height: spec.height,
          photoId: photos[index]?.id || null,
          logoIds: logos.map((l) => l.id),
          status: "pending",
        });
      }
  }
  return outputs;
}
export function slug(v) {
  return (
    v
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
      .toLowerCase() || "campaign"
  );
}
