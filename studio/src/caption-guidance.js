import { BRAND_POLICY } from "./brand.js";

// Writing targets are advice, not validation limits. Exporting text does not publish it.
export function captionGuidance(format, research) {
  const rule = BRAND_POLICY.formats[format].caption;
  const fresh = research?.status === "available"
    ? research.channels.find((channel) => channel.format === format)
    : null;
  return {
    recommendedMin: fresh?.recommendedMin ?? rule.targetMin,
    recommendedMax: fresh?.recommendedMax ?? rule.targetMax,
    direction: rule.direction,
    // Instagram feed publishing reference; Stories have no equivalent caption field.
    publishingReferenceMax: format === "instagram_post" ? 2200 : null,
    research: fresh ? { summary: fresh.summary, sourceUrls: fresh.sourceUrls } : null,
  };
}

export const characterCount = (text) => Array.from(text || "").length;
