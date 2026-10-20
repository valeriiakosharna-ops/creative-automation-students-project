import { structuredRequest } from "./openai.js";
import { visualReferences, visionReferences } from "./visual-references.js";
import prompt, { version } from "./prompts/frame-planner.js";
export const FRAME_PLANNER_VERSION = version;
const text = { type: "string" };
const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "subheading", "cta", "photoSummary", "visualPlan"],
  properties: {
    headline: text, subheading: text, cta: { type: "string", enum: [""] }, photoSummary: text,
    visualPlan: { type: "object", additionalProperties: false, required: ["layout", "direction"],
      properties: { layout: text, direction: text } },
  },
};
export function hasReferencePlan(output) {
  return output.referencePlanVersion === version && output.plannedPhotoId === (output.photoId || null) &&
    output.plannedLogoIds?.length === output.logoIds?.length &&
    output.logoIds.every((id) => output.plannedLogoIds.includes(id));
}
export async function planVisualFrame(brief, output, storyboardPost, assets, key, signal) {
  const { photo, logos, items, references } = visualReferences(output, assets);
  const images = await visionReferences(items, signal);
  const data = await structuredRequest("visual_frame", prompt, {
    brief, campaignStyle: storyboardPost?.campaignStyle || brief.direction,
    frame: { id: output.id, format: output.format, language: output.language, position: output.variant,
      headline: output.headline, subheading: output.subheading, narrativeRole: output.visualPlan?.role },
    desiredStyle: brief.direction, effectiveColors: brief.colors, backgroundPreference: "light",
    references, photoAvailable: Boolean(photo), peoplePolicy: photo ? "preserve only the people already present in the assigned photo" : "no people",
  }, schema, key, signal, images);
  if (!data || !["headline", "subheading", "photoSummary"].every((field) => typeof data[field] === "string") ||
    !data.headline.trim() || typeof data.visualPlan?.layout !== "string" || !data.visualPlan.layout.trim() ||
    typeof data.visualPlan?.direction !== "string" || !data.visualPlan.direction.trim())
    throw Error("AI frame plan does not match this visual.");
  return {
    headline: data.headline, subheading: data.subheading, cta: "", photoSummary: photo ? data.photoSummary : "",
    visualPlan: { role: output.visualPlan?.role || "details", layout: data.visualPlan.layout, direction: data.visualPlan.direction },
    referencePlanVersion: version, plannedPhotoId: photo?.id || null, plannedLogoIds: logos.map((logo) => logo.id),
  };
}
