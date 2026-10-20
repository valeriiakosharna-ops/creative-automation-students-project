import { BRAND_POLICY } from "./brand.js";
export function copyLimits(format) {
  const rule = BRAND_POLICY.formats[format];
  return {
    headline: 80,
    subheading: rule.subheading.maxCharacters,
    cta: 40,
  };
}
export function copyError(copy, specification) {
  const limits = copyLimits(specification.format);
  const label = `${BRAND_POLICY.formats[specification.format].label} · ${specification.language === "uk" ? "Українська" : "English"}`;
  for (const [field, maximum] of Object.entries(limits)) {
    if (typeof copy[field] !== "string")
      return `${label}: ${field} must be text.`;
    if (["headline", "caption"].includes(field) && !copy[field].trim())
      return `${label}: ${field} is required.`;
    if (copy[field].length > maximum)
      return `${label}: ${field} has ${copy[field].length} characters; limit ${maximum}. Edit this output to render it without another AI request.`;
  }
  if (typeof copy.caption !== "string" || !copy.caption.trim())
    return `${label}: caption is required.`;
  return "";
}
